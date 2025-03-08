const api = (typeof browser !== 'undefined') ? browser : chrome;
document.addEventListener('DOMContentLoaded', function () {
    let button = document.getElementById('toggleButton');
    let autoHighlightButton = document.getElementById('autoHighlightButton');
    let singleClickButton = document.getElementById('singleClickButton');
    let statusText = document.getElementById('statusText');
    let autoHighlightStatusText = document.getElementById('autoHighlightStatusText');
    let singleClickStatusText = document.getElementById('singleClickStatusText');
    // Set the initial state of the switch and status text
    api.storage.sync.get('isExtensionDisabled', function(data) {
        let isExtensionDisabled = data.isExtensionDisabled;
        button.checked = !isExtensionDisabled;
        statusText.textContent = isExtensionDisabled ? 'OFF' : 'ON';
    });

    // Attach an event listener for when the switch is toggled
    button.addEventListener('change', function() {
        let isExtensionDisabled = !button.checked; // Toggle the state
        statusText.textContent = isExtensionDisabled ? 'OFF' : 'ON'; // Update status text
        api.storage.sync.set({isExtensionDisabled: isExtensionDisabled});
    });

    // Set the initial state of the switch and status text
    api.storage.sync.get('isAutoHighlightDisabled', function(data) {
        let isAutoHighlightDisabled = data.isAutoHighlightDisabled;
        autoHighlightButton.checked = !isAutoHighlightDisabled;
        autoHighlightStatusText.textContent = isAutoHighlightDisabled ? 'OFF' : 'ON';
    });

    // Attach an event listener for when the switch is toggled
    autoHighlightButton.addEventListener('change', function() {
        let isAutoHighlightDisabled = !autoHighlightButton.checked; // Toggle the state
        autoHighlightStatusText.textContent = isAutoHighlightDisabled ? 'OFF' : 'ON'; // Update status text
        api.storage.sync.set({isAutoHighlightDisabled: isAutoHighlightDisabled});
    });

    api.storage.sync.get('isSingleClickDisabled', function(data) {
        let isSingleClickDisabled = data.isSingleClickDisabled;
        singleClickButton.checked = !isSingleClickDisabled;
        singleClickStatusText.textContent = isSingleClickDisabled ? 'OFF' : 'ON';
    });

    // Attach an event listener for when the switch is toggled
    singleClickButton.addEventListener('change', function() {
        let isSingleClickDisabled = !singleClickButton.checked; // Toggle the state
        singleClickStatusText.textContent = singleClickButton ? 'OFF' : 'ON'; // Update status text
        api.storage.sync.set({isSingleClickDisabled: isSingleClickDisabled});
    });
});
