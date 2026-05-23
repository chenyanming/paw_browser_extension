/**
 * paw - Popup script
 *
 * Responsibilities
 * - Render toggles for Enable, Single-Click, Auto-Highlight, Show Button
 * - Render protocol buttons from stored Protocol(s) config
 * - Send action messages to active tab content script
 * - Capture tabs (with close) and open tab manager
 */
const api = (typeof browser !== 'undefined') ? browser : chrome;

/**
 * Parse Protocol(s) string into array of protocol config objects.
 * Supports JSON array format or comma-separated: "paw,anki"
 */
function paw_parse_protocol(text) {
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        return (text || 'paw').split(',').map(p => ({ protocol: p.trim() }));
    }
}

/** Set status badge text and green "on" highlight class. */
function setBadge(el, isEnabled) {
    el.textContent = isEnabled ? 'ON' : 'OFF';
    el.classList.toggle('on', isEnabled);
}

function getRuntimeLastError() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
        return chrome.runtime.lastError;
    }
    return api.runtime && api.runtime.lastError;
}

function formatMediaTime(milliseconds) {
    if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds)) {
        return '';
    }

    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatMediaMeta(status) {
    const currentTime = formatMediaTime(status.currentTimeMs);
    const duration = formatMediaTime(status.durationMs);

    if (currentTime && duration) {
        return `${currentTime}/${duration}`;
    }
    if (currentTime) {
        return currentTime;
    }
    return status.provider || '';
}

function setMediaDot(dot, state) {
    dot.classList.remove('ready', 'waiting', 'error');
    if (state) {
        dot.classList.add(state);
    }
}

function setMediaToggleIcon(button, paused) {
    if (!button) {
        return;
    }

    if (paused === false) {
        button.title = 'Pause';
        button.setAttribute('aria-label', 'Pause media');
        button.innerHTML = `
            <svg class="p-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="4" y="3" width="2.7" height="10" rx="0.8" fill="currentColor"/>
              <rect x="9.3" y="3" width="2.7" height="10" rx="0.8" fill="currentColor"/>
            </svg>
        `;
        return;
    }

    button.title = 'Play';
    button.setAttribute('aria-label', 'Play media');
    button.innerHTML = `
        <svg class="p-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M5 3.5v9l7-4.5-7-4.5Z" fill="currentColor"/>
        </svg>
    `;
}

// ── Protocol buttons ──────────────────────────────────────────────────────────
const contextMenu = document.getElementById('contextMenu');

api.storage.sync.get(['protocol'], function(data) {
    const protocolArray = paw_parse_protocol(data.protocol);

    for (let i = 0; i < protocolArray.length; i++) {
        const button = document.createElement('button');
        button.className = 'protocol-item';
        button.id = 'orgProtocolItem' + i;
        button.textContent = protocolArray[i].protocol;
        contextMenu.appendChild(button);
    }

    for (let i = 0; i < protocolArray.length; i++) {
        document.getElementById('orgProtocolItem' + i).addEventListener('click', () => {
            api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0].id;
                api.tabs.sendMessage(activeTab, {
                    action: 'send_to_paw',
                    selectedNode: undefined,
                    item: i,
                    allowNoSelection: true,
                }, (response) => {
                    if (response) console.log(response.result);
                });
            });
        });
    }
});

// ── DOMContentLoaded ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

    // ── Tab capture buttons ─────────────────────────────────────────────────
    // "Capture Tab": save active tab then close it (OneTab behaviour)
    document.getElementById('captureTab').addEventListener('click', () => {
        api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab) return;
            api.runtime.sendMessage({
                type: 'capture_tabs',
                tabs: [{ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl || '' }],
                tabIdsToClose: [tab.id]
            });
        });
    });

    // "Capture All": save all non-extension tabs, close them, open manager
    document.getElementById('captureAllTabs').addEventListener('click', () => {
        api.tabs.query({ currentWindow: true }, (tabs) => {
            const toCapture = tabs.filter(t =>
                t.url &&
                !t.url.startsWith('chrome://') &&
                !t.url.startsWith('chrome-extension://') &&
                !t.url.startsWith('about:') &&
                !t.url.startsWith('edge://')
            );
            if (toCapture.length === 0) return;
            api.runtime.sendMessage({
                type: 'capture_tabs',
                tabs: toCapture.map(t => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl || '' })),
                tabIdsToClose: toCapture.map(t => t.id)
            });
        });
    });

    document.getElementById('openSettings').addEventListener('click', () => {
        api.runtime.openOptionsPage();
    });

    document.getElementById('openTabManager').addEventListener('click', () => {
        api.tabs.create({ url: api.runtime.getURL('tabs.html') });
    });

    // ── Toggle switches ─────────────────────────────────────────────────────
    const button = document.getElementById('toggleButton');
    const autoHighlightButton = document.getElementById('autoHighlightButton');
    const singleClickButton = document.getElementById('singleClickButton');
    const showButtonButton = document.getElementById('showButtonButton');
    const statusText = document.getElementById('statusText');
    const autoHighlightStatusText = document.getElementById('autoHighlightStatusText');
    const singleClickStatusText = document.getElementById('singleClickStatusText');
    const showButtonStatusText = document.getElementById('showButtonStatusText');

    api.storage.sync.get('isExtensionDisabled', function(data) {
        button.checked = !data.isExtensionDisabled;
        setBadge(statusText, !data.isExtensionDisabled);
    });
    button.addEventListener('change', function() {
        const isExtensionDisabled = !button.checked;
        setBadge(statusText, button.checked);
        api.storage.sync.set({ isExtensionDisabled });
    });

    api.storage.sync.get('isAutoHighlightDisabled', function(data) {
        autoHighlightButton.checked = !data.isAutoHighlightDisabled;
        setBadge(autoHighlightStatusText, !data.isAutoHighlightDisabled);
    });
    autoHighlightButton.addEventListener('change', function() {
        const isAutoHighlightDisabled = !autoHighlightButton.checked;
        setBadge(autoHighlightStatusText, autoHighlightButton.checked);
        api.storage.sync.set({ isAutoHighlightDisabled });
    });

    api.storage.sync.get('isSingleClickDisabled', function(data) {
        singleClickButton.checked = !data.isSingleClickDisabled;
        setBadge(singleClickStatusText, !data.isSingleClickDisabled);
    });
    singleClickButton.addEventListener('change', function() {
        const isSingleClickDisabled = !singleClickButton.checked;
        setBadge(singleClickStatusText, singleClickButton.checked);
        api.storage.sync.set({ isSingleClickDisabled });
    });

    api.storage.sync.get('isShowButtonDisabled', function(data) {
        showButtonButton.checked = !data.isShowButtonDisabled;
        setBadge(showButtonStatusText, !data.isShowButtonDisabled);
    });
    showButtonButton.addEventListener('change', function() {
        const isShowButtonDisabled = !showButtonButton.checked;
        setBadge(showButtonStatusText, showButtonButton.checked);
        api.storage.sync.set({ isShowButtonDisabled });
    });

    initMediaControls();
});

// ── Browser media controls ───────────────────────────────────────────────────
function initMediaControls() {
    const controls = {
        bridge: document.getElementById('mediaBridgeButton'),
        bridgeStatus: document.getElementById('mediaBridgeStatusText'),
        refresh: document.getElementById('mediaRefresh'),
        toggle: document.getElementById('mediaToggle'),
        back: document.getElementById('mediaBack'),
        forward: document.getElementById('mediaForward'),
        dot: document.getElementById('mediaStatusDot'),
        text: document.getElementById('mediaStatusText'),
        meta: document.getElementById('mediaStatusMeta')
    };

    if (!controls.bridge || !controls.refresh || !controls.toggle || !controls.back || !controls.forward) {
        return;
    }

    const playbackButtons = [controls.refresh, controls.toggle, controls.back, controls.forward];

    function setPlaybackEnabled(isEnabled) {
        playbackButtons.forEach((button) => {
            button.disabled = !isEnabled;
        });
    }

    function setStatus(state, text, meta) {
        setMediaDot(controls.dot, state);
        controls.text.textContent = text;
        controls.meta.textContent = meta || '';
    }

    function renderMediaResponse(response, errorMessage) {
        if (errorMessage) {
            setStatus('error', 'Unavailable', '');
            return;
        }

        const status = response || {};
        const hasPlayer = Boolean(status.ok && status.canControl);
        const meta = formatMediaMeta(status);

        if (hasPlayer) {
            setMediaToggleIcon(controls.toggle, status.paused);
            if (status.paused === true) {
                setStatus('ready', 'Paused', meta);
            } else if (status.paused === false) {
                setStatus('ready', 'Playing', meta);
            } else {
                setStatus('ready', 'Ready', meta);
            }
            return;
        }

        if (status.error === 'no-media') {
            setStatus('waiting', 'No Media', '');
        } else if (status.error) {
            setStatus('error', 'Unavailable', '');
        } else {
            setStatus('waiting', 'Checking', '');
        }
    }

    function refreshConnectionStatus() {
        api.runtime.sendMessage({ type: 'media_connection_status' }, (status) => {
            const lastError = getRuntimeLastError();
            if (lastError || !status) {
                controls.bridge.checked = false;
                setBadge(controls.bridgeStatus, false);
                setPlaybackEnabled(false);
                setStatus('error', 'Unavailable', '');
                return;
            }

            controls.bridge.checked = Boolean(status.enabled);
            setBadge(controls.bridgeStatus, Boolean(status.enabled));
            setPlaybackEnabled(Boolean(status.enabled));
            setMediaToggleIcon(controls.toggle, true);
            if (!status.enabled) {
                setStatus(null, 'Disabled', '');
            } else if (status.connected) {
                setStatus('ready', 'Connected', '');
            } else {
                setStatus('waiting', 'Connecting', '');
            }
        });
    }

    function sendMediaCommand(command, payload) {
        if (!controls.bridge.checked) {
            setStatus(null, 'Disabled', '');
            return;
        }

        setStatus('waiting', command === 'status' ? 'Checking' : 'Sending', controls.meta.textContent);

        api.runtime.sendMessage({
            type: 'media_popup_request',
            request: {
                action: command,
                deltaMs: payload && payload.deltaMs,
                positionMs: payload && payload.positionMs,
                payload: payload || {}
            }
        }, (response) => {
            const lastError = getRuntimeLastError();
            if (lastError) {
                renderMediaResponse(null, lastError.message);
                return;
            }

            renderMediaResponse(response, null);
            if (command !== 'status') {
                setTimeout(() => sendMediaCommand('status'), 300);
            }
        });
    }

    controls.bridge.addEventListener('change', () => {
        const mediaControlEnabled = controls.bridge.checked;
        setBadge(controls.bridgeStatus, mediaControlEnabled);
        api.storage.sync.set({ mediaControlEnabled }, () => {
            refreshConnectionStatus();
        });
    });

    controls.refresh.addEventListener('click', () => sendMediaCommand('status'));
    controls.toggle.addEventListener('click', () => sendMediaCommand('toggle'));
    controls.back.addEventListener('click', () => sendMediaCommand('seekRelative', { deltaMs: -10000 }));
    controls.forward.addEventListener('click', () => sendMediaCommand('seekRelative', { deltaMs: 10000 }));

    setPlaybackEnabled(false);
    refreshConnectionStatus();
}
