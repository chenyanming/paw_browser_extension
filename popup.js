const api = (typeof browser !== 'undefined') ? browser : chrome;

// Parse the protocol string and return an array of protocol objects
// Each object contains a protocol key
// Example: "paw,anki" => [{protocol: "paw"}, {protocol: "anki"}]
// If the protocol is JSON format, return the parsed JSON array
// Example: "[{protocol: 'paw'}, {protocol: 'anki'}]"
function paw_parse_protocol(text) {
    let protocolArray = [];
    try {
        // 尝试解析 JSON 格式的协议
        let jsonProtocol = JSON.parse(text);
        protocolArray = Array.isArray(jsonProtocol) ? jsonProtocol : [jsonProtocol];
    } catch (e) {
        // 如果不是 JSON，则使用逗号分割格式
        protocolArray = (text || 'paw').split(',').map(p => ({ protocol: p }));
    }
    return protocolArray;
}

let contextMenu = document.getElementById('contextMenu');
// Create the contextMenu
api.storage.sync.get(['protocol'], function(data) {
    let protocolArray = paw_parse_protocol(data.protocol);
    console.log(protocolArray);
    // Add context menu items based on the protocol array
    for (let i in protocolArray) {
        let button = document.createElement('button');
        button.className = 'protocol-item';
        button.id = 'orgProtocolItem' + i;
        button.textContent = protocolArray[i].protocol;
        contextMenu.appendChild(button);
    }
    // contextMenu.style.display = "none"; // Initially hidden
    // Append the contextMenu to the body
    if (protocolArray.length > 0) {
        document.documentElement.appendChild(contextMenu);

        for (let i in protocolArray) {
            // Add click event listeners for contextMenu items
            document.getElementById("orgProtocolItem" + i).addEventListener("click", () => {
                console.log("Button Click");
                // 获取当前活动的标签页
                api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const activeTab = tabs[0].id;

                    // 向 content.js 发送消息
                    api.tabs.sendMessage(activeTab, {
                        action: "send_to_paw",
                        selectedNode: undefined,
                        item: parseInt(i),
                        allowNoSelection: true,
                    }, (response) => {
                        if (response) {
                            console.log(response.result); // 打印 content.js 的响应
                        }
                    });
                });
            });

        }
    }
});


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
