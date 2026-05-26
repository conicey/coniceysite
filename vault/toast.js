/**
 * toast.js — Toast notification manager
 *
 * Shows brief status messages in the bottom-right corner.
 * Auto-dismisses after a configurable duration.
 */

const Toast = (() => {
  let _el      = null;
  let _timeout = null;

  function init() {
    _el = document.getElementById('toast');
    if (!_el) console.error('[Toast] #toast element missing.');
  }

  /**
   * Show a toast message.
   * @param {string}  message   - Text to display
   * @param {boolean} isError   - If true, styles as error
   * @param {number}  duration  - Auto-dismiss ms (default 2800)
   */
  function show(message, isError = false, duration = 2800) {
    if (!_el) return;

    _el.textContent = message;
    _el.classList.toggle('toast--error', isError);
    _el.classList.add('toast--visible');

    if (_timeout) clearTimeout(_timeout);
    _timeout = setTimeout(() => {
      _el.classList.remove('toast--visible');
    }, duration);
  }

  return { init, show };
})();
