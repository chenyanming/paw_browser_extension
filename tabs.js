/**
 * PAW Tab Manager
 *
 * OneTab-style captured tab manager with:
 * - Sections (groups) with editable names
 * - Drag-and-drop reordering within / across sections
 * - Per-tab and per-section "Send →Emacs" via paw-server POST
 * - Multi-select checkboxes for batch send
 * - Protocol selector synced with extension settings
 * - Live update when background captures new tabs
 */
const api = (typeof browser !== 'undefined') ? browser : chrome;

// ── State ────────────────────────────────────────────────────────────────────
let sections        = [];
let protocolArray   = [];
let currentProtoIdx = 0;
let serverUrl       = 'http://localhost:5001';
let templateKey     = 'w';

// ── Protocol parser (mirrors content.js / popup.js) ─────────────────────────
function paw_parse_protocol(text) {
    try {
        const p = JSON.parse(text);
        return Array.isArray(p) ? p : [p];
    } catch (_) {
        return (text || 'paw').split(',').map(s => ({ protocol: s.trim() }));
    }
}

// ── Initialise ───────────────────────────────────────────────────────────────
async function init() {
    const sync = await new Promise(r =>
        api.storage.sync.get(['protocol', 'server', 'template'], r)
    );
    serverUrl     = sync.server   || 'http://localhost:5001';
    templateKey   = sync.template || 'w';
    protocolArray = paw_parse_protocol(sync.protocol || 'paw');

    const sel = document.getElementById('protocolSelect');
    protocolArray.forEach((p, i) => {
        const opt = document.createElement('option');
        opt.value       = i;
        opt.textContent = p.protocol || 'Protocol ' + i;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
        currentProtoIdx = parseInt(sel.value, 10);
    });

    const local = await new Promise(r =>
        api.storage.local.get({ pawTabSections: [] }, r)
    );
    sections = local.pawTabSections;
    render();
}

// ── Persist & re-render ──────────────────────────────────────────────────────
function saveAndRender() {
    api.storage.local.set({ pawTabSections: sections });
    render();
}

// ── Send a single tab to Emacs via paw-server ────────────────────────────────
async function sendTabToEmacs(tab, protoIdx) {
    const params = protocolArray[protoIdx] || protocolArray[0] || { protocol: 'paw' };
    const payload = {
        protocol: params.protocol || 'paw',
        url:      tab.url,
        title:    tab.title,
        note:     '',
        body:     '',
        format:   params.format || 'text',
        template: templateKey
    };
    try {
        const res = await fetch(`${serverUrl}/paw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token':  'your-secure-token'
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) return false;
        const data = await res.json();
        return data.status === 'ok';
    } catch (err) {
        console.error('PAW send failed:', err);
        return false;
    }
}

// ── HTML escaping ────────────────────────────────────────────────────────────
function esc(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── Drag state ───────────────────────────────────────────────────────────────
let dragTabId     = null;
let dragSectionId = null;
let dragSecId     = null;  // section-level drag

// ── Copy helpers ─────────────────────────────────────────────────────────────
function formatLinks(tabs, fmt) {
    switch (fmt) {
        case 'org': return tabs.map(t => `[[${t.url}][${t.title || t.url}]]`).join('\n');
        case 'md':  return tabs.map(t => `[${(t.title || t.url).replace(/\[|\]/g, '')}](${t.url})`).join('\n');
        case 'url': return tabs.map(t => t.url).join('\n');
        default:    return tabs.map(t => t.url).join('\n');
    }
}

let _activeCopyMenu = null;
function closeCopyMenu() {
    if (_activeCopyMenu) { _activeCopyMenu.remove(); _activeCopyMenu = null; }
}

function showCopyMenu(triggerBtn, tabs) {
    closeCopyMenu();
    const menu = document.createElement('div');
    menu.className = 't-copy-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
        <button data-fmt="org" type="button" role="menuitem">
            <span class="t-copy-fmt-label">Org-mode</span>
            <code>[[url][title]]</code>
        </button>
        <button data-fmt="md" type="button" role="menuitem">
            <span class="t-copy-fmt-label">Markdown</span>
            <code>[title](url)</code>
        </button>
        <button data-fmt="url" type="button" role="menuitem">
            <span class="t-copy-fmt-label">Plain URL</span>
            <code>https://…</code>
        </button>`;

    document.body.appendChild(menu);
    _activeCopyMenu = menu;

    // Position below trigger, align right if near viewport edge
    const r = triggerBtn.getBoundingClientRect();
    menu.style.top  = `${r.bottom + window.scrollY + 4}px`;
    menu.style.left = `${r.left   + window.scrollX}px`;
    const mr = menu.getBoundingClientRect();
    if (mr.right > window.innerWidth - 8)
        menu.style.left = `${r.right + window.scrollX - menu.offsetWidth}px`;

    menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const text = formatLinks(tabs, btn.dataset.fmt);
            await navigator.clipboard.writeText(text);
            const origHTML = triggerBtn.innerHTML;
            triggerBtn.textContent = '✓ Copied!';
            setTimeout(() => { triggerBtn.innerHTML = origHTML; }, 2000);
            closeCopyMenu();
        });
    });
}

// Close copy menu on outside click or scroll
document.addEventListener('click',  (e) => { if (_activeCopyMenu && !_activeCopyMenu.contains(e.target)) closeCopyMenu(); }, true);
document.addEventListener('scroll', () => closeCopyMenu(), { passive: true });

// ── Create a single tab row element ─────────────────────────────────────────
function createTabEl(tab, sectionId) {
    const el       = document.createElement('div');
    el.className   = 't-tab-item';
    el.draggable   = true;
    el.dataset.tabId     = tab.id;
    el.dataset.sectionId = sectionId;

    const faviconHtml = tab.favIconUrl
        ? `<img class="t-favicon" src="${esc(tab.favIconUrl)}" loading="lazy" alt=""
               onerror="this.outerHTML='<span class=t-favicon-placeholder aria-hidden=true>?</span>'">`
        : `<span class="t-favicon-placeholder" aria-hidden="true">?</span>`;

    const shortUrl = (tab.url || '').length > 72
        ? tab.url.slice(0, 69) + '…'
        : tab.url;

    el.innerHTML = `
        <input type="checkbox" class="t-tab-checkbox" aria-label="Select tab: ${esc(tab.title || tab.url)}">
        ${faviconHtml}
        <div class="t-tab-info">
            <a class="t-tab-title" href="${esc(tab.url)}" target="_blank" rel="noopener"
               title="${esc(tab.title || tab.url)}">${esc(tab.title || tab.url)}</a>
            <span class="t-tab-url">${esc(shortUrl)}</span>
        </div>
        <div class="t-tab-actions" role="group" aria-label="Tab actions">
            <span class="t-send-pill" aria-live="polite"></span>
            <button class="t-tab-btn t-tab-btn-send" type="button" title="Send to Emacs"
                    aria-label="Send ${esc(tab.title || tab.url)} to Emacs">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2 8h10M9 5l4 3-4 3" stroke="currentColor" stroke-width="1.5"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button class="t-tab-btn t-tab-btn-copy" type="button" title="Copy link"
                    aria-label="Copy link for ${esc(tab.title || tab.url)}">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="5" y="3" width="8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
                    <path d="M3 5v8a1 1 0 001 1h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
            </button>
            <button class="t-tab-btn t-tab-btn-remove" type="button" title="Remove tab"
                    aria-label="Remove ${esc(tab.title || tab.url)}">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5"
                          stroke-linecap="round"/>
                </svg>
            </button>
        </div>`;

    // Send
    el.querySelector('.t-tab-btn-send').addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn  = e.currentTarget;
        const pill = el.querySelector('.t-send-pill');
        btn.disabled = true;
        const ok = await sendTabToEmacs(tab, currentProtoIdx);
        btn.disabled = false;
        pill.textContent = ok ? '✓ sent' : '✗ error';
        pill.className   = `t-send-pill ${ok ? 'ok' : 'fail'}`;
        setTimeout(() => {
            pill.className   = 't-send-pill';
            pill.textContent = '';
        }, 2500);
    });

    // Copy single tab link
    el.querySelector('.t-tab-btn-copy').addEventListener('click', (e) => {
        e.stopPropagation();
        showCopyMenu(e.currentTarget, [tab]);
    });

    // Remove tab
    el.querySelector('.t-tab-btn-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        const sec = sections.find(s => s.id === sectionId);
        if (sec) {
            sec.tabs = sec.tabs.filter(t => t.id !== tab.id);
            if (sec.tabs.length === 0) sections = sections.filter(s => s.id !== sec.id);
        }
        saveAndRender();
    });

    // ── Drag ────────────────────────────────────────────────────────────────
    el.addEventListener('dragstart', (e) => {
        dragTabId     = tab.id;
        dragSectionId = sectionId;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        dragTabId = dragSectionId = null;
        document.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over'));
    });

    el.addEventListener('dragover', (e) => {
        if (!dragTabId || dragTabId === tab.id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Clear other drag-over on sibling tabs
        el.closest('.t-tab-list')?.querySelectorAll('.t-tab-item.drag-over')
          .forEach(n => { if (n !== el) n.classList.remove('drag-over'); });
        el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', (e) => {
        if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
    });

    el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drag-over');
        if (!dragTabId || dragTabId === tab.id) return;

        const src = sections.find(s => s.id === dragSectionId);
        if (!src) return;
        const si = src.tabs.findIndex(t => t.id === dragTabId);
        if (si < 0) return;
        const [moved] = src.tabs.splice(si, 1);

        const dst = sections.find(s => s.id === sectionId);
        if (!dst) return;
        const di = dst.tabs.findIndex(t => t.id === tab.id);
        const rect = el.getBoundingClientRect();
        dst.tabs.splice(e.clientY < rect.top + rect.height / 2 ? di : di + 1, 0, moved);

        dragTabId = dragSectionId = null;
        saveAndRender();
    });

    return el;
}

// ── Render all sections ──────────────────────────────────────────────────────
function render() {
    const container = document.getElementById('sections');
    container.innerHTML = '';

    // Update header count
    const total = sections.reduce((n, s) => n + s.tabs.length, 0);
    const countEl = document.getElementById('totalCount');
    if (countEl) {
        countEl.textContent = total
            ? `${total} tab${total !== 1 ? 's' : ''} · ${sections.length} group${sections.length !== 1 ? 's' : ''}`
            : '';
    }

    if (sections.length === 0) {
        container.innerHTML = `
            <div class="t-empty" role="status">
                <div class="t-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 28 28" fill="none">
                        <rect x="3" y="6" width="22" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M3 10h22" stroke="currentColor" stroke-width="1.5"/>
                        <circle cx="7" cy="8" r="1" fill="currentColor"/>
                        <circle cx="11" cy="8" r="1" fill="currentColor"/>
                    </svg>
                </div>
                <p class="t-empty-title">No captured tabs yet</p>
                <p class="t-empty-body">
                    Click <strong>Capture Tab</strong> or <strong>Capture All</strong>
                    in the popup to save tabs here.
                </p>
            </div>`;
        return;
    }

    sections.forEach(section => {
        const count = section.tabs.length;

        const secEl       = document.createElement('div');
        secEl.className   = 't-section';
        secEl.dataset.sectionId = section.id;
        secEl.setAttribute('aria-label', `Section: ${section.name}, ${count} tab${count !== 1 ? 's' : ''}`);

        secEl.innerHTML = `
            <div class="t-section-header">
                <span class="t-section-drag" draggable="true"
                      title="Drag to reorder section" aria-label="Drag to reorder section"
                      role="button" tabindex="0">
                    <svg viewBox="0 0 8 12" fill="currentColor" aria-hidden="true">
                        <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                        <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
                        <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
                    </svg>
                </span>
                <input type="checkbox" class="t-section-checkbox"
                       title="Select / deselect all tabs in this section"
                       aria-label="Select all tabs in ${esc(section.name)}">
                <span class="t-section-name" contenteditable="true" spellcheck="false"
                      role="textbox" aria-label="Section name" aria-multiline="false"
                      title="Click to rename">${esc(section.name)}</span>
                <span class="t-tab-count">${count} tab${count !== 1 ? 's' : ''}</span>
                <div class="t-section-actions" role="group" aria-label="Section actions">
                    <button class="t-sec-btn t-sec-btn-send" type="button"
                            aria-label="Send all tabs in this section to Emacs">
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M2 8h10M9 5l4 3-4 3" stroke="currentColor" stroke-width="1.5"
                                  stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Send All
                    </button>
                    <button class="t-sec-btn t-sec-btn-copy" type="button"
                            aria-label="Copy all URLs in this section to clipboard">
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <rect x="5" y="3" width="8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
                            <path d="M3 5v8a1 1 0 001 1h6" stroke="currentColor" stroke-width="1.4"
                                  stroke-linecap="round"/>
                        </svg>
                        Copy URLs
                    </button>
                    <button class="t-sec-btn t-sec-btn-open" type="button"
                            aria-label="Open all tabs in this section">
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M7 4H4a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1v-3"
                                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <path d="M10 2h4v4M14 2l-6 6" stroke="currentColor" stroke-width="1.5"
                                  stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Open All
                    </button>
                    <button class="t-sec-btn t-sec-btn-del" type="button"
                            aria-label="Delete section ${esc(section.name)}">
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5"
                                  stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="t-tab-list" role="list" data-section-id="${section.id}"
                 aria-label="Tabs in ${esc(section.name)}"></div>`;

        const tabList = secEl.querySelector('.t-tab-list');
        section.tabs.forEach(tab => tabList.appendChild(createTabEl(tab, section.id)));

        // ── Section name editing ────────────────────────────────────────────
        const nameEl = secEl.querySelector('.t-section-name');
        nameEl.addEventListener('blur', () => {
            const val = nameEl.textContent.trim();
            if (val) section.name = val;
            else nameEl.textContent = section.name; // restore if blank
            api.storage.local.set({ pawTabSections: sections });
        });
        nameEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
            if (e.key === 'Escape') { nameEl.textContent = section.name; nameEl.blur(); }
        });

        // ── Section checkbox → select all tabs ─────────────────────────────
        secEl.querySelector('.t-section-checkbox').addEventListener('change', (e) => {
            secEl.querySelectorAll('.t-tab-checkbox').forEach(cb => { cb.checked = e.target.checked; });
        });

        // ── Send all in section ─────────────────────────────────────────────
        const sendBtn = secEl.querySelector('.t-sec-btn-send');
        sendBtn.addEventListener('click', async () => {
            sendBtn.disabled    = true;
            sendBtn.textContent = 'Sending…';
            for (const tab of section.tabs) await sendTabToEmacs(tab, currentProtoIdx);
            sendBtn.disabled    = false;
            sendBtn.innerHTML   = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 8h10M9 5l4 3-4 3" stroke="currentColor" stroke-width="1.5"
                      stroke-linecap="round" stroke-linejoin="round"/></svg> Send All`;
        });

        // ── Open all in section ─────────────────────────────────────────────
        secEl.querySelector('.t-sec-btn-open').addEventListener('click', () => {
            section.tabs.forEach(tab => api.tabs.create({ url: tab.url }));
        });

        // ── Copy URLs with format menu ──────────────────────────────────────
        secEl.querySelector('.t-sec-btn-copy').addEventListener('click', (e) => {
            showCopyMenu(e.currentTarget, section.tabs);
        });

        // ── Delete section ──────────────────────────────────────────────────
        secEl.querySelector('.t-sec-btn-del').addEventListener('click', () => {
            sections = sections.filter(s => s.id !== section.id);
            saveAndRender();
        });

        // ── Section drag handle ─────────────────────────────────────────────
        const dragHandle = secEl.querySelector('.t-section-drag');
        dragHandle.addEventListener('dragstart', (e) => {
            dragSecId = section.id;
            secEl.classList.add('t-section-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.stopPropagation(); // don't trigger tab drag
        });
        dragHandle.addEventListener('dragend', () => {
            secEl.classList.remove('t-section-dragging');
            dragSecId = null;
            document.querySelectorAll('.t-section-drag-over')
                .forEach(n => n.classList.remove('t-section-drag-over'));
        });

        // Section as drop target for section reordering
        secEl.addEventListener('dragover', (e) => {
            if (!dragSecId || dragSecId === section.id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            document.querySelectorAll('.t-section-drag-over')
                .forEach(n => { if (n !== secEl) n.classList.remove('t-section-drag-over'); });
            secEl.classList.add('t-section-drag-over');
        });
        secEl.addEventListener('dragleave', (e) => {
            if (!secEl.contains(e.relatedTarget))
                secEl.classList.remove('t-section-drag-over');
        });
        secEl.addEventListener('drop', (e) => {
            secEl.classList.remove('t-section-drag-over');
            if (!dragSecId || dragSecId === section.id) return;
            e.preventDefault();
            e.stopPropagation();

            // Remove source section
            const srcIdx = sections.findIndex(s => s.id === dragSecId);
            if (srcIdx < 0) return;
            const [moved] = sections.splice(srcIdx, 1);

            // Find destination after removal, insert before/after based on Y
            const dstIdx = sections.findIndex(s => s.id === section.id);
            if (dstIdx < 0) { sections.push(moved); }
            else {
                const rect = secEl.getBoundingClientRect();
                const insertAt = e.clientY < rect.top + rect.height / 2 ? dstIdx : dstIdx + 1;
                sections.splice(insertAt, 0, moved);
            }
            dragSecId = null;
            saveAndRender();
        });

        // ── Drop zone on empty tab-list ─────────────────────────────────────
        tabList.addEventListener('dragover', (e) => {
            e.preventDefault();
            tabList.classList.add('drag-over');
        });
        tabList.addEventListener('dragleave', (e) => {
            if (!tabList.contains(e.relatedTarget)) tabList.classList.remove('drag-over');
        });
        tabList.addEventListener('drop', (e) => {
            e.preventDefault();
            tabList.classList.remove('drag-over');
            if (!dragTabId) return;

            const src = sections.find(s => s.id === dragSectionId);
            if (!src) return;
            const si = src.tabs.findIndex(t => t.id === dragTabId);
            if (si < 0) return;
            const [moved] = src.tabs.splice(si, 1);

            const dst = sections.find(s => s.id === section.id);
            if (dst) dst.tabs.push(moved);
            dragTabId = dragSectionId = null;
            saveAndRender();
        });

        container.appendChild(secEl);
    });
}

// ── Header: Send Selected ────────────────────────────────────────────────────
document.getElementById('sendSelected').addEventListener('click', async () => {
    const checked = [...document.querySelectorAll('.t-tab-checkbox:checked')];
    if (checked.length === 0) {
        alert('No tabs selected.\nCheck some tabs first, then click Send Selected.');
        return;
    }

    const btn = document.getElementById('sendSelected');
    btn.disabled    = true;
    btn.textContent = `Sending ${checked.length}…`;

    for (const cb of checked) {
        const tabEl    = cb.closest('.t-tab-item');
        if (!tabEl) continue;
        const sec      = sections.find(s => s.id === tabEl.dataset.sectionId);
        const tab      = sec?.tabs.find(t => t.id === tabEl.dataset.tabId);
        if (tab) await sendTabToEmacs(tab, currentProtoIdx);
    }

    btn.disabled    = false;
    btn.innerHTML   = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 8h10M9 5l4 3-4 3" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round"/></svg> Send Selected`;
});

// ── Header: Clear All ────────────────────────────────────────────────────────
document.getElementById('clearAll').addEventListener('click', () => {
    const total = sections.reduce((n, s) => n + s.tabs.length, 0);
    if (total === 0) return;
    if (confirm(`Remove all ${total} captured tab${total !== 1 ? 's' : ''} (${sections.length} group${sections.length !== 1 ? 's' : ''})?`)) {
        sections = [];
        saveAndRender();
    }
});

// ── Live update: reflect new captures from background ────────────────────────
api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pawTabSections) {
        sections = changes.pawTabSections.newValue || [];
        render();
    }
});

init();
