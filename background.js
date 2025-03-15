const api = (typeof browser !== 'undefined') ? browser : chrome;
const action = (typeof browser !== 'undefined') ? browser.browserAction : chrome.action;
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

api.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['isExtensionDisabled', 'isSingleClickDisabled', 'isAutoHighlightDisabled', 'defaultFloatingButtonLeft', 'defaultFloatingButtonTop'], (data) => {
        if (data.isExtensionDisabled === undefined) {
            chrome.storage.sync.set({ isExtensionDisabled: false });
        }
        if (data.isSingleClickDisabled === undefined) {
            chrome.storage.sync.set({ isSingleClickDisabled: true });
        }
        if (data.isAutoHighlightDisabled === undefined) {
            chrome.storage.sync.set({ isAutoHighlightDisabled: true });
        }
        if (data.defaultFloatingButtonLeft === undefined) {
            chrome.storage.sync.set({ defaultFloatingButtonLeft: '' });
        }
        if (data.defaultFloatingButtonTop === undefined) {
            chrome.storage.sync.set({ defaultFloatingButtonTop: '' });
        }
    });
});

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
