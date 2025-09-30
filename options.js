/**
 * paw - Options script
 *
 * Responsibilities
 * - Persist configuration for toggles, shortcuts, offsets
 * - Persist Protocol(s) and server settings used by content/popup
 * - Reflect `storage.sync` changes into the UI in real time
 */
const api = (typeof browser !== 'undefined') ? browser : chrome;
document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleButton');
  const statusText = document.getElementById('statusText');
  const autoHighlightButton = document.getElementById('autoHighlightButton');
  const autoHighlightStatusText = document.getElementById('autoHighlightStatusText');
  const singleClickButton = document.getElementById('singleClickButton');
  const singleClickStatusText = document.getElementById('singleClickButton');
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
    statusText.textContent = data.isExtensionDisabled ? 'OFF' : 'ON';
    singleClickButton.checked = !data.isSingleClickDisabled;
    singleClickStatusText.textContent = data.isSingleClickDisabled ? 'OFF' : 'ON';
    autoHighlightButton.checked = !data.isAutoHighlightDisabled;
    autoHighlightStatusText.textContent = data.isAutoHighlightDisabled ? 'OFF' : 'ON';
    keySelection.value = data.shortcutKey || 's';
    modifierSelection.value = data.modifierKey || 'Alt';
    floatingButtonLeftSelection.value = data.floatingButtonLeft || '10';
    floatingButtonTopSelection.value = data.floatingButtonTop || '-10';
    // Load new settings
    protocolInput.value = data.protocol || 'paw';
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
    statusText.textContent = isExtensionDisabled ? 'OFF' : 'ON';
    api.storage.sync.set({ isExtensionDisabled: isExtensionDisabled });
  });
  // Toggle single click state
  singleClickButton.addEventListener('change', function() {
    const isSingleClickDisabled = !singleClickButton.checked;
    singleClickStatusText.textContent = isSingleClickDisabled ? 'OFF' : 'ON';
    api.storage.sync.set({ isSingleClickDisabled: isSingleClickDisabled });
  });
  // Toggle auto highlight state
  autoHighlightButton.addEventListener('change', function() {
    const isAutoHighlightDisabled = !autoHighlightButton.checked;
    autoHighlightStatusText.textContent = isAutoHighlightDisabled ? 'OFF' : 'ON';
    api.storage.sync.set({ isAutoHighlightDisabled: isAutoHighlightDisabled });
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
    // Save new settings
    const protocol = protocolInput.value;
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
    }
  });
});
