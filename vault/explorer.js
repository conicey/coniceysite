/**
 * explorer.js — File explorer rendering + interaction
 * Layout: [file list | notepad (when open) | detail panel]
 * All dividers are draggable. File order persists via sort_order.
 */

const Explorer = (() => {

  const ICONS = {
    folder:  `<svg viewBox="0 0 18 18"><path d="M1.5 3.75A1.5 1.5 0 0 1 3 2.25H7.5L9.75 4.5H15A1.5 1.5 0 0 1 16.5 6v7.5a1.5 1.5 0 0 1-1.5 1.5H3a1.5 1.5 0 0 1-1.5-1.5z"/></svg>`,
    note:    `<svg viewBox="0 0 18 18"><rect x="2.25" y="2.25" width="13.5" height="13.5" rx="1.5"/><line x1="5" y1="6" x2="13" y2="6"/><line x1="5" y1="9" x2="13" y2="9"/><line x1="5" y1="12" x2="9" y2="12"/></svg>`,
    code:    `<svg viewBox="0 0 18 18"><polyline points="4,4.5 1.5,9 4,13.5"/><polyline points="14,4.5 16.5,9 14,13.5"/><line x1="10.5" y1="2.25" x2="7.5" y2="15.75"/></svg>`,
    image:   `<svg viewBox="0 0 18 18"><rect x="1.5" y="3" width="15" height="12" rx="1.5"/><circle cx="6" cy="7.5" r="1.5"/><path d="M1.5 12l4-4 3 3 2.5-2.5L16.5 13"/></svg>`,
    file:    `<svg viewBox="0 0 18 18"><path d="M3.75 2.25h7.5L15 6v9.75a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75V3a.75.75 0 0 1 .75-.75z"/><polyline points="11.25,2.25 11.25,6.75 15,6.75"/></svg>`,
  };

  let _fileInput = null;
  let _els = {};
  let _openNotepadItem = null;
  let _dragSrcIndex = null;
  let _saveTimer = null;

  // ── Panel resize state ────────────────────────────────────────
  // Widths stored as percentages of vault-body
  let _panels = { list: 28, notepad: 0, detail: 72 };

  function _cacheEls() {
    _els = {
      vaultBody:     document.getElementById('vault-body'),
      listPanel:     document.getElementById('list-panel'),
      notepadPanel:  document.getElementById('notepad-panel'),
      detailPanel:   document.getElementById('detail-panel'),
      dividerA:      document.getElementById('divider-a'),
      dividerB:      document.getElementById('divider-b'),
      fileList:      document.getElementById('file-list'),
      emptyState:    document.getElementById('empty-state'),
      breadcrumb:    document.getElementById('breadcrumb'),
      detailEmpty:   document.getElementById('detail-empty'),
      detailContent: document.getElementById('detail-content'),
      detailName:    document.getElementById('detail-name'),
      detailType:    document.getElementById('detail-type'),
      detailPreview: document.getElementById('detail-preview'),
      detailMeta:    document.getElementById('detail-meta'),
      detailActions: document.getElementById('detail-actions'),
      ctxMenu:       document.getElementById('context-menu'),
      storageLabel:  document.getElementById('storage-label'),
      storageFill:   document.getElementById('storage-fill'),
      searchInput:   document.getElementById('search-input'),
      notepadClose:  document.getElementById('notepad-close'),
      notepadTitle:  document.getElementById('notepad-title'),
      notepadArea:   document.getElementById('notepad-area'),
    };
  }

  function _createFileInput() {
    _fileInput = document.createElement('input');
    _fileInput.type = 'file';
    _fileInput.multiple = true;
    _fileInput.style.display = 'none';
    document.body.appendChild(_fileInput);
    _fileInput.addEventListener('change', _handleFileInputChange);
  }

  function init() {
    _cacheEls();
    _createFileInput();
    _bindActionBar();
    _bindContextMenu();
    _bindSearch();
    _bindDividers();
    _bindNotepad();
    _applyPanelWidths();
    renderAll();
  }

  function renderAll() {
    _renderFileList();
    _renderBreadcrumb();
    _renderDetail();
    _updateStorageBar();
  }

  // ── Panel resize ──────────────────────────────────────────────
  function _applyPanelWidths() {
    const { list, notepad, detail } = _panels;
    _els.listPanel.style.width    = list + '%';
    _els.notepadPanel.style.width = notepad + '%';
    _els.detailPanel.style.width  = detail + '%';

    // Show/hide notepad panel and divider B
    _els.notepadPanel.style.display = notepad > 0 ? 'flex' : 'none';
    _els.dividerB.style.display     = notepad > 0 ? 'flex' : 'none';
  }

  function _bindDividers() {
    _makeDraggableDivider(_els.dividerA, 'A');
    _makeDraggableDivider(_els.dividerB, 'B');
  }

  function _makeDraggableDivider(divider, which) {
    let startX, startPanels;

    divider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startPanels = { ..._panels };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMove(e) {
        const totalW = _els.vaultBody.offsetWidth;
        const deltaPct = ((e.clientX - startX) / totalW) * 100;
        const MIN = 10;

        if (which === 'A') {
          // Divider A: between list and notepad (or detail if notepad closed)
          let newList = startPanels.list + deltaPct;
          if (_panels.notepad > 0) {
            let newNotepad = startPanels.notepad - deltaPct;
            if (newList < MIN) { newNotepad += newList - MIN; newList = MIN; }
            if (newNotepad < MIN) { newList += newNotepad - MIN; newNotepad = MIN; }
            _panels.list    = Math.max(MIN, Math.min(newList, 80));
            _panels.notepad = Math.max(MIN, Math.min(newNotepad, 80));
          } else {
            let newDetail = startPanels.detail - deltaPct;
            if (newList < MIN) { newDetail += newList - MIN; newList = MIN; }
            if (newDetail < MIN) { newList += newDetail - MIN; newDetail = MIN; }
            _panels.list   = Math.max(MIN, Math.min(newList, 85));
            _panels.detail = Math.max(MIN, Math.min(newDetail, 85));
          }
        } else {
          // Divider B: between notepad and detail
          let newNotepad = startPanels.notepad + deltaPct;
          let newDetail  = startPanels.detail  - deltaPct;
          if (newNotepad < MIN) { newDetail += newNotepad - MIN; newNotepad = MIN; }
          if (newDetail  < MIN) { newNotepad += newDetail - MIN; newDetail = MIN; }
          _panels.notepad = Math.max(MIN, Math.min(newNotepad, 80));
          _panels.detail  = Math.max(MIN, Math.min(newDetail,  80));
        }

        _applyPanelWidths();
      }

      function onUp() {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ── File list ─────────────────────────────────────────────────
  function _renderFileList() {
    const items  = _getSortedItems();
    const search = (_els.searchInput.value || '').toLowerCase().trim();
    const filtered = search
      ? items.filter(i => i.name.toLowerCase().includes(search))
      : items;

    _els.emptyState.style.display = filtered.length === 0 ? 'flex' : 'none';
    _els.fileList.innerHTML = filtered.map((item, idx) => _fileRow(item, idx)).join('');

    // Click to select
    _els.fileList.querySelectorAll('.file-row').forEach(row => {
      const id = row.dataset.itemId;
      row.addEventListener('click', () => {
        const item = State.getItem(id);
        if (!item) return;

        // Deselect others
        _els.fileList.querySelectorAll('.file-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        State.set('selectedItemId', id);

        // Open notepad for text/code, otherwise just show detail
        if (item.type === 'note' || item.type === 'code') {
          _openNotepad(item);
        } else {
          _renderDetail();
        }
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        State.set('contextTargetId', id);
        _openContextMenu(e.clientX, e.clientY);
      });
    });

    // Drag to reorder
    _els.fileList.querySelectorAll('.file-row').forEach((row, idx) => {
      row.draggable = true;

      row.addEventListener('dragstart', (e) => {
        _dragSrcIndex = idx;
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        _els.fileList.querySelectorAll('.file-row').forEach(r => r.classList.remove('drag-over'));
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        _els.fileList.querySelectorAll('.file-row').forEach(r => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
      });

      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (_dragSrcIndex === null || _dragSrcIndex === idx) return;

        const sorted = _getSortedItems();
        const moved  = sorted.splice(_dragSrcIndex, 1)[0];
        sorted.splice(idx, 0, moved);

        // Assign new sort_order values
        sorted.forEach((item, i) => {
          State.updateItem(item.id, { sort_order: i });
        });

        _renderFileList();

        // Persist to Supabase
        try {
          await Promise.all(sorted.map((item, i) =>
            API.updateItem(item.id, { sort_order: i })
          ));
        } catch (err) {
          console.error('[Explorer] reorder save failed:', err);
          Toast.show('Failed to save order', true);
        }

        _dragSrcIndex = null;
      });
    });
  }

  function _getSortedItems() {
    const items = State.get('items') || [];
    // Flat list — no folder filtering
    return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  function _fileRow(item) {
    const isSelected = State.get('selectedItemId') === item.id;
    const isOpen     = _openNotepadItem && _openNotepadItem.id === item.id;
    const typeClass  = item.type in ICONS ? item.type : 'file';

    let thumbHtml;
    if (item.type === 'image' && item.storagePath) {
      const url = API.getPublicUrl(item.storagePath);
      thumbHtml = `<div class="fr-thumb fr-thumb--img">
        <img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:3px;"
          onerror="this.style.display='none'" />
      </div>`;
    } else {
      thumbHtml = `<div class="fr-thumb fr-thumb--${_esc(typeClass)}">${ICONS[typeClass] || ICONS.file}</div>`;
    }

    return `<div
      class="file-row ${isSelected ? 'selected' : ''} ${isOpen ? 'open' : ''}"
      data-item-id="${_esc(item.id)}"
      tabindex="0"
      role="button"
      aria-label="${_esc(item.name)}"
    >
      ${thumbHtml}
      <div class="fr-info">
        <div class="fr-name" title="${_esc(item.name)}">${_esc(item.name)}</div>
        <div class="fr-meta">${_esc(_formatMeta(item))}</div>
      </div>
      <span class="fr-type">${_esc(item.type)}</span>
    </div>`;
  }

  // ── Notepad ───────────────────────────────────────────────────
  function _openNotepad(item) {
    _openNotepadItem = item;

    // Set panel widths: list | notepad | detail
    _panels = { list: 25, notepad: 45, detail: 30 };
    _applyPanelWidths();

    _els.notepadTitle.textContent = item.name;
    _els.notepadArea.value = item.content || '';
    _els.notepadArea.focus();

    // Re-render detail for this item too
    _renderDetail();
  }

  function _closeNotepad() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _openNotepadItem = null;
    _panels = { list: 28, notepad: 0, detail: 72 };
    _applyPanelWidths();
    _renderFileList();
  }

  function _bindNotepad() {
    _els.notepadClose.addEventListener('click', _closeNotepad);

    _els.notepadArea.addEventListener('input', () => {
      if (!_openNotepadItem) return;
      const value = _els.notepadArea.value;
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(async () => {
        try {
          State.updateItem(_openNotepadItem.id, { content: value, updatedAt: new Date().toISOString() });
          await API.updateItem(_openNotepadItem.id, { content: value, updated_at: new Date().toISOString() });
          Toast.show('Saved');
        } catch (err) {
          console.error('[Explorer] auto-save failed:', err);
          Toast.show('Save failed', true);
        }
      }, 800);
    });
  }

  // ── Breadcrumb (simplified — just "All Files") ────────────────
  function _renderBreadcrumb() {
    _els.breadcrumb.innerHTML = `<span class="crumb active">All Files</span>`;
  }

  // ── Detail panel ──────────────────────────────────────────────
  function _renderDetail() {
    const id   = State.get('selectedItemId');
    const item = id ? State.getItem(id) : null;

    _els.detailEmpty.classList.toggle('hidden', !!item);
    _els.detailContent.classList.toggle('hidden', !item);
    if (!item) return;

    _els.detailName.textContent = item.name;
    _els.detailType.textContent = item.type.toUpperCase();

    _renderDetailPreview(item);
    _renderDetailMeta(item);
    _renderDetailActions(item);
  }

  function _renderDetailPreview(item) {
    const el = _els.detailPreview;
    el.className = 'detail-preview';
    el.innerHTML = '';

    if (item.type === 'image' && item.storagePath) {
      const url = API.getPublicUrl(item.storagePath);
      const img = document.createElement('img');
      img.src = url;
      img.alt = item.name;
      img.style.cssText = 'max-width:100%;max-height:240px;object-fit:contain;border-radius:4px;display:block;margin:auto;';
      el.appendChild(img);

    } else if (item.type === 'note' || item.type === 'code') {
      // Show preview of content (read-only) — editing happens in notepad
      const pre = document.createElement('pre');
      pre.style.cssText = 'font-size:11px;color:var(--text-muted);white-space:pre-wrap;word-break:break-word;margin:0;padding:8px;max-height:160px;overflow:hidden;';
      pre.textContent = item.content
        ? item.content.slice(0, 300) + (item.content.length > 300 ? '…' : '')
        : '(empty)';
      el.appendChild(pre);

    } else if (item.storagePath) {
      el.innerHTML = `<div style="text-align:center;padding:16px;">${ICONS.file}<p style="margin-top:8px;font-size:11px;color:var(--text-muted);">Use Download to save this file</p></div>`;

    } else {
      el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:11px;">No preview</div>`;
    }
  }

  function _renderDetailMeta(item) {
    const rows = [
      { key: 'Type',     value: item.type },
      { key: 'Size',     value: item.size != null ? _formatBytes(item.size) : '—' },
      { key: 'Created',  value: item.createdAt ? _formatDate(item.createdAt) : '—' },
      { key: 'Modified', value: item.updatedAt ? _formatDate(item.updatedAt) : '—' },
    ];
    _els.detailMeta.innerHTML = rows.map(r => `
      <div class="meta-row">
        <span class="meta-key">${_esc(r.key)}</span>
        <span class="meta-val">${_esc(r.value)}</span>
      </div>`).join('');
  }

  function _renderDetailActions(item) {
    let html = '';

    if (item.type === 'note' || item.type === 'code') {
      html += `<button class="detail-action-btn" data-detail-action="edit">
        <svg viewBox="0 0 11 11"><path d="M7 1.5l2.5 2.5-5 5H2V6.5z"/></svg>
        Edit
      </button>`;
    }

    if (item.type !== 'folder') {
      html += `<button class="detail-action-btn" data-detail-action="download">
        <svg viewBox="0 0 11 11"><path d="M5.5 2v5M3 5.5l2.5 2.5 2.5-2.5"/><path d="M2 8.5h7"/></svg>
        Download
      </button>`;
    }

    html += `
      <button class="detail-action-btn" data-detail-action="rename">
        <svg viewBox="0 0 11 11"><path d="M1.5 9.5h8"/><path d="M7 1.5l2.5 2.5-5 5H2V6.5z"/></svg>
        Rename
      </button>
      <button class="detail-action-btn detail-action-btn--danger" data-detail-action="delete">
        <svg viewBox="0 0 11 11"><path d="M2 2.5h7M4.5 2.5V1.5h2v1M3.5 4l.5 5M7.5 4l-.5 5M2.5 2.5l.5 7h5l.5-7"/></svg>
        Delete
      </button>`;

    _els.detailActions.innerHTML = html;

    _els.detailActions.querySelectorAll('[data-detail-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = State.getItem(State.get('selectedItemId'));
        if (!item) return;
        const action = btn.dataset.detailAction;
        if (action === 'edit')     _openNotepad(item);
        if (action === 'download') _downloadItem(item);
        if (action === 'rename')   _renameItem(item);
        if (action === 'delete')   _deleteItem(item);
      });
    });
  }

  // ── Storage bar ───────────────────────────────────────────────
  function _updateStorageBar() {
    const items = State.get('items') || [];
    const totalBytes = items.reduce((sum, i) => sum + (i.size || 0), 0);
    const limitBytes = 50 * 1024 * 1024;
    const pct = Math.min((totalBytes / limitBytes) * 100, 100).toFixed(1);
    _els.storageLabel.textContent = `Storage · ${_formatBytes(totalBytes)} / 50 MB`;
    _els.storageFill.style.width  = pct + '%';
  }

  // ── Upload ────────────────────────────────────────────────────
  function _triggerUpload() {
    _fileInput.value = '';
    _fileInput.click();
  }

  async function _handleFileInputChange() {
    const files = Array.from(_fileInput.files);
    for (const file of files) await _uploadFile(file);
  }

  async function _uploadFile(file) {
    const path = Date.now() + '_' + file.name;
    Toast.show('Uploading ' + file.name + '…');
    try {
      await API.uploadFile(file, path);

      let type = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type === 'text/plain' || file.name.endsWith('.md')) type = 'note';

      const items    = _getSortedItems();
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order ?? 0)) : -1;

      const payload = {
        type,
        name:         file.name,
        parent_id:    null,
        content:      null,
        storage_path: path,
        size:         file.size,
        lang:         null,
        sort_order:   maxOrder + 1,
      };

      const saved = await API.createItem(payload);
      State.addItem(_normalize(saved));
      renderAll();
      Toast.show(file.name + ' uploaded');
    } catch (err) {
      console.error('[Explorer] upload failed:', err);
      Toast.show('Upload failed: ' + file.name, true);
    }
  }

  // ── Download ──────────────────────────────────────────────────
  async function _downloadItem(item) {
    if (!item.storagePath) {
      if (item.content != null) {
        _triggerBlobDownload(new Blob([item.content], { type: 'text/plain' }), item.name);
      } else {
        Toast.show('Nothing to download');
      }
      return;
    }
    try {
      Toast.show('Downloading…');
      const res  = await fetch(API.getPublicUrl(item.storagePath));
      const blob = await res.blob();
      _triggerBlobDownload(blob, item.name);
    } catch (err) {
      Toast.show('Download failed', true);
    }
  }

  function _triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Rename ────────────────────────────────────────────────────
  async function _renameItem(item) {
    const name = await Modal.open({
      title: 'Rename', subtitle: 'Enter a new name',
      placeholder: item.name, initial: item.name, confirmLabel: 'Rename',
    });
    if (!name || name === item.name) return;
    State.updateItem(item.id, { name, updatedAt: new Date().toISOString() });
    if (_openNotepadItem && _openNotepadItem.id === item.id) {
      _els.notepadTitle.textContent = name;
    }
    renderAll();
    try {
      await API.updateItem(item.id, { name, updated_at: new Date().toISOString() });
      Toast.show('Renamed to "' + name + '"');
    } catch (err) {
      State.updateItem(item.id, { name: item.name });
      renderAll();
      Toast.show('Rename failed — reverted', true);
    }
  }

  // ── Action bar ────────────────────────────────────────────────
  function _bindActionBar() {
    document.getElementById('btn-new-note').addEventListener('click', async () => {
      const name = await Modal.open({
        title: 'New Note', subtitle: 'Enter a title',
        placeholder: 'Note title', confirmLabel: 'Create',
      });
      if (!name) return;
      _createItem({ type: 'note', name: name.endsWith('.md') ? name : name + '.md', content: '' });
    });

    document.getElementById('btn-new-code').addEventListener('click', async () => {
      const name = await Modal.open({
        title: 'New Code Snippet', subtitle: 'Enter a filename (e.g. script.py)',
        placeholder: 'filename.py', confirmLabel: 'Create',
      });
      if (!name) return;
      _createItem({ type: 'code', name, content: '' });
    });

    document.getElementById('btn-upload').addEventListener('click', _triggerUpload);
  }

  // ── Normalize (DB → State) ────────────────────────────────────
  function _normalize(row) {
    return {
      id:          row.id,
      type:        row.type,
      name:        row.name,
      parentId:    row.parent_id    ?? null,
      content:     row.content      ?? null,
      storagePath: row.storage_path ?? null,
      size:        row.size         ?? null,
      lang:        row.lang         ?? null,
      sort_order:  row.sort_order   ?? 0,
      createdAt:   row.created_at   ?? null,
      updatedAt:   row.updated_at   ?? null,
    };
  }

  // ── Create item ───────────────────────────────────────────────
  async function _createItem({ type, name, content = null }) {
    const items    = _getSortedItems();
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order ?? 0)) : -1;
    const payload  = {
      type, name,
      parent_id:    null,
      content,
      storage_path: null,
      size:         null,
      lang:         null,
      sort_order:   maxOrder + 1,
    };
    try {
      const saved = await API.createItem(payload);
      const item  = _normalize(saved);
      State.addItem(item);
      State.set('selectedItemId', saved.id);
      if (type === 'note' || type === 'code') _openNotepad(item);
      renderAll();
      Toast.show('"' + name + '" created');
    } catch (err) {
      console.error('[Explorer] createItem failed:', err);
      Toast.show('Failed to create "' + name + '"', true);
    }
  }

  // ── Delete item ───────────────────────────────────────────────
  async function _deleteItem(item) {
    if (_openNotepadItem && _openNotepadItem.id === item.id) _closeNotepad();
    State.removeItem(item.id);
    State.set('selectedItemId', null);
    renderAll();
    try {
      if (item.storagePath) await API.deleteFile(item.storagePath);
      await API.deleteItem(item.id);
      Toast.show('"' + item.name + '" deleted');
    } catch (err) {
      State.addItem(item);
      renderAll();
      Toast.show('Failed to delete — restored', true);
    }
  }

  // ── Search ────────────────────────────────────────────────────
  function _bindSearch() {
    _els.searchInput.addEventListener('input', () => _renderFileList());
  }

  // ── Context menu ──────────────────────────────────────────────
  function _bindContextMenu() {
    document.addEventListener('click', (e) => {
      if (!_els.ctxMenu.contains(e.target)) _closeContextMenu();
    });

    document.getElementById('ctx-open').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (!item) return;
      State.set('selectedItemId', item.id);
      if (item.type === 'note' || item.type === 'code') _openNotepad(item);
      else _renderDetail();
    });

    document.getElementById('ctx-rename').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (item) _renameItem(item);
    });

    document.getElementById('ctx-duplicate').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (item) _createItem({ type: item.type, name: 'Copy of ' + item.name, content: item.content });
    });

    document.getElementById('ctx-download').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (item) _downloadItem(item);
    });

    document.getElementById('ctx-delete').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (item) _deleteItem(item);
    });
  }

  function _openContextMenu(x, y) {
    const menu = _els.ctxMenu;
    menu.removeAttribute('hidden');
    const left = Math.min(x, window.innerWidth  - 180 - 8);
    const top  = Math.min(y, window.innerHeight - 220 - 8);
    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
  }

  function _closeContextMenu() {
    _els.ctxMenu.setAttribute('hidden', '');
    State.set('contextTargetId', null);
  }

  // ── Utilities ─────────────────────────────────────────────────
  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _formatMeta(item) {
    return item.size != null ? _formatBytes(item.size) : item.type;
  }

  function _formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
  }

  function _formatDate(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return '—'; }
  }

  return { init, renderAll };
})();
