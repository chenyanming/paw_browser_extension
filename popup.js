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
});
