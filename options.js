/**
 * paw - Options script
 *
 * Responsibilities
 * - Persist configuration for toggles, shortcuts, offsets
 * - Persist Protocol(s) and server settings used by content/popup
 * - Reflect `storage.sync` changes into the UI in real time
 */
const api = (typeof browser !== 'undefined') ? browser : chrome;

/** Set status badge text and green "on" class. */
function setBadge(el, isEnabled) {
  if (!el) return;
  el.textContent = isEnabled ? 'ON' : 'OFF';
  el.classList.toggle('on', isEnabled);
}

/**
 * Convert any protocol string to a prettified JSON array.
 * Handles comma-separated ("paw,anki") and existing JSON formats.
 */
function prettifyProtocol(text) {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(Array.isArray(parsed) ? parsed : [parsed], null, 2);
  } catch (_) {
    // Treat as comma-separated shorthand → convert to JSON array
    const arr = (text || 'paw')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(p => ({ protocol: p }));
    return JSON.stringify(arr, null, 2);
  }
}

/** Validate textarea, show status, return parsed value or null. */
function validateProtocolTextarea(textarea, statusEl) {
  try {
    const parsed = JSON.parse(textarea.value);
    textarea.classList.remove('o-json-error');
    textarea.classList.add('o-json-ok');
    statusEl.textContent = '✓ valid JSON';
    statusEl.className = 'o-json-status ok';
    return parsed;
  } catch (e) {
    textarea.classList.remove('o-json-ok');
    textarea.classList.add('o-json-error');
    statusEl.textContent = '✗ ' + e.message;
    statusEl.className = 'o-json-status error';
    return null;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleButton');
  const statusText = document.getElementById('statusText');
  const autoHighlightButton = document.getElementById('autoHighlightButton');
  const autoHighlightStatusText = document.getElementById('autoHighlightStatusText');
  const singleClickButton = document.getElementById('singleClickButton');
  const singleClickStatusText = document.getElementById('singleClickButton');
  const showButtonButton = document.getElementById('showButtonButton');
  const showButtonStatusText = document.getElementById('showButtonStatusText');
  const keySelection = document.getElementById('key-selection');
  const floatingButtonLeftSelection = document.getElementById('floating-button-left');
  const floatingButtonTopSelection = document.getElementById('floating-button-top');
  const modifierSelection = document.getElementById('modifier-selection');
  const saveKeyButton = document.getElementById('save-key');

  // New configuration options
  const protocolInput = document.getElementById('protocol');
  const templateInput = document.getElementById('template');
  const urlInput = document.getElementById('url');
  const titleInput = document.getElementById('title');
  const noteInput = document.getElementById('note');
  const bodyInput = document.getElementById('body');
  const serverInput = document.getElementById('server');
  // Load saved settings
  api.storage.sync.get([
    'isExtensionDisabled',
    'isSingleClickDisabled',
    'isAutoHighlightDisabled',
    'isShowButtonDisabled',
    'shortcutKey',
    'modifierKey',
    'floatingButtonLeft',
    'floatingButtonTop',
    'protocol',
    'template',
    'url',
    'title',
    'note',
    'body',
    'server'
  ], function(data) {
    toggleButton.checked = !data.isExtensionDisabled;
    setBadge(statusText, !data.isExtensionDisabled);
    singleClickButton.checked = !data.isSingleClickDisabled;
    setBadge(singleClickStatusText, !data.isSingleClickDisabled);
    autoHighlightButton.checked = !data.isAutoHighlightDisabled;
    setBadge(autoHighlightStatusText, !data.isAutoHighlightDisabled);
    showButtonButton.checked = !data.isShowButtonDisabled;
    setBadge(showButtonStatusText, !data.isShowButtonDisabled);
    keySelection.value = data.shortcutKey || 's';
    modifierSelection.value = data.modifierKey || 'Alt';
    floatingButtonLeftSelection.value = data.floatingButtonLeft || '10';
    floatingButtonTopSelection.value = data.floatingButtonTop || '-10';
    // Load new settings — prettify protocol into the textarea
    const rawProtocol = data.protocol || 'paw';
    protocolInput.value = prettifyProtocol(rawProtocol);
    validateProtocolTextarea(protocolInput, document.getElementById('protocol-error'));
    templateInput.value = data.template || '';
    urlInput.value = data.url || 'url';
    titleInput.value = data.title || 'title';
    noteInput.value = data.note || 'note';
    bodyInput.value = data.body || 'body';
    serverInput.value = data.server || 'http://localhost:5001';
  });
  // Toggle extension state
  toggleButton.addEventListener('change', function() {
    const isExtensionDisabled = !toggleButton.checked;
    setBadge(statusText, toggleButton.checked);
    api.storage.sync.set({ isExtensionDisabled: isExtensionDisabled });
  });
  // Toggle single click state
  singleClickButton.addEventListener('change', function() {
    const isSingleClickDisabled = !singleClickButton.checked;
    setBadge(singleClickStatusText, singleClickButton.checked);
    api.storage.sync.set({ isSingleClickDisabled: isSingleClickDisabled });
  });
  // Toggle auto highlight state
  autoHighlightButton.addEventListener('change', function() {
    const isAutoHighlightDisabled = !autoHighlightButton.checked;
    setBadge(autoHighlightStatusText, autoHighlightButton.checked);
    api.storage.sync.set({ isAutoHighlightDisabled: isAutoHighlightDisabled });
  });

  // Toggle show button state
  showButtonButton.addEventListener('change', function() {
    const isShowButtonDisabled = !showButtonButton.checked;
    setBadge(showButtonStatusText, showButtonButton.checked);
    api.storage.sync.set({ isShowButtonDisabled: isShowButtonDisabled });
  });
  // Live JSON validation for protocol textarea
  protocolInput.addEventListener('input', () => {
    validateProtocolTextarea(protocolInput, document.getElementById('protocol-error'));
  });

  // Save key selection and settings
  saveKeyButton.addEventListener('click', function() {
    // shortcut key setting
    const selectedKey = keySelection.value;
    const selectedModifier = modifierSelection.value;
    api.storage.sync.set({ shortcutKey: selectedKey, modifierKey: selectedModifier }, function() {
      console.log('Shortcut key and modifier saved:', selectedKey, selectedModifier);
    });
    // floating button offset setting
    const floatingButtonLeft = floatingButtonLeftSelection.value;
    const floatingButtonTop = floatingButtonTopSelection.value;
    api.storage.sync.set({ floatingButtonLeft: floatingButtonLeft, floatingButtonTop: floatingButtonTop }, function() {
      console.log('Floating button offset saved:', floatingButtonLeft, floatingButtonTop);
    });
    // Save protocol — compact JSON; abort save if invalid
    const protocolStatusEl = document.getElementById('protocol-error');
    const parsedProtocol = validateProtocolTextarea(protocolInput, protocolStatusEl);
    if (parsedProtocol === null) return; // don't save if JSON is broken
    const protocol = JSON.stringify(parsedProtocol); // compact for storage
    const template = templateInput.value;
    const url = urlInput.value;
    const title = titleInput.value;
    const note = noteInput.value;
    const body = bodyInput.value;
    const server = serverInput.value;
    api.storage.sync.set({
      protocol: protocol,
      template: template,
      url: url,
      title: title,
      note: note,
      body: body,
      server: server
    }, function() {
      console.log('Additional settings saved:', protocol, template, url, title, note, body, server);
    });
  });
  // Update UI when storage changes
  api.storage.onChanged.addListener(function(changes, namespace) {
    for (let [key, { newValue }] of Object.entries(changes)) {
      if (key === 'isExtensionDisabled') {
        toggleButton.checked = !newValue;
        statusText.textContent = newValue ? 'OFF' : 'ON';
      }
    }
  });
  // Update UI when storage changes
  api.storage.onChanged.addListener(function(changes, namespace) {
    for (let [key, { newValue }] of Object.entries(changes)) {
      if (key === 'isSingleClickDisabled') {
        singleClickButton.checked = !newValue;
        singleClickStatusText.textContent = newValue ? 'OFF' : 'ON';
      }
    }
  });

  // Update UI when storage changes
  api.storage.onChanged.addListener(function(changes, namespace) {
    for (let [key, { newValue }] of Object.entries(changes)) {
      if (key === 'isAutoHighlightDisabled') {
        autoHighlightButton.checked = !newValue;
        autoHighlightStatusText.textContent = newValue ? 'OFF' : 'ON';
      }
      if (key === 'isShowButtonDisabled') {
        showButtonButton.checked = !newValue;
        showButtonStatusText.textContent = newValue ? 'OFF' : 'ON';
      }
    }
  });
});
