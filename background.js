/**
 * paw - Background script
 *
 * Responsibilities
 * - Initialize default `storage.sync` keys on install
 * - Provide cross-browser `api` shim for Chrome/Firefox
 * - (Optional) Action click handler when popup is disabled
 */
const api = (typeof browser !== 'undefined') ? browser : chrome;
const action = (typeof browser !== 'undefined') ? browser.browserAction : chrome.action;
const DEFAULT_SERVER_URL = 'http://localhost:5001';

let mediaSocket = null;
let mediaReconnectTimer = null;
let lastMediaTabId = null;
// // Only if popup is disable, this part is needed
// action.onClicked.addListener(() => {
//     api.storage.sync.get('isExtensionDisabled', (data) => {
//         let isExtensionDisabled = !data.isExtensionDisabled;
//         api.storage.sync.set({isExtensionDisabled: isExtensionDisabled});

//         // Sending a message to all tabs informing about the status change
//         api.tabs.query({}, function(tabs) {
//             for (let tab of tabs) {
//                 if (isExtensionDisabled) {
//                     let message = 'Single Click Mode is now: Disabled. You can still use the shortcut key to send requests';
//                     api.tabs.sendMessage(tab.id, {type: 'statusChange', message: message, status: isExtensionDisabled});
//                 } else {
//                     let message = 'Single Click Mode is now: Enabled.';
//                     api.tabs.sendMessage(tab.id, {type: 'statusChange', message: message, status: isExtensionDisabled});
//                 }
//             }
//         });
//     });
// });

/**
 * Initialize default extension settings on installation/update.
 */
/**
 * Proxy fetch requests from content scripts to bypass Private Network Access (PNA) restrictions.
 * Content scripts running on public sites cannot directly fetch localhost; background scripts can.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'fetch') {
        fetch(message.url, message.options)
            .then(async response => {
                const text = await response.text();
                sendResponse({ ok: response.ok, status: response.status, text });
            })
            .catch(err => sendResponse({ error: err.message }));
        return true; // Keep the message channel open for async response
    }

    if (message.type === 'capture_tabs') {
        (async () => {
            try {
                const data = await api.storage.local.get({ pawTabSections: [] });
                const sections = data.pawTabSections;
                const now = new Date().toLocaleString();
                sections.unshift({
                    id: crypto.randomUUID(),
                    name: now,
                    tabs: message.tabs.map(t => ({ id: crypto.randomUUID(), ...t }))
                });
                await api.storage.local.set({ pawTabSections: sections });

                if (message.tabIdsToClose && message.tabIdsToClose.length > 0) {
                    await api.tabs.remove(message.tabIdsToClose).catch(() => {});
                    api.tabs.create({ url: api.runtime.getURL('tabs.html') });
                }
            } catch (err) {
                console.error('capture_tabs error:', err);
            }
        })();
        return false;
    }

    if (message.type === 'media_popup_request') {
        handleMediaRequest(message.request || {})
            .then(sendResponse);
        return true;
    }

    if (message.type === 'media_connection_status') {
        getMediaConnectionStatus()
            .then(sendResponse);
        return true;
    }
});

api.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get([
        'isExtensionDisabled',
        'isSingleClickDisabled',
        'isAutoHighlightDisabled',
        'isShowButtonDisabled',
        'mediaControlEnabled',
        'server',
        'defaultFloatingButtonLeft',
        'defaultFloatingButtonTop'
    ], (data) => {
        if (data.isExtensionDisabled === undefined) {
            chrome.storage.sync.set({ isExtensionDisabled: false });
        }
        if (data.isSingleClickDisabled === undefined) {
            chrome.storage.sync.set({ isSingleClickDisabled: true });
        }
        if (data.isAutoHighlightDisabled === undefined) {
            chrome.storage.sync.set({ isAutoHighlightDisabled: true });
        }
        if (data.isShowButtonDisabled === undefined) {
            chrome.storage.sync.set({ isShowButtonDisabled: true });
        }
        if (data.mediaControlEnabled === undefined) {
            chrome.storage.sync.set({ mediaControlEnabled: false });
        }
        if (data.server === undefined) {
            chrome.storage.sync.set({ server: DEFAULT_SERVER_URL });
        }
        if (data.defaultFloatingButtonLeft === undefined) {
            chrome.storage.sync.set({ defaultFloatingButtonLeft: '' });
        }
        if (data.defaultFloatingButtonTop === undefined) {
            chrome.storage.sync.set({ defaultFloatingButtonTop: '' });
        }
    });
});

api.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.mediaControlEnabled || changes.server)) {
        syncMediaSocket();
    }
});

syncMediaSocket();

function runtimeLastError() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
        return chrome.runtime.lastError;
    }
    return api.runtime && api.runtime.lastError;
}

function storageGet(keys) {
    return new Promise((resolve) => api.storage.sync.get(keys, resolve));
}

function tabsQuery(query) {
    return new Promise((resolve) => api.tabs.query(query, resolve));
}

function tabsGet(tabId) {
    return new Promise((resolve) => {
        api.tabs.get(tabId, (tab) => {
            const error = runtimeLastError();
            resolve(error ? null : tab);
        });
    });
}

function sendTabMessage(tabId, message) {
    return new Promise((resolve) => {
        api.tabs.sendMessage(tabId, message, (response) => {
            const error = runtimeLastError();
            if (error) {
                resolve({ ok: false, error: error.message || String(error) });
            } else {
                resolve(response || { ok: false, error: 'empty-response' });
            }
        });
    });
}

function isExtensionPage(url) {
    return !url ||
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('about:') ||
        url.startsWith('edge://') ||
        url.startsWith('brave://');
}

function hashUrl(url) {
    let hash = 0;
    const text = url || '';
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function youtubeVideoId(parsedUrl) {
    if (!parsedUrl) {
        return null;
    }
    if (/(^|\.)youtu\.be$/i.test(parsedUrl.hostname)) {
        return parsedUrl.pathname.replace(/^\/+/, '').split('/')[0] || null;
    }
    if (/(^|\.)youtube\.com$/i.test(parsedUrl.hostname)) {
        return parsedUrl.searchParams.get('v');
    }
    return null;
}

function normalizedMediaUrlKey(url) {
    try {
        const parsedUrl = new URL(url);
        const youtubeId = youtubeVideoId(parsedUrl);
        if (youtubeId) {
            return `youtube:${youtubeId}`;
        }
        if (/(^|\.)bilibili\.com$/i.test(parsedUrl.hostname)) {
            const match = parsedUrl.pathname.match(/\/video\/([^/?#]+)/i);
            if (match) {
                return `bilibili:${match[1]}`;
            }
        }
        if (/(^|\.)netflix\.com$/i.test(parsedUrl.hostname)) {
            const match = parsedUrl.pathname.match(/\/watch\/([^/?#]+)/i);
            if (match) {
                return `netflix:${match[1]}`;
            }
        }
        parsedUrl.hash = '';
        parsedUrl.search = '';
        return `${parsedUrl.origin}${parsedUrl.pathname}`;
    } catch (error) {
        return (url || '').split('#')[0].split('?')[0];
    }
}

function mediaUrlMatchesTarget(tabUrl, targetUrl) {
    if (!tabUrl || !targetUrl) {
        return false;
    }
    const tabKey = normalizedMediaUrlKey(tabUrl);
    const targetKey = normalizedMediaUrlKey(targetUrl);
    return tabKey === targetKey || tabUrl.startsWith(targetUrl) || targetUrl.startsWith(tabUrl);
}

function tabIdFromMediaId(mediaId) {
    const match = String(mediaId || '').match(/^browser:(\d+):/);
    return match ? Number(match[1]) : null;
}

function normalizeMediaResponse(response, tab) {
    const now = Date.now();
    const normalized = {
        ok: Boolean(response && response.ok),
        error: response && response.error ? response.error : null,
        provider: response && response.provider ? response.provider : null,
        mediaId: tab ? `browser:${tab.id}:0:${hashUrl(tab.url)}` : null,
        url: response && response.url ? response.url : (tab && tab.url) || null,
        title: response && response.title ? response.title : (tab && tab.title) || null,
        currentTimeMs: Number(response && response.currentTimeMs) || 0,
        durationMs: Number(response && response.durationMs) || 0,
        remainingMs: Number(response && response.remainingMs) || 0,
        paused: response && typeof response.paused === 'boolean' ? response.paused : true,
        playbackRate: Number(response && response.playbackRate) || 1,
        canControl: Boolean(response && response.canControl),
        updatedAtMs: Number(response && response.updatedAtMs) || now
    };

    if (normalized.ok && normalized.canControl && tab) {
        lastMediaTabId = tab.id;
    }

    return normalized;
}

function emptyMediaResponse(error) {
    return {
        ok: false,
        error,
        provider: null,
        mediaId: null,
        url: null,
        title: null,
        currentTimeMs: 0,
        durationMs: 0,
        remainingMs: 0,
        paused: true,
        playbackRate: 1,
        canControl: false,
        updatedAtMs: Date.now()
    };
}

async function requestMediaFromTab(tab, request) {
    if (!tab || isExtensionPage(tab.url)) {
        return emptyMediaResponse('unsupported-tab');
    }

    const response = await sendTabMessage(tab.id, {
        action: 'media_request',
        command: request.action || request.command || 'status',
        deltaMs: request.deltaMs,
        positionMs: request.positionMs,
        timeoutMs: request.timeoutMs,
        targetUrl: request.targetUrl,
        payload: request.payload || {}
    });
    return normalizeMediaResponse(response, tab);
}

async function mediaCandidateTabs(request) {
    const target = request.target || 'active-or-last';
    const action = request.action || request.command || 'status';
    const targetUrl = request.targetUrl || request.url;
    const targetTabId = tabIdFromMediaId(request.mediaId);
    const candidates = [];
    const seen = new Set();

    function addTab(tab) {
        if (!tab || seen.has(tab.id)) {
            return;
        }
        seen.add(tab.id);
        candidates.push(tab);
    }

    const activeTabs = await tabsQuery({ active: true, currentWindow: true });
    const activeTab = activeTabs && activeTabs[0];

    if (targetTabId) {
        const targetTab = await tabsGet(targetTabId);
        if (!targetUrl || mediaUrlMatchesTarget(targetTab && targetTab.url, targetUrl)) {
            addTab(targetTab);
        }
    }

    if (target === 'active') {
        addTab(activeTab);
    }

    if (targetUrl) {
        const tabs = await tabsQuery({});
        for (const tab of tabs || []) {
            if (mediaUrlMatchesTarget(tab.url, targetUrl)) {
                addTab(tab);
            }
        }
        return candidates;
    }

    const audibleTabs = await tabsQuery({ audible: true });
    for (const tab of audibleTabs || []) {
        addTab(tab);
    }

    if (lastMediaTabId) {
        addTab(await tabsGet(lastMediaTabId));
    }

    if (action !== 'status' && target !== 'media') {
        addTab(activeTab);
    }

    addTab(activeTab);

    return candidates;
}

async function handleMediaRequest(request) {
    const candidates = await mediaCandidateTabs(request || {});
    let lastError = 'no-media';

    for (const tab of candidates) {
        const response = await requestMediaFromTab(tab, request || {});
        if (response.ok && response.canControl) {
            return response;
        }
        lastError = response.error || lastError;
    }

    return emptyMediaResponse(lastError);
}

function serverUrlToWebSocketUrl(serverUrl) {
    const url = new URL(serverUrl || DEFAULT_SERVER_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/media/ws';
    url.search = '';
    url.hash = '';
    return url.toString();
}

async function getMediaConnectionStatus() {
    const data = await storageGet({ mediaControlEnabled: false, server: DEFAULT_SERVER_URL });
    return {
        enabled: Boolean(data.mediaControlEnabled),
        connected: Boolean(mediaSocket && mediaSocket.readyState === WebSocket.OPEN),
        connecting: Boolean(mediaSocket && mediaSocket.readyState === WebSocket.CONNECTING),
        server: data.server || DEFAULT_SERVER_URL
    };
}

function clearMediaReconnectTimer() {
    if (mediaReconnectTimer) {
        clearTimeout(mediaReconnectTimer);
        mediaReconnectTimer = null;
    }
}

async function syncMediaSocket() {
    const data = await storageGet({ mediaControlEnabled: false, server: DEFAULT_SERVER_URL });
    if (!data.mediaControlEnabled) {
        clearMediaReconnectTimer();
        if (mediaSocket) {
            mediaSocket.close();
            mediaSocket = null;
        }
        return;
    }

    if (mediaSocket && (mediaSocket.readyState === WebSocket.OPEN || mediaSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    connectMediaSocket(data.server || DEFAULT_SERVER_URL);
}

function scheduleMediaReconnect() {
    clearMediaReconnectTimer();
    mediaReconnectTimer = setTimeout(syncMediaSocket, 2000);
}

function connectMediaSocket(serverUrl) {
    clearMediaReconnectTimer();
    let wsUrl;

    try {
        wsUrl = serverUrlToWebSocketUrl(serverUrl);
        mediaSocket = new WebSocket(wsUrl);
    } catch (error) {
        console.warn('paw media websocket failed to start', error);
        scheduleMediaReconnect();
        return;
    }

    mediaSocket.addEventListener('open', () => {
        mediaSocket.send(JSON.stringify({
            type: 'extension.hello',
            userAgent: navigator.userAgent,
            updatedAtMs: Date.now()
        }));
    });

    mediaSocket.addEventListener('message', async (event) => {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch (error) {
            return;
        }

        if (!message || message.type !== 'media.request') {
            return;
        }

        const response = await handleMediaRequest(message);
        if (mediaSocket && mediaSocket.readyState === WebSocket.OPEN) {
            mediaSocket.send(JSON.stringify({
                type: 'media.response',
                requestId: message.requestId,
                ...response
            }));
        }
    });

    mediaSocket.addEventListener('close', () => {
        mediaSocket = null;
        storageGet({ mediaControlEnabled: false }).then((data) => {
            if (data.mediaControlEnabled) {
                scheduleMediaReconnect();
            }
        });
    });

    mediaSocket.addEventListener('error', () => {
        if (mediaSocket) {
            mediaSocket.close();
        }
    });
}

// api.storage.sync.get('shortcutKey', function(data) {
//     const shortcutKey = data.shortcutKey || 's'; // Default key is 's'
//     document.addEventListener('keydown', async function(e) {
//         if (e.key === shortcutKey) {
//             console.log(`'${shortcutKey}' key was pressed`);
//             let isExtensionDisabled = await new Promise((resolve) => {
//                 api.storage.sync.get('isExtensionDisabled', function(data) {
//                     resolve(data.isExtensionDisabled);
//                 });
//             });
//             if (!isExtensionDisabled) {
//                 send_to_paw();
//             }
//         }
//     });
// });
