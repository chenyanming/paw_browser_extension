/**
 * paw - Content script
 *
 * Responsibilities
 * - Keyboard shortcut (modifier + key) to capture the word at caret
 * - Floating "+" button near selection with submenu/context menu actions
 * - Single-click mode: wrap words and send selection to backend/Emacs
 * - Auto highlight known words from paw-server and show info bubble
 * - Bridge injection for site-specific controls (e.g., Netflix)
 *
 * External Services
 * - Optional paw-server (default `http://localhost:5001`) for POST /paw, /words, /source
 *
 * Storage Keys (sync)
 * - isExtensionDisabled, isSingleClickDisabled, isAutoHighlightDisabled
 * - shortcutKey, modifierKey
 * - floatingButtonLeft, floatingButtonTop
 * - defaultFloatingButtonLeft, defaultFloatingButtonTop
 * - protocol, template, url, title, note, body, server
 */
console.log("Hello from paw.js");

const api = (typeof browser !== 'undefined') ? browser : chrome;

/**
 * Load shortcut and modifier from storage.
 * @returns {Promise<{shortcutKey?: string, modifierKey?: ("Ctrl"|"Alt"|"None")}>}
 */
async function getShortcutKeys() {
    return new Promise((resolve) => {
        api.storage.sync.get(['shortcutKey', 'modifierKey'], function (data) {
            resolve(data);
        });
    });
}

/**
 * Load floating button pixel offsets.
 * @returns {Promise<{floatingButtonLeft?: string, floatingButtonTop?: string}>}
 */
async function getFloatingButtonSettings() {
    return new Promise((resolve) => {
        api.storage.sync.get(['floatingButtonLeft', 'floatingButtonTop'], function (data) {
            resolve(data);
        });
    });
}

let lastX = 0, lastY = 0;
// save the last mouse position
document.addEventListener("mousemove", function (event) {
    lastX = event.clientX;
    lastY = event.clientY;
});

// Setup key event listener
/**
 * Keyboard handler: modifier + key to select current word under caret and send.
 */
document.addEventListener('keydown', async function (e) {
    const { shortcutKey, modifierKey } = await getShortcutKeys();
    const key = shortcutKey || 's'; // Default main key is 's'
    const modifier = modifierKey || 'Alt'; // Default modifier key is 'Alt'
    const isNoModifier = modifier === 'None';
    const isCtrlPressed = e.ctrlKey && modifier === 'Ctrl';
    const isAltPressed = e.altKey && modifier === 'Alt';
    const isModifierPressed = isNoModifier || isCtrlPressed || isAltPressed;
    if (e.key === key && isModifierPressed) {
        console.log(`${modifier} + '${key}' was pressed`);
        const caretPos = document.caretPositionFromPoint(lastX, lastY);
        if (!caretPos || !caretPos.offsetNode) return;

        let textNode = caretPos.offsetNode;
        let offset = caretPos.offset;

        if (textNode.nodeType !== Node.TEXT_NODE) return;

        let text = textNode.textContent;
        let start = offset, end = offset;

        // 向左扩展
        while (start > 0 && /\w/.test(text[start - 1])) start--;

        // 向右扩展
        while (end < text.length && /\w/.test(text[end])) end++;

        let word = text.slice(start, end);
        console.log("选中的单词:", word);

        // Create a Range and select the word
        let newRange = document.createRange();
        newRange.setStart(textNode, start);
        newRange.setEnd(textNode, end);

        let selection = window.getSelection();
        selection.removeAllRanges(); // 清除之前的选区
        selection.addRange(newRange); // 选中新的单词

        // Run content script action
        send_to_paw();
        e.preventDefault(); // Prevent default action for the key combination
    }
});

// hide the floating button when the page is in fullscreen mode
document.addEventListener("fullscreenchange", toggleButtonVisibility);
document.addEventListener("webkitfullscreenchange", toggleButtonVisibility);
document.addEventListener("mozfullscreenchange", toggleButtonVisibility);
document.addEventListener("MSFullscreenChange", toggleButtonVisibility);

/** Hide floating UI in fullscreen modes. */
function toggleButtonVisibility() {
    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        closeFloatingButton();
        const submenu = document.getElementById("submenu");
        if (submenu.style.display === "block") {
            submenu.style.display = "none";
        }
        isIntervalPaused = true;
    } else {
        openFloatingButton();
        isIntervalPaused = false;
    }
}


api.storage.sync.get('isExtensionDisabled', function(data) {
    if(data.isExtensionDisabled) {
        console.log("The extension is disabled");
        // Perform actions if the extension is disabled.
        disable_clickable_word();
        disable_highlight();
    } else {
        // console.log("The extension is enabled");
        // Perform actions if the extension is enabled.
        $(function () {
            createButton();
            console.log("createButton done");
            waitForNetflixAndExpose();
            console.log("expose netflix done");
        });
    }
});

api.storage.sync.get('isSingleClickDisabled', function(data) {
    if(data.isSingleClickDisabled) {
        console.log("Single Click is disabled");
        // Perform actions if the extension is disabled.
        disable_clickable_word();
    } else {
        // console.log("The extension is enabled");
        // Perform actions if the extension is enabled.
        $(function () {
            monitor_and_close_premium_popup();
            enable_clickable_word();
        });
    }
});

api.storage.sync.get('isAutoHighlightDisabled', function(data) {
    if(data.isAutoHighlightDisabled) {
        console.log("Auto Highlight is disabled");
        // Perform actions if the extension is disabled.
        disable_highlight();
    } else {
        // console.log("The extension is enabled");
        // Perform actions if the extension is enabled.
        $(function () {
            highlight_words();
        });
    }
});



if (window.top === window) {
    if (!window.hasPawListener) {
        window.hasPawListener = true;

        api.storage.onChanged.addListener(function(changes, namespace) {
            for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
                if(key === 'isExtensionDisabled') {
                    // console.log('Single Click Mode was:', oldValue ? 'Disabled' : 'Enabled');
                    console.log('Extension is now:', newValue ? 'Disabled' : 'Enabled');
                    if (!newValue) {
                        createButton();
                        // floatingButton.style.display = "block";
                    } else {
                        deleteButton();
                        disable_highlight();
                        disable_clickable_word();

                        // floatingButton.style.display = "none";
                        // contextMenu.style.display = "none";
                        // submenu.style.display = "none";
                    }
                }

                if(key === 'isSingleClickDisabled') {
                    // console.log('Single Click Mode was:', oldValue ? 'Disabled' : 'Enabled');
                    console.log('Single Click Mode is now:', newValue ? 'Disabled' : 'Enabled');
                    if (!newValue) {
                        monitor_and_close_premium_popup();
                        enable_clickable_word();
                    } else {
                        disable_clickable_word();
                    }
                }

                if(key === 'isAutoHighlightDisabled') {
                    // console.log('Single Click Mode was:', oldValue ? 'Disabled' : 'Enabled');
                    console.log('Auto Highlight Mode is now:', newValue ? 'Disabled' : 'Enabled');
                    if (!newValue) {
                        highlight_words();
                    } else {
                        disable_highlight();
                    }
                }
            }
        });

        api.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.type === 'statusChange') {
                // alert(request.message);
            }
        });

        api.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "send_to_paw") {
                // 调用 content.js 中的函数
                send_to_paw(request.selectedNode, request.item, request.allowNoSelection);
                sendResponse({ result: "Function in content.js called" });
            }
        });
    }
}

function toggleFloatingButton() {
    const floatingButton = document.getElementById("floatingButton");
    const submenu = document.getElementById("submenu");
    if (floatingButton.style.display === "none") {
        floatingButton.style.display = "block";
    } else {
        floatingButton.style.display = "none";
        submenu.style.display = "none";
    }
}

function closeFloatingButton () {
    const floatingButton = document.getElementById("floatingButton");
    floatingButton.style.display = "none";
}

function openFloatingButton () {
    const floatingButton = document.getElementById("floatingButton");
    floatingButton.style.display = "block";
}

/**
 * Capture selected HTML fragment with absolute URLs for anchors/images.
 * @returns {string}
 */
function get_body_html () {
    var html = "";
    if (typeof window.getSelection != "undefined") {
        var sel = window.getSelection();
        if (sel.rangeCount) {
            var container = document.createElement("div");
            for (var i = 0, len = sel.rangeCount; i < len; ++i) {
                container.appendChild(sel.getRangeAt(i).cloneContents());
            }
            html = container.innerHTML;
        }
    } else if (typeof document.selection != "undefined") {
        if (document.selection.type == "Text") {
            html = document.selection.createRange().htmlText;
        }
    }
    var relToAbs = function (href) {
        var a = document.createElement("a");
        a.href = href;
        var abs = a.protocol + "//" + a.host + a.pathname + a.search + a.hash;
        a.remove(); return abs;
    };
    var elementTypes = [['a', 'href'], ['img', 'src']];
    var div = document.createElement('div');
    div.innerHTML = html;
    elementTypes.map(function(elementType) {
        var elements = div.getElementsByTagName(elementType[0]);
        for (var i = 0; i < elements.length; i++) {
            elements[i].setAttribute(elementType[1], relToAbs(elements[i].getAttribute(elementType[1])));
        }
    });
    return div.innerHTML;
}

/**
 * Send selected content to paw-server or org-protocol.
 * @param {Node=} selectedNode Optional node to use instead of current selection
 * @param {number=} item Index in configured protocol array
 * @param {boolean=} allowNoSelection Allow sending with empty selection
 */
function send_to_paw(selectedNode, item, allowNoSelection) {
    var selection;
    if (selectedNode !== undefined) {
        // get the passed node textContent directly
        selection = selectedNode.textContent;
    } else {
        // get the selected node textContent
        selection = window.getSelection().toString();
    }
    if (selection.length > 0) {
        var parent;
        if (selectedNode !== undefined) {
            // use the passed node's parentNode directly
            parent = selectedNode.parentNode;
        } else {
            // get the selected node's parentNode
            parent = window.getSelection().getRangeAt(0).commonAncestorContainer.parentNode;
        }

        // get a element node first
        while (parent.nodeType !== Node.ELEMENT_NODE) {
            parent = parent.parentNode;
        }

        // get until p tag
        var p_tag_parent = parent;
        while (p_tag_parent.tagName !== undefined && p_tag_parent.tagName !== 'P') {
            p_tag_parent = p_tag_parent.parentNode;
        }
        if (p_tag_parent !== document) {
            parent = p_tag_parent;
        }
        // Get the body text/html before getting storage data, in case the selection is lost or clear
        var body_selection_text = selection;
        var body_selection_html = get_body_html();

        // paw_get_org_protocol_link(item, parent, body_selection_html, body_selection_text);
        paw_post_to_python(item, parent, body_selection_html, body_selection_text);

    } else if (allowNoSelection && selection.length == 0) {
        // paw_get_org_protocol_link(item, false, "", "");
        paw_post_to_python(item, false, "", "");
    }


    // WORKAROUND(FIXME) Pull highlights every time send an org-protocol request
    api.storage.sync.get('isAutoHighlightDisabled', function(data) {
        if(data.isAutoHighlightDisabled) {
            // console.log("Auto Highlight is disabled");
            // Perform actions if the extension is disabled.
            // disable_highlight();
        } else {
            // console.log("The extension is enabled");
            // Perform actions if the extension is enabled.
            $(function () {
                highlight_words();
            });
        }
    });
}

// Parse the protocol string and return an array of protocol objects
// Each object contains a protocol key
// Example: "paw,anki" => [{protocol: "paw"}, {protocol: "anki"}]
// If the protocol is JSON format, return the parsed JSON array
// Example: "[{protocol: 'paw'}, {protocol: 'anki'}]"
/**
 * Parse Protocol(s) setting to array of { protocol, format?, download?, deselect? }.
 * @param {string} text
 * @returns {{protocol: string, format?: string, download?: boolean, deselect?: boolean}[]}
 */
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

// parent: determine the note
// item: determine the protocol
// body_selection_html: the selected html content
// body_selection_text: the selected text content
/**
 * Build and navigate to org-protocol link as fallback.
 */
function paw_get_org_protocol_link(item, parent, body_selection_html, body_selection_text) {
    api.storage.sync.get(['protocol', 'template', 'url', 'title', 'note', 'body'], function(data) {
        var url = encodeURIComponent(window.location.href);
        var title = encodeURIComponent(document.title || "[untitled page]");
        var note = encodeURIComponent(parent.textContent || "");
        let protocol, params = {};
        let protocolArray = paw_parse_protocol(data.protocol);
        if (item !== undefined && item < protocolArray.length) {
            params = protocolArray[item];
        } else {
            params = protocolArray[0];
        }
        protocol = params.protocol || 'paw';
        // 格式默认使用 text
        let format = params.format || 'text';
        let body;
        // TODO 支持 markdown
        if (format === 'markdown') {
            // 转换为 Markdown
            let body_html = body_selection_html;
            body = convertHtmlToMarkdown(body_html);
        } else {
            // HTML 或 纯文本
            body = (format === 'html') ? body_selection_html : body_selection_text;
        }
        body = encodeURIComponent(body);
        const template = data.template || 'w';
        const urlKey = data.url || 'url';
        const titleKey = data.title || 'title';
        const noteKey = data.note || 'note';
        const bodyKey = data.body || 'body';
        // 最终 link 结构不变
        let link = `org-protocol://${protocol}?template=${template}&${urlKey}=${url}&${titleKey}=${title}&${noteKey}=${note}&${bodyKey}=${body}`;
        // 执行额外的逻辑，例如 download 参数
        if (params.download === true) {
            send_html_to_python((data) => {
                console.log("send_to_paw", {
                    url: decodeURIComponent(url),
                    title: decodeURIComponent(title),
                    note: decodeURIComponent(note),
                    body: decodeURIComponent(body),
                    format: format,
                    link: link,
                    html_file: data.temp_file_path
                });
                location.href = link;
            });
        } else {
            console.log("send_to_paw", {
                url: decodeURIComponent(url),
                title: decodeURIComponent(title),
                note: decodeURIComponent(note),
                body: decodeURIComponent(body),
                format: format,
                link: link
            });
            location.href = link;
        }


        // 格式默认使用 text
        if (params.deselect === true) {
            deselect();
        }

    });

}

/**
 * Send data to Python Flask /paw endpoint.
 * If fails, fallback to original org-protocol link.
 */
/**
 * POST selection payload to paw-server; fallback to org-protocol on failure.
 */
function paw_post_to_python(item, parent, body_selection_html, body_selection_text) {
    api.storage.sync.get(['protocol', 'template', 'url', 'title', 'note', 'body', 'server'], function(data) {
        const server = data.server || "http://localhost:5001";

        let url = window.location.href;
        let title = document.title || "[untitled page]";
        let note = parent.textContent || "";

        // Pick protocol parameters
        let params = {};
        let protocolArray = paw_parse_protocol(data.protocol);
        if (item !== undefined && item < protocolArray.length) {
            params = protocolArray[item];
        } else {
            params = protocolArray[0];
        }
        protocol = params.protocol || 'paw';

        let format = params.format || 'text';

        // Prepare body
        let body;
        if (format === 'markdown') {
            body = convertHtmlToMarkdown(body_selection_html);
        } else {
            body = (format === 'html') ? body_selection_html : body_selection_text;
        }

        const template = data.template || 'w';

        // Construct payload
        const payload = {
            protocol: protocol,
            url: url,
            title: title,
            note: note,
            body: body,
            format: format,
            template: template
        };

        // If download is true, get html_file first
        function sendPayload() {
            fetch(`${server}/paw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Auth-Token': 'your-secure-token'
                },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === "ok") {
                    console.log("Sent to Emacs successfully", data.result);
                } else {
                    console.warn("POST failed, fallback to paw_get_org_protocol_link");
                    paw_get_org_protocol_link(item, parent, body_selection_html, body_selection_text);
                }
            })
            .catch(err => {
                console.warn("Fetch failed, fallback to paw_get_org_protocol_link", err);
                paw_get_org_protocol_link(item, parent, body_selection_html, body_selection_text);
            });
        }

        if (params.download === true) {
            send_html_to_python((downloadData) => {
                payload.html_file = downloadData.temp_file_path;
                sendPayload();
            });
        } else {
            sendPayload();
        }

        // Handle deselect
        if (params.deselect === true) {
            deselect();
        }
    });
}



/**
 * Build a structured selection snapshot for embedding apps.
 * @returns {{url:string,title:string,note:string,body:string}|string}
 */
function paw_new_entry(selectedNode) {
    console.log("paw_new_entry", selectedNode);
    var selection;
    if (selectedNode !== undefined) {
        // get the passed node textContent directly
        selection = selectedNode.textContent;
    } else {
        // get the selected node textContent
        selection = window.getSelection().toString();
    }
    if (selection.length > 0) {
        var url = window.location.href;
        var title = document.title || "[untitled page]";
        var body = selection;
        var parent;
        if (selectedNode !== undefined) {
            // use the passed node's parentNode directly
            parent = selectedNode.parentNode;
        } else {
            // get the selected node's parentNode
            parent = window.getSelection().getRangeAt(0).commonAncestorContainer.parentNode;
        }

        // get a element node first
        while (parent.nodeType !== Node.ELEMENT_NODE) {
            parent = parent.parentNode;
        }

        // get until p tag
        var p_tag_parent = parent;
        while (p_tag_parent.tagName !== undefined && p_tag_parent.tagName !== 'P') {
            p_tag_parent = p_tag_parent.parentNode;
        }
        if (p_tag_parent !== document) {
            parent = p_tag_parent;
        }

        var note = parent.textContent || "";
        var data = {
            "url": url,
            "title": title,
            "note": note,
            "body": body
        };

        return data;
    } else {
        return "";
    }
}

var initSettings = {
    toggle: true,
    ttsToggle: true,
    ttsVoices: {
        lang: "en",
    },
    highlightBackground: "#ffe895",
    highlightText: "",
    bubbleBackground: "#FFE4C4",
    bubbleText: "",
    syncTime: 0,
    //生词本类型，0有道,1欧路
    dictionaryType: 0,
    autoSync: true,
    cookie: false,
};


//生词本
var newWords;
//当前要显示的节点
var currNode;
//鼠标节点（实时）
var mouseNode;
//已经显示了的节点
var showedNode;
//是否允许隐藏气泡
var isAllowHideBubble = true;
//气泡显示/隐藏延迟时间(ms)
var delayed = 100;
//生词信息列表
var currWord;
var currWordData;

/**
 * 初始化
 */
/**
 * Upload full page HTML to paw-server /source.
 * @param {(data: {temp_file_path: string})=>void} callback
 */
function send_html_to_python(callback) {
    api.storage.sync.get('server', function(data) {
        let server = data.server || "http://localhost:5001";
        fetch(`${server}/source`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ source: document.documentElement.outerHTML })
        })
            .then(response => response.json())
            .then(data => {
                callback(data);
            })
            .catch(error => {
                console.error('Error sending source:', error);
            });
    });
}


/** Save current page to Wallabag via paw-server proxy. */
function save_to_wallabag() {
  api.storage.sync.get('server', function(data) {
    let server = data.server || "http://localhost:5001";
    let url = window.location.href;
    let title = document.title;
    let content = document.documentElement.outerHTML;

    fetch(`${server}/wallabag/entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: url, title: title, content: content })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Entry sent:', data);
        alert("Saved to Wallabag");
    })
    .catch(error => {
      console.error('Error sending entry:', error);
    });
  });
}


/** Fetch words from server and highlight matches in DOM, then create bubble. */
function highlight_words() {
    api.storage.sync.get('server', function(data) {
        let server = data.server || "http://localhost:5001";
        //从localstorege获取生词列表，高亮所有匹配的节点
        // var before = new Date().getTime()
        // newWords = {
        //     wordInfos: {
        //         companies: {
        //             word: "companies",
        //             origin_path: "[halo]",
        //             note: "你好",
        //         }
        //     }
        // };
        fetch(`${server}/words`)
            .then(response => response.json())
            .then(data => {
                // console.log(JSON.stringify(data, null, 2));

                newWords = data;
                // console.log(newWords);

                // renable the new word css if it exists
                $(`xqdd_highlight_new_word`).attr("class", "xqdd_highlight_new_word");

                highlight(textNodesUnder(document.body, mygoodfilter));
                //console.log("解析总耗时：" + (new Date().getTime() - before) + " ms")
                console.log("Highlight done");

                //在插入节点时修改
                // document.addEventListener("DOMNodeInserted", onNodeInserted, false);
                // setStyle(initSettings);

                // console.log("setStyle done");

                //创建鼠标悬浮气泡
                createBubble();
                console.log("createBubble done");

            })
            .catch(error => {
                console.error(error);
            });
    });
}

/*
 * Hide the word
 */
/** Remove highlight for a specific word. */
function paw_delete_word(word) {
    //取消高亮删除的单词
    $(`xqdd_highlight_new_word[word='${word}']`).attr("class", "xqdd_highlight_disable");
}


/**
 * Disable paw-annotation-mode
 */
/** Disable annotation related listeners and highlights. */
function paw_annotation_mode_disable() {

    // Disable sentence item click listener
    disable_clickable_word();
    disable_highlight();
}

/** Remove all automatic highlights. */
function disable_highlight() {
    //取消所有高亮
    console.log('disable auto highlight mode');
    $(`xqdd_highlight_new_word`).attr("class", "xqdd_highlight_disable");
}

/**
 * 创建鼠标悬浮气泡
 */
/** Create and attach info bubble UI for highlighted words. */
function createBubble() {
    //创建添加到body中
    var div = $("<div>").attr("class", "xqdd_bubble");

    var checkButton = $("<span>")
        .attr("class", "xqdd_bubble_check")
        .text("✔")
        .click(() => {
            var $currentNode = $(`xqdd_highlight_new_word[word='${currWordData.word}']`);
            if ($currentNode.length > 0) {
                var element = $currentNode[0]; // Get the actual DOM element from jQuery object
                var range = document.createRange();
                var selection = window.getSelection();

                // Clear any existing selections
                selection.removeAllRanges();

                // Set the range to encompass the content of the element
                range.selectNodeContents(element);

                // Add the range to the selection
                selection.addRange(range);

                send_to_paw();

                selection.removeAllRanges();
            }

        });

    var deleteButton = $("<span>")
        .attr("class", "xqdd_bubble_delete")
        .text("✖")
        .click(() => {
            if (window.confirm(`Delete word: ${currWordData.word}?`)) {
                api.storage.sync.get('server', function(data) {
                    let server = data.server || "http://localhost:5001";
                    fetch(`${server}/words`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ word: currWordData.word })
                    })
                        .then(response => response.json())
                        .then(data => {
                            console.log(data);
                            //取消高亮删除的单词
                            // $(`xqdd_highlight_new_word[word='${currWordData.word}']`).attr("class", "xqdd_highlight_disable");
                            $(`xqdd_highlight_new_word[word='${currWordData.word}']`).each(function() {
                                $(this).replaceWith($(this).html());
                            });
                            if (data) {
                                alert(JSON.stringify(data));
                            }
                        })
                        .catch(error => {
                            console.error(error);
                        });
                });
            }
        });
    var word = $("<span>").attr("class", "xqdd_bubble_word");
    var exp = $("<span>").attr("class", "xqdd_bubble_exp");
    var origin_path = $("<span>").attr("class", "xqdd_bubble_origin_path");
    var note = $("<span>").attr("class", "xqdd_bubble_note");
    div.append(checkButton).append(deleteButton).append(word).append(exp).append(origin_path).append(note);
    $(document.body).append(div);

    //添加鼠标进入离开事件
    div.on("mouseleave", function (e) {
        hideBubbleDelayed();
    });
    div.on("mouseenter", function (e) {
        isAllowHideBubble = false;
    });

    //监听鼠标位置
    document.addEventListener("mousemove", handleMouseMove, false);
    // document.addEventListener("mousedown", hideBubble(), false)

    //监听窗口滚动
    window.addEventListener("scroll", function () {
        isAllowHideBubble = true;
        hideBubble();
    });
}

// FIXME Disable, unstable
// FIXME: unstable percent-based position calculation
function getButtonPositionPercentage(button) {
    const btnRect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    // Calculate the left and top position percentages
    const leftPercentage = (btnRect.left / viewportWidth) * 100;
    const topPercentage = (btnRect.top / viewportHeight) * 100;
    return {
        left: leftPercentage > 100 ? 100 : leftPercentage,
        top: topPercentage > 100 ? 100 : topPercentage
    };
}


let intervalId;
let isIntervalPaused = false;

/** Create floating "+" button, submenu, and context menu; wire events. */
function createButton() {
    // Create the floating button
    const button = document.createElement("button");
    button.innerText = "+";
    button.id = "floatingButton";
    // FIXME hide the button first, will show it after get the default postion
    // button.style.display = 'none';

    // Create the submenu
    const submenu = document.createElement("div");
    submenu.id = "submenu";
    submenu.style.display = "none"; // Initially hidden
    submenu.innerHTML = `
        <button class="submenu-item" id="pawEnableItem">Single-click</button>
        <button class="submenu-item" id="pawHighlight">Highlight</button>
        <button class="submenu-item" id="pawSendHtml">Save to Wallabag</button>
    `;
    // <button class="submenu-item" id="item2">Disable Single-click</button>
    // <button class="submenu-item" id="item3">Ask AI</button>


    // Create the context menu container
    let contextMenu = document.createElement('div');
    contextMenu.id = 'contextMenu';
    // Create the contextMenu
    api.storage.sync.get(['protocol'], function(data) {
        let protocolArray = paw_parse_protocol(data.protocol);
        // Add context menu items based on the protocol array
        for (let i in protocolArray.slice(1)) {
            let button = document.createElement('button');
            button.className = 'protocol-item';
            button.id = 'orgProtocolItem' + i;
            button.textContent = protocolArray.slice(1)[i].protocol;
            contextMenu.appendChild(button);
        }
        for (let i in protocolArray) {
            let button = document.createElement('button');
            button.className = 'submenu-item';
            button.id = 'submenuItem' + i;
            button.textContent = protocolArray[i].protocol;
            submenu.appendChild(button);
        }
        contextMenu.style.display = "none"; // Initially hidden
        if (window.self === window.top)  {
            // Append the contextMenu to the body
            if (protocolArray.slice(1).length > 0) {
                document.documentElement.appendChild(contextMenu);

                for (let i in protocolArray.slice(1)) {
                    // Add click event listeners for contextMenu items
                    document.getElementById("orgProtocolItem" + i).addEventListener("click", () => {
                        // Custom code for item 1
                        // Custom code for item 1
                        // alert('floatingButton clicked');

                        // console.log("Button Click");
                        send_to_paw(undefined, parseInt(i)+1);
                    });

                }
            }

            if (protocolArray.length > 0) {
                // Append the submenu to the body
                document.documentElement.appendChild(submenu);

                for (let i in protocolArray) {
                    // Add click event listeners for contextMenu items
                    document.getElementById("submenuItem" + i).addEventListener("click", () => {
                        // Custom code for item 1
                        // Custom code for item 1
                        // alert('floatingButton clicked');

                        // console.log("Button Click");
                        send_to_paw(undefined, parseInt(i), true);
                    });

                }
                // Add click event listeners for submenu items
                document.getElementById("pawEnableItem").addEventListener("click", () => {
                    // Custom code for item 1
                    // alert('Item 1 clicked');
                    toggleSingleClick();
                });
                // Add click event listeners for submenu items
                document.getElementById("pawSendHtml").addEventListener("click", () => {
                    // Custom code for item 1
                    // alert('Item 1 clicked');
                    save_to_wallabag();
                });

                // Add click event listeners for submenu items
                document.getElementById("pawHighlight").addEventListener("click", () => {
                    // Custom code for item 1
                    // alert('Item 1 clicked');
                    toggleHighlight();
                });

            }


        }
    });

    // only append to the topmost window, avoid append to frame or iframe
    if (window.self === window.top)  {
        // Append the button to the body
        document.documentElement.appendChild(button);
    }

    // Add draggable functionality
    let isDragging = false;
    let offsetX, offsetY;
    button.addEventListener('mouseup', (e) => {
        // console.log("Button Mouseup");
    });
    button.addEventListener('mousedown', (e) => {
        // console.log("Button Mousedown");
        isDragging = true;
        offsetX = e.clientX - button.getBoundingClientRect().left;
        offsetY = e.clientY - button.getBoundingClientRect().top;
    });
    document.addEventListener('mousemove', (e) => {
        // console.log("Document Mousemove");
        if (isDragging) {
            button.style.left = `${e.clientX - offsetX}px`;
            button.style.top = `${e.clientY - offsetY}px`;
        }
    });
    document.addEventListener('mouseup', async () => {
        // console.log("Document Mouseup");
        // $('body *').removeClass('click-underline').css('text-decoration', '');
        const spans = document.querySelectorAll('span.click-underline');
        spans.forEach(span => {
            // Replace the span with its own text content
            span.outerHTML = span.innerHTML;
        });

        isDragging = false;
    });
    document.addEventListener('touchend', async () => {
        // console.log("Document Mouseup");
        const spans = document.querySelectorAll('span.click-underline');
        spans.forEach(span => {
            // Replace the span with its own text content
            span.outerHTML = span.innerHTML;
        });

        isDragging = false;
    });

    intervalId = setInterval(async () => {
        if (isIntervalPaused) {
            return;
        } else {
            // console.log("Document Mouseup");
            await placeButtonAtSelection(button, submenu, contextMenu);
        }
        isDragging = false;
    }, 100);

    // Show/hide submenu on hover or click
    button.addEventListener('mouseenter', () => {
        // console.log("Button Mouseenter");
        // if selection, do not show submenu
        const selection = window.getSelection().toString();
        if (selection != '') {
            contextMenu.style.display = 'block';
            positionContextMenu(button, contextMenu);
        } else{
            submenu.style.display = 'block';
            positionSubmenu(button, submenu);
        }
    });
    button.addEventListener('mouseleave', () => {
        // console.log("Button Mouseleave");
        const selection = window.getSelection().toString();
        if (selection != '') {
            setTimeout(() => {
                if (!contextMenu.matches(':hover')) {
                    contextMenu.style.display = 'none';
                }
            }, 200);
        } else{
            setTimeout(() => {
                if (!submenu.matches(':hover')) {
                    submenu.style.display = 'none';
                }
            }, 200);
        }
    });
    submenu.addEventListener('mouseleave', () => {
        submenu.style.display = 'none';
    });
    contextMenu.addEventListener('mouseleave', () => {
        contextMenu.style.display = 'none';
    });

    button.addEventListener('touchstart', () => {
        const selection = window.getSelection().toString();
        if (selection != '') {
            contextMenu.style.display = 'block';
            positionContextMenu(button, contextMenu);
        } else{
            submenu.style.display = 'block';
            positionSubmenu(button, submenu);
        }
    });

    function positionSubmenu(button, submenu) {
        const btnRect = button.getBoundingClientRect();
        const submenuHeight = submenu.offsetHeight;
        const submenuWidth = submenu.offsetWidth;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        submenu.style.position = 'fixed';
        if (btnRect.bottom + submenuHeight > viewportHeight) {
            submenu.style.top = `${btnRect.top - submenuHeight - 10}px`;
        } else {
            submenu.style.top = `${btnRect.bottom + 10}px`;
        }
        if (btnRect.left + submenuWidth > viewportWidth) {
            submenu.style.left = `${btnRect.left - submenuWidth + button.offsetWidth}px`;
        } else {
            submenu.style.left = `${btnRect.left}px`;
        }
    }

    function positionContextMenu(button, contextMenu) {
        const btnRect = button.getBoundingClientRect();
        const contextMenuHeight = contextMenu.offsetHeight;
        const contextMenuWidth = contextMenu.offsetWidth;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        contextMenu.style.position = 'fixed';
        if (btnRect.bottom + contextMenuHeight > viewportHeight) {
            contextMenu.style.top = `${btnRect.top - contextMenuHeight - 10}px`;
        } else {
            contextMenu.style.top = `${btnRect.bottom + 10}px`;
        }
        if (btnRect.left + contextMenuWidth > viewportWidth) {
            contextMenu.style.left = `${btnRect.left - contextMenuWidth + button.offsetWidth}px`;
        } else {
            contextMenu.style.left = `${btnRect.left}px`;
        }
    }


    // Add click event listeners for submenu items
    button.addEventListener("click", () => {
        // Custom code for item 1
        // alert('floatingButton clicked');

        // console.log("Button Click");
        send_to_paw();

    });

}

/** Remove floating button and related menus; stop timers. */
function deleteButton() {
    // Clear the interval to stop repeated execution
    clearInterval(intervalId);

    const floatingButton = document.getElementById("floatingButton");

    if (floatingButton) {
        // Create a copy without event listeners
        const newButton = floatingButton.cloneNode(true);
        floatingButton.replaceWith(newButton); // Replace original with the cloned button

        // Now remove the newly cloned button
        newButton.remove();
    }

    // 删除子菜单
    const submenu = document.getElementById("submenu");
    if (submenu) {
        submenu.remove();
    }

    // 删除上下文菜单
    const contextMenu = document.getElementById("contextMenu");
    if (contextMenu) {
        contextMenu.remove();
    }
}

/** Position floating button relative to current selection, else reset. */
async function placeButtonAtSelection(button, submenu, contextMenu) {
    // after selection, set the button position relative to selection area
    const selection = window.getSelection();
    if (selection.toString().length > 0) { // Check if there is a text selection
        await positionButtonAtSelection();
    } else {
        resetButtonPosition(button, submenu, contextMenu);
    }
    // FIXME Unstable
    // let buttonPostionPercentage = getButtonPositionPercentage(button);
    // api.storage.sync.set({ defaultFloatingButtonLeft: `${buttonPostionPercentage.left}%`, defaultFloatingButtonTop: `${buttonPostionPercentage.top}%` } , function() {
    //     // console.log('Button postion saved:', `${buttonPostionPercentage.left}%`, `${buttonPostionPercentage.top}%`);
    // });
}

/** Reset floating button to default or stored position. */
function resetButtonPosition(button, submenu, contextMenu) {
    api.storage.sync.get(['defaultFloatingButtonLeft', 'defaultFloatingButtonTop'], function(data) {
        let defaultFloatingButtonLeft = data.defaultFloatingButtonLeft;
        let defaultFloatingButtonTop = data.defaultFloatingButtonTop;
        if (defaultFloatingButtonLeft != '' && defaultFloatingButtonTop != '') {
            button.style.left = defaultFloatingButtonLeft;
            button.style.top = defaultFloatingButtonTop;
        } else {
            button.style.left = '';
            button.style.top = '';
            button.style.bottom = '15px';
            button.style.right = '10px';
        }
        button.style.display = "block";  // Make the button visible
        // submenu.style.display = 'none';
        contextMenu.style.display = 'none';
    });
}

/** Toggle single-click mode from submenu. */
function toggleSingleClick() {
    const enableItem = document.getElementById("pawEnableItem");
    if (enableItem.style.color === "rgb(127, 255, 0)") {
        disable_clickable_word();
        enableItem.style.color = "white";
    } else {
        monitor_and_close_premium_popup();
        enable_clickable_word();
        enableItem.style.color = "#7fff00";
    }
}

/** Toggle highlight mode from submenu. */
function toggleHighlight() {
    const highlightItem = document.getElementById("pawHighlight");
    if (highlightItem.style.color === "rgb(127, 255, 0)") {
        disable_highlight();
        highlightItem.style.color = "white";
    } else {
        highlight_words();
        highlightItem.style.color = "#7fff00";
    }
}


// Function to underline selected text and then deselect the text
/** Underline current selection visually and clear selection. */
function underlineSelectionAndDeselect() {
    // Clear existing underlines by removing the class and style
    // document.querySelectorAll('.click-underline').forEach(el => {
    //     let parent = el.parentNode;
    //     while (el.firstChild) {
    //         parent.insertBefore(el.firstChild, el);
    //     }
    //     parent.removeChild(el);
    // });

    // const spans = document.querySelectorAll('span.click-underline');
    // spans.forEach(span => {
    //     // Replace span with its own text content
    //     const textNode = document.createTextNode(span.textContent);
    //     // Insert the text content before the span
    //     span.parentNode.insertBefore(textNode, span);
    //     // Remove the span
    //     span.parentNode.removeChild(span);
    // });

    // Get all spans with the class 'click-underline'
    const spans = document.querySelectorAll('span.click-underline');
    spans.forEach(span => {
        // Replace the span with its own text content
        span.outerHTML = span.innerHTML;
    });
    // Get the user's text selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return;  // Exit if no text is selected
    }
    // Get the range of the selected text
    const range = selection.getRangeAt(0);
    // Extract the contents of the selection
    const selectedContents = range.extractContents();
    // Create a new span element to wrap the selected text
    const span = document.createElement('span');
    span.className = 'click-underline';
    span.style.textDecoration = 'underline';
    // Append the extracted contents to the span
    span.appendChild(selectedContents);
    // Insert the span back into the document at the selected range
    range.insertNode(span);
    // Clear the text selection
    selection.removeAllRanges();
}

/** Clear any current text selection. */
function deselect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return;  // Exit if no text is selected
    }
    selection.removeAllRanges();
}



/** Get bounding client rect of current selection if present. */
function getSelectionBoundaryPosition() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height
    };
}

// Async function to position the button at the selected text
/** Compute and apply button position next to selection using offsets. */
async function positionButtonAtSelection() {
    const boundary = getSelectionBoundaryPosition();
    const button = document.getElementById("floatingButton");
    if (boundary) {
        const settings = await getFloatingButtonSettings();
        const floatingButtonLeft = parseInt(settings['floatingButtonLeft'] || '10');
        const floatingButtonTop = parseInt(settings['floatingButtonTop'] || '-10');
        if (boundary.right > 0 && boundary.top > 0) {
            button.style.left = `${boundary.right + floatingButtonLeft}px`;
            button.style.top = `${boundary.top - button.offsetHeight + floatingButtonTop}px`;
        } else if (boundary.right > 0 && boundary.bottom > 0) {
            button.style.left = `${boundary.right + floatingButtonLeft}px`;
            button.style.top = `${boundary.bottom - button.offsetHeight + floatingButtonTop}px`;
        } else {
            api.storage.sync.get(['defaultFloatingButtonLeft', 'defaultFloatingButtonTop'], function(data) {
                button.style.left = `${boundary.right + floatingButtonLeft}px`;
                button.style.top = `${boundary.bottom - button.offsetHeight + floatingButtonTop}px`;
            });
        }
        button.style.display = "block";  // Make the button visible
    }
}


/**
 * 显示气泡
 */
/** Show info bubble near current highlighted node. */
function showBubble() {
    if (!!currNode) {
        var bubble = $(".xqdd_bubble");
        if (showedNode != currNode || bubble.css("display") != "flex") {
            var nodeRect = currNode.getBoundingClientRect();
            var word = $(currNode).text();
            var wordInfo = newWords.wordInfos[word.toLowerCase()];
            $(".xqdd_bubble_word").html((wordInfo.link ? wordInfo.link : wordInfo.word));
            $(".xqdd_bubble_exp").html(`<span>${wordInfo["exp"]}</span>`);
            $(".xqdd_bubble_origin_path").html(`<span>${wordInfo["origin_path"]}</span>`);
            $(".xqdd_bubble_note").html(wordInfo["note"]);
            currWord = wordInfo["word"];
            currWordData = wordInfo;
            bubble
                .css("top", nodeRect.bottom + 'px')
                .css("left", Math.max(5, Math.floor((nodeRect.left + nodeRect.right) / 2) - 100) + 'px')
                .css("display", 'flex');
            // chrome.runtime.sendMessage({type: "tts", word});
            showedNode = currNode;
        }
    }
}

/**
 * 处理鼠标移动
 * @param e
 */
/** Track mouse over highlight to show/hide bubble with debounce. */
function handleMouseMove(e) {
    //获取鼠标所在节点
    mouseNode = document.elementFromPoint(e.clientX, e.clientY);
    if (!mouseNode) {
        hideBubbleDelayed(mouseNode);
        return;
    }
    var classAttr = "";
    try {
        classAttr = mouseNode.getAttribute("class");
    } catch (exc) {
        hideBubbleDelayed(mouseNode);
        return;
    }
    if (!classAttr || !classAttr.startsWith("xqdd_")) {
        hideBubbleDelayed(mouseNode);
        return;
    }
    isAllowHideBubble = false;
    if (!classAttr.startsWith("xqdd_highlight_new_word")) {
        return;
    }
    currNode = mouseNode;
    //延迟显示（防止鼠标一闪而过的情况）
    setTimeout(function () {
        //是本节点
        if (currNode == mouseNode) {
            showBubble();
        }
        //非本节点
        else if ($(mouseNode).attr("class") && !$(mouseNode).attr("class").startsWith("xqdd_")) {
            isAllowHideBubble = true;
        }
    }, delayed);
}

/**
 * 延迟隐藏气泡
 */
/** Debounced hide for bubble unless pointer remains within bubble. */
function hideBubbleDelayed(mouseNode) {
    if (!isAllowHideBubble) {
        if (mouseNode) {
            if ($(mouseNode).parents(".xqdd_bubble").length > 0) {
                return;
            }
        }
        isAllowHideBubble = true;
        setTimeout(function () {
            hideBubble();
        }, delayed);
    }
}


/**
 * 隐藏气泡
 */
/** Hide the bubble immediately. */
function hideBubble() {
    if (isAllowHideBubble) {
        $(".xqdd_bubble").css("display", "none");
    }
}

/**
 *
 * @param nodes 高亮所有节点
 *
 */
/** Iterate text nodes and replace with highlighted markup where matched. */
function highlight(nodes) {
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var text = node.textContent;
        if (text.trim() == "") {
            continue;
        }
        //处理单个节点
        //新节点的内容
        var newNodeChildrens = highlightNode(text);
        var parent_node = node.parentNode;
        //替换新节点
        if (newNodeChildrens === undefined || newNodeChildrens.length == 0) {
            continue;
        } else {
            // console.log(newNodeChildrens);
        }
        //处理a标签显示异常
        if (parent_node.tagName.toLowerCase() == "a") {
            parent_node.style.display = "inline-block";
            parent_node.style.margin = "auto";
        }
        for (var j = 0; j < newNodeChildrens.length; j++) {
            parent_node.insertBefore(newNodeChildrens[j], node);
        }
        parent_node.removeChild(node);
    }


}

/**
 * 高亮单个节点
 * @param text
 */
/** Tokenize a text node, wrap matched words, and return node list. */
function highlightNode(texts) {
    // console.log("highlightNode");
    // return [$("<span>").css("background", "red").text(texts)[0]]
    //将句子解析成待检测单词列表
    var words = [];
    //使用indexof
    //  var tempTexts = texts
    // while (tempTexts.length > 0) {
    //     tempTexts = tempTexts.trim()
    //     var pos = tempTexts.indexOf(" ")
    //     if (pos < 0) {
    //         words.push(tempTexts)
    //         break
    //     } else {
    //         words.push(tempTexts.slice(0, pos))
    //         tempTexts = tempTexts.slice(pos)
    //     }
    // }

    var tempTexts = [];
    var jaCharPattern = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/;
    if (window.location.hostname === 'www.lingq.com') {
        // 使用split, by space
        texts.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        tempTexts = texts.split(/\s/);
    } else if (jaCharPattern.test(texts)) {
        // Use Intl.Segmenter for CJK text
        const segmenter = new Intl.Segmenter("ja-JP", { granularity: 'word' });
        const segmentedText = segmenter.segment(texts);
        tempTexts = [...segmentedText].filter(s => s.isWordLike).map(s => s.segment);
    } else {
        // Use split for other languages
        texts.replace(/[.,\/#!$%\^&\*;:{}=_`~()]/g,""); // not including -
        tempTexts = texts.split(/\s/);
    }

    // console.log(tempTexts)
    for (i in tempTexts) {
        var tempText = tempTexts[i].trim();
        if (tempText != "") {
            words.push(tempText);
        }
    }

    if (words.length >= 1) {
        //处理后结果
        var newNodeChildrens = [];
        //剩下未处理的字符串
        var remainTexts = texts;
        //已处理部分字符串
        var checkedText = "";
        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            //当前所处位置
            var currPos = remainTexts.indexOf(word);
            //匹配单词
            // if (newWords.indexOf(word.toLowerCase()) !== -1) {
            // console.log(newWords);
            // not only lowercase, but also original word
            if (newWords && newWords.wordInfos && (newWords.wordInfos.hasOwnProperty(word.toLowerCase()) || newWords.wordInfos.hasOwnProperty(word))) {
                // console.log(newWords.wordInfos);
                //匹配成功
                //添加已处理部分到节点
                if (checkedText != "") {
                    newNodeChildrens.push(document.createTextNode(checkedText));
                    checkedText = "";
                }
                if (currPos == 0) {
                    // wordxx类型
                    newNodeChildrens.push(hightlightText(word));
                } else {
                    //xxwordxx类型
                    // var preText = remainTexts.slice(0, currPos)
                    // if (i == 0 && preText.trim() == " ") {
                    //     //处理<xx> <xxx>之间的空格问题
                    //     newNodeChildrens.push($("<span>").text(preText)[0])
                    // } else {
                    newNodeChildrens.push(document.createTextNode(remainTexts.slice(0, currPos)));
                    // }
                    newNodeChildrens.push(hightlightText(word));
                }
                // chrome.runtime.sendMessage({type: "count", word})
            } else {
                //匹配失败，追加到已处理字符串
                checkedText += remainTexts.slice(0, currPos + word.length);
            }
            //删除已处理的字符(到当前单词的位置)
            remainTexts = remainTexts.slice(currPos + word.length);
        }
        //处理最末尾
        if (newNodeChildrens.length != 0) {
            if (checkedText != "") {
                newNodeChildrens.push(document.createTextNode(checkedText));
            }
            newNodeChildrens.push(document.createTextNode(remainTexts));
        }
    }
    return newNodeChildrens;
}


/**
 * 高亮单个单词
 * @param text
 * @returns {*}
 */
/** Wrap a matched word with custom highlight element. */
function hightlightText(text) {
    // console.log("hightlightText");
    //注意jqury对象转为dom对象使用[0]或者.get(0)
    return $("<xqdd_highlight_new_word>")
        .attr("word", text.toLowerCase())
        .attr("class", "xqdd_highlight_new_word")
        .text(text)[0];
}


/**
 * 过滤所有文本节点
 * @param el
 * @returns {Array}
 */
/** Collect text nodes under element using a TreeWalker and filter. */
function textNodesUnder(el, filter) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker
    var n, a = [],
        walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, filter, false);
    while (n = walk.nextNode()) {
        a.push(n);
    }
    return a;
}


/**
 * 节点过滤器
 * @param node
 * @returns {number}
 */
/** Filter for acceptable parent tag names when auto highlighting. */
function mygoodfilter(node) {
    var good_tags_list = [
        "PRE",
        "A",
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "B",
        "SMALL",
        "STRONG",
        "Q",
        "DIV",
        "SPAN",
        "LI",
        "TD",
        "OPTION",
        "I",
        "BUTTON",
        "UL",
        "CODE",
        "EM",
        "TH",
        "CITE",
        "RUBY" // nhk.com
    ];
    var excludedClassNames = ['xqdd_bubble', 'xqdd_bubble_word', 'xqdd_bubble_exp', 'xqdd_bubble_origin_path', 'xqdd_bubble_note']; // Add the class names to exclude here
    // Ensure node and node.parentNode are valid
    if (node && node.parentElement && good_tags_list.indexOf(node.parentElement.tagName) !== -1) {
        if (node.parentElement.classList) {
            for (var i = 0; i < excludedClassNames.length; i++) {
                if (node.parentElement.classList.contains(excludedClassNames[i])) {
                    return NodeFilter.FILTER_SKIP;
                }
            }
        }
        return NodeFilter.FILTER_ACCEPT;
    }
    return NodeFilter.FILTER_SKIP;
}



/**
 * 节点过滤器
 * @param node
 * @returns {number}
 */
/** Filter for acceptable parent tag names when making words clickable. */
function clickablefilter(node) {
    var good_tags_list = [
        "PRE",
        // "A",
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "B",
        "SMALL",
        "STRONG",
        "Q",
        "DIV",
        "SPAN",
        "LI",
        "TD",
        "OPTION",
        "I",
        // "BUTTON",
        "UL",
        "CODE",
        "EM",
        "TH",
        // "CITE",
        "RUBY" // nhk.com
    ];
    if (good_tags_list.indexOf(node.parentNode.tagName) !== -1) {
        return NodeFilter.FILTER_ACCEPT;
    } else {
        return NodeFilter.FILTER_SKIP;
    }
}

/**
 * LingQ specific functions
 *
 */

/**
 * Close lingq Go Premium button
 */
/** LingQ: close premium modal and widget automatically when present. */
function monitor_and_close_premium_popup () {
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                var modalContainer = $(".modal-container");
                if (modalContainer.length > 0) {
                    if (modalContainer.find(".button.is-white.is-rounded.has-icon.is-small")[0] !== undefined) {
                        $(".modal-container").find(".button.is-white.is-rounded.has-icon.is-small")[0].click();
                    }
                }
                var readerWidget = $(".reader-widget");
                if (readerWidget.length > 0) {
                    if (readerWidget.find(".button.widget-close-trigger")[0] !== undefined) {
                        $(".reader-widget").find(".button.widget-close-trigger")[0].click();
                    }
                }

            }
        });
    });
    var config = { attributes: true, childList: true, subtree: true };
    observer.observe(document.body, config);
}


/** Wrap words in clickable spans inside matched selector. */
function addInteractivity (selector) {
    $(selector).each(function() {
        if (!clickablefilter(this)) {
            return; // Skip unmatched nodes and their child nodes
        }
        const nodes = textNodesUnder(this, clickablefilter);
        nodes.forEach(function(node) {
            let segmenter = new Intl.Segmenter([], { granularity: 'word' });
            let segments = segmenter.segment(node.textContent);
            let wrappedText = "";
            for(let {segment} of segments) {
                if (segment.trim() !== "") { // Exclude spaces
                    wrappedText += `<span class='clickable-word'>${segment}</span>`;
                } else {
                    wrappedText += segment;
                }
            }
            $(node).replaceWith($.parseHTML(wrappedText));
        });
    });
};

var lingqIsSelectedObserver; // Define in a scope accessible by both functions
/**
 * when single click the sentence item, send to paw
 */
/** Enable single-click to send on supported sites or generic pages. */
function enable_clickable_word() {
    if(window.location.hostname === 'www3.nhk.or.jp') {
        addInteractivity("span[class^='color']");
    } else if(window.location.hostname === 'www.lingq.com') {
        lingqIsSelectedObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    var targetElement = mutation.target;
                    if (targetElement.tagName.toLowerCase() === 'span' && targetElement.classList.contains('is-selected')) {
                        // console.log(targetElement);
                        send_to_paw(targetElement);
                        if (window.pyobject !== undefined) {
                            window.pyobject.paw_view_note(paw_new_entry(targetElement));
                        }
                        selection.removeAllRanges();
                    }
                }
            });
        });
        lingqIsSelectedObserver.observe(document.body, { attributes: true, subtree: true });
    } else {
        addInteractivity(document.body);
    }

    $('.clickable-word').click(function() {
        var selection = window.getSelection(),
            range = document.createRange();
        range.selectNodeContents(this);
        selection.removeAllRanges();
        selection.addRange(range);
        send_to_paw();
        if (window.pyobject !== undefined) {
            window.pyobject.paw_view_note(paw_new_entry());
        }
        selection.removeAllRanges();
        $('body *').removeClass('click-underline').css('text-decoration', 'none');
        $(this).addClass('click-underline').css('text-decoration', 'underline');
    });

    let startX, startY, startTime;
    let isDragging = false;
    function isTouchClick(startX, startY, endX, endY, startTime, endTime) {
        // Check the duration is less than 500ms for a quick tap
        let duration = endTime - startTime;
        // Ensure the movement is minimal
        let distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        return duration < 500 && distance < 5;
    }
    $('.clickable-word').on('touchstart', function(event) {
        // Record the starting touch coordinates
        let touch = event.originalEvent.touches[0];
        startX = touch.pageX;
        startY = touch.pageY;
        startTime = new Date().getTime();
        isDragging = false;
    });
    $('.clickable-word').on('touchmove', function(event) {
        let touch = event.originalEvent.touches[0];
        let currentX = touch.pageX;
        let currentY = touch.pageY;
        let distance = Math.sqrt((currentX - startX) ** 2 + (currentY - startY) ** 2);
        // If the movement is significant, set isDragging to true
        if (distance > 10) {
            isDragging = true;
        }
    });
    $('.clickable-word').on('touchend', function(event) {
        // Get the ending touch coordinates and the end time
        let touch = event.originalEvent.changedTouches[0];
        let endX = touch.pageX;
        let endY = touch.pageY;
        let endTime = new Date().getTime();
        // Check if it was a simple tap
        if (!isDragging && isTouchClick(startX, startY, endX, endY, startTime, endTime)) {
            // Execute your touch click logic here
            var selection = window.getSelection(),
                range = document.createRange();
            range.selectNodeContents(this);
            selection.removeAllRanges();
            selection.addRange(range);
            send_to_paw();
            try {
                if (window.pyobject !== undefined) {
                    window.pyobject.paw_view_note(paw_new_entry());
                }
                selection.removeAllRanges();
                $('body *').removeClass('click-underline').css('text-decoration', 'none');
                $(this).addClass('click-underline').css('text-decoration', 'underline');
            } catch (e) {
                console.error(e);
            }
        }
    });

    $(".clickable-word").on({
        mouseover: function() {
            $(this).css("text-decoration", "underline");
        },
        mouseout: function() {
            if (!$(this).hasClass('click-underline')) {
                $(this).css('text-decoration', 'none');
            }
        }
    });
}

/** Disable single-click interactions and observers. */
function disable_clickable_word() {
    $(".clickable-word").off("click mouseover mouseout touchstart touchend touchmove").css("background-color", "");
    if (lingqIsSelectedObserver) {
        lingqIsSelectedObserver.disconnect();
    }
}


// 注入到页面主 world
/** Inject site bridge script into page world (e.g., Netflix). */
function waitForNetflixAndExpose() {
    // 创建 <script> 注入到页面主世界
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('netflix-bridge.js');
    s.onload = () => s.remove(); // 加载后删除标签
    document.documentElement.appendChild(s);
}


function test (){
    var selection = window.getSelection().toString();
    if (selection.length > 0) {
        var url = encodeURIComponent(window.location.href);
        var title = encodeURIComponent(document.title || "[untitled page]");
        var body = encodeURIComponent(selection);
        var parent = window.getSelection().getRangeAt(0).commonAncestorContainer.parentNode;

        // get a element node first
        while (parent.nodeType !== Node.ELEMENT_NODE) {
            parent = parent.parentNode;
        }

        // get until p tag
        var p_tag_parent = parent;
        while (p_tag_parent.tagName !== undefined && p_tag_parent.tagName !== 'P') {
            p_tag_parent = p_tag_parent.parentNode;
        }
        if (p_tag_parent !== document) {
            parent = p_tag_parent;
        }

        var note = encodeURIComponent(parent.textContent || "");
        location.href = 'org-protocol://paw?template=w&url=' + url + '&title=' + title + '&note=' + note + '&body=' + body;
    }
}
