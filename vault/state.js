/**
 * state.js — Centralized application state
 * Single source of truth. No DOM access. No side-effects. Pure data.
 */
const State = (() => {
  const ROOT_CRUMB = { id: 'root', name: 'All Files' };

  const _state = {
    sessionToken:    null,
    activeFolderId:  'root',      // 'root' or a folder UUID
    currentFolderId: null,        // alias kept for lib/explorer.js compat
    selectedItemId:  null,
    contextTargetId: null,
    searchQuery:     '',
    breadcrumb:      [ROOT_CRUMB],
    modalOpen:       false,
    items:           [],
  };

  // ── Core ──────────────────────────────────────────────────────
  function get(key) {
    return _state[key];
  }

  function getAll() {
    return Object.assign({}, _state);
  }

  function set(key, value) {
    if (!(key in _state)) {
      console.warn('[State] Unknown key:', key);
      return;
    }
    _state[key] = value;
  }

  // ── Items ─────────────────────────────────────────────────────
  function getItem(id) {
    return _state.items.find(item => item.id === id) || null;
  }

  function addItem(item) {
    _state.items.push(item);
  }

  function removeItem(id) {
    _state.items = _state.items.filter(item => item.id !== id);
    if (_state.selectedItemId === id) _state.selectedItemId = null;
  }

  function updateItem(id, patch) {
    const index = _state.items.findIndex(item => item.id === id);
    if (index === -1) return;
    _state.items[index] = Object.assign({}, _state.items[index], patch);
  }

  /**
   * Returns items visible in the active folder, filtered by searchQuery.
   * When activeFolderId is 'root', returns top-level items (parentId === null).
   */
  function getItemsInActiveFolder() {
    const folderId = _state.activeFolderId;
    const query    = (_state.searchQuery || '').toLowerCase().trim();

    let items;
    if (folderId === 'root') {
      items = _state.items.filter(i => i.parentId == null);
    } else {
      items = _state.items.filter(i => i.parentId === folderId);
    }

    if (query) {
      items = items.filter(i => i.name.toLowerCase().includes(query));
    }

    return items;
  }

  // ── Navigation ────────────────────────────────────────────────
  /**
   * Navigate into a folder, updating activeFolderId, currentFolderId,
   * and the breadcrumb trail.
   *
   * @param {string} id   - folder UUID, or 'root'
   * @param {string} name - display name for the breadcrumb
   */
  function navigateToFolder(id, name) {
    if (id === 'root' || id == null) {
      _state.activeFolderId  = 'root';
      _state.currentFolderId = null;
      _state.breadcrumb      = [ROOT_CRUMB];
      _state.selectedItemId  = null;
      return;
    }

    // Check if this folder already exists in the trail (back-navigation)
    const existingIndex = _state.breadcrumb.findIndex(c => c.id === id);
    if (existingIndex !== -1) {
      _state.breadcrumb = _state.breadcrumb.slice(0, existingIndex + 1);
    } else {
      _state.breadcrumb = [..._state.breadcrumb, { id, name }];
    }

    _state.activeFolderId  = id;
    _state.currentFolderId = id;   // keep alias in sync
    _state.selectedItemId  = null;
  }

  // ── Session ───────────────────────────────────────────────────
  function logout() {
    _state.sessionToken    = null;
    _state.activeFolderId  = 'root';
    _state.currentFolderId = null;
    _state.selectedItemId  = null;
    _state.contextTargetId = null;
    _state.searchQuery     = '';
    _state.breadcrumb      = [ROOT_CRUMB];
    _state.modalOpen       = false;
    _state.items           = [];
  }

  return {
    get, getAll, set,
    getItem, addItem, removeItem, updateItem, getItemsInActiveFolder,
    navigateToFolder,
    logout,
  };
})();
