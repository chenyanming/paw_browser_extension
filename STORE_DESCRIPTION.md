Paw: Enhanced Text Interaction for Emacs Integration

Transform your web browsing experience with Paw, a powerful browser extension that seamlessly integrates with Emacs through org-protocol. Capture text selections, context, and HTML content with intuitive interactions—all designed to boost your productivity.


KEY FEATURES

🎯 Smart Text Capture
- Hover & Click Interaction: Underline words on mouseover and capture them with a simple click
- Flexible Selection: Select entire passages or single words—the extension captures both text and surrounding context
- Context-Aware: Automatically identifies and captures the parent context (e.g., paragraph) for better note organisation

⚡ Floating Action Button
- Quick Access: A convenient floating "+" button appears near your text selections
- Multiple Protocols: Access all configured org-protocols through an intuitive submenu
- Customisable Position: Adjust button offsets to suit your workflow
- Smart Visibility: Show/hide the button based on your preferences, with automatic display when text is selected

⌨️ Keyboard Shortcuts
- Instant Capture: Use customisable keyboard shortcuts (e.g., Alt + S) to grab the word under your caret
- Configurable Modifiers: Choose between None, Ctrl, or Alt modifiers
- Efficient Workflow: Send selections to Emacs without leaving the keyboard

🗂️ Tab Manager
- Capture & Close: Capture the current tab or all tabs in a window — tabs are closed and saved into named sections
- Drag & Drop: Reorder individual tabs within and across sections, or reorder entire sections
- Send to Emacs: Send a single tab, an entire section, or a batch of selected tabs to Emacs via paw-server
- Multi-Format Link Copy: Copy links as Org-mode [[url][title]], Markdown [title](url), or plain URLs
- Multi-Select: Checkbox selection per tab or per section for bulk actions
- Live Manager: The tab manager page updates in real time as new tabs are captured

🔧 Customisable Org-Protocol Support
- Multiple Protocols: Configure unlimited org-protocols using comma-separated format or JSON arrays
- Format Options: Choose between text, HTML, or Markdown formats for captured content
- Advanced Configuration: Support for download (save full page HTML) and deselect (clear selection after capture)
- JSON Editor: The Options page displays Protocol(s) as prettified JSON with live validation
- Example: [{"protocol": "paw", "format": "text"}, {"protocol": "anki", "format": "html"}]

🖱️ Single-Click Mode
- Word-Level Interaction: Enable single-click mode to wrap and capture individual words instantly
- Toggleable: Turn on/off from the popup or options page

🎨 Auto-Highlight
- Visual Feedback: Automatically highlight known words on web pages
- Server Integration: Works with optional paw-server to display your vocabulary or saved words
- Info Bubbles: Hover over highlighted words to see additional information

📋 Rich Content Support
- HTML Content: Send selected HTML content to Emacs for advanced processing
- Full Page Capture: Optionally download entire page HTML for archival
- Text & Context: Captures URL, page title, selected text, and surrounding paragraph

🌐 Server Integration (Optional)
- paw-server Support: Connect to a local Python Flask server for advanced features
- Endpoints: POST /paw for selections, GET /words for highlights, POST /source for full HTML
- Fallback: Automatically falls back to org-protocol if the server is unavailable


PERFECT FOR

- Emacs Users: Seamlessly integrate your browser with Emacs workflows
- Note-Takers: Quickly capture web content with full context
- Researchers: Save selections with URLs and metadata for reference
- Knowledge Workers: Build a personal knowledge base from web content
- Language Learners: Track vocabulary and phrases from online reading


CONFIGURATION

Open the Options page (gear icon in the popup) to customise:
- Enable/disable extension, single-click mode, auto-highlight, and floating button
- Configure Protocol(s) with a prettified JSON editor and live validation
- Set keyboard shortcut and modifier keys
- Adjust floating button position offsets
- Configure org-protocol template variables (url, title, note, body)
- Set paw-server address (default: http://localhost:5001)


PRIVACY

✅ No data sent to external servers by default
✅ Optional local server integration only (paw-server on localhost)
✅ No usage analytics or tracking
✅ No third-party telemetry
✅ Open source — inspect the code yourself


EMACS PACKAGE INTEGRATION

- paw.el — Word and note management
- org-protocol — Capture web content directly into Org mode
- wallabag.el — Save articles to Wallabag
- calibredb.el — Open ebooks in browser


GET STARTED

1. Install the extension
2. Configure your org-protocols in the Options page
3. Select text on any webpage
4. Click the floating "+" button or use your keyboard shortcut
5. Watch your selection appear in Emacs via org-protocol!

Or capture entire browsing sessions: Capture All → organise in the Tab Manager → send to Emacs in one click.

Boost your productivity with seamless Emacs integration and powerful text interaction tools—all directly from your browser.

For detailed documentation, visit: https://github.com/chenyanming/paw_browser_extension
