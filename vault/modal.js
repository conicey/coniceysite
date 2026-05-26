/**
 * modal.js — Single-instance modal manager
 *
 * One modal overlay element reused for all dialogs.
 * Callers configure it via Modal.open({ ... }) which returns a Promise.
 * Focus is trapped inside the modal while open.
 * Escape and backdrop-click always close without confirming.
 */

const Modal = (() => {
  let _overlay, _box, _title, _sub, _input, _btnConfirm, _btnCancel;
  let _resolvePromise = null;

  function init() {
    _overlay    = document.getElementById('modal-overlay');
    _box        = document.getElementById('modal-box');
    _title      = document.getElementById('modal-title');
    _sub        = document.getElementById('modal-sub');
    _input      = document.getElementById('modal-input');
    _btnConfirm = document.getElementById('btn-modal-confirm');
    _btnCancel  = document.getElementById('btn-modal-cancel');

    if (!_overlay) {
      console.error('[Modal] Required DOM elements missing.');
      return;
    }

    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) _close(null);
    });

    _btnCancel.addEventListener('click',  () => _close(null));
    _btnConfirm.addEventListener('click', _confirm);

    document.addEventListener('keydown', (e) => {
      if (!State.get('modalOpen')) return;
      if (e.key === 'Enter')  { e.preventDefault(); _confirm(); }
      if (e.key === 'Escape') _close(null);
    });
  }

  /**
   * Open the modal and return a Promise that resolves with the
   * trimmed input value on confirm, or null on cancel/dismiss.
   */
  function open({ title, subtitle, placeholder, initial = '', confirmLabel = 'Confirm' }) {
    _title.textContent       = title;
    _sub.textContent         = subtitle;
    _input.placeholder       = placeholder;
    _input.value             = initial;
    _btnConfirm.textContent  = confirmLabel;

    _overlay.setAttribute('aria-hidden', 'false');
    State.set('modalOpen', true);

    requestAnimationFrame(() => _input.focus());

    return new Promise((resolve) => {
      _resolvePromise = resolve;
    });
  }

  function _confirm() {
    const value = _input.value.trim();
    _close(value || null);
  }

  function _close(value) {
    _overlay.setAttribute('aria-hidden', 'true');
    State.set('modalOpen', false);
    _input.value = '';

    if (_resolvePromise) {
      _resolvePromise(value);
      _resolvePromise = null;
    }
  }

  return { init, open };
})();
