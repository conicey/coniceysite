/**
 * app.js — Vault bootstrap
 * Auth: email OTP, clipboard-only unlock
 */

document.addEventListener('DOMContentLoaded', () => {

  const loginScreen = document.getElementById('screen-login');
  const vaultScreen = document.getElementById('screen-vault');
  const step1       = document.getElementById('login-step-1');
  const step2       = document.getElementById('login-step-2');
  const btnRequest  = document.getElementById('btn-request-token');
  const btnUnlock   = document.getElementById('btn-unlock');
  const btnBack     = document.getElementById('btn-back');
  const btnLock     = document.getElementById('btn-lock');
  const countdown   = document.getElementById('login-countdown');
  const statusDot   = document.getElementById('login-status-dot');
  const statusText  = document.getElementById('login-status-text');

  Toast.init();
  Modal.init();
  Explorer.init();

  let _countdownInterval = null;

  // Auto-unlock if token in URL (from email button)
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken  = urlParams.get('token');
  if (urlToken) {
    navigator.clipboard.writeText(urlToken).catch(() => {});
    window.history.replaceState({}, '', window.location.pathname);
    step1.classList.remove('active');
    step2.classList.add('active');
    step1.setAttribute('aria-hidden', 'true');
    step2.setAttribute('aria-hidden', 'false');
    statusDot.className    = 'status-dot status-dot--ready';
    statusText.textContent = '// token_copied → click unlock';
    btnUnlock.disabled = false;
    startCountdown(600);
  }

  async function loadItems() {
    const { data, error } = await window.supabaseClient
      .from('files').select('*');
    if (error) throw error;
    return data || [];
  }

  function normalizeRow(row) {
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

  btnRequest.addEventListener('click', async () => {
    btnRequest.disabled    = true;
    btnRequest.textContent = '> sending...';

    try {
      const res  = await fetch('/api/request-token', { method: 'POST' });
      const json = await res.json();

      if (!res.ok) {
        Toast.show(json.error || 'failed to send token');
        return;
      }

      step1.classList.remove('active');
      step2.classList.add('active');
      step1.setAttribute('aria-hidden', 'true');
      step2.setAttribute('aria-hidden', 'false');

      statusDot.className    = 'status-dot status-dot--ready';
      statusText.textContent = '// token_dispatched';
      btnUnlock.disabled     = false;

      startCountdown(600);
      Toast.show('token sent → check inbox');

    } catch (err) {
      console.error('[app] request failed:', err);
      Toast.show('connection failed — retry');
    } finally {
      btnRequest.disabled    = false;
      btnRequest.textContent = '> Request Access Token';
    }
  });

  btnUnlock.addEventListener('click', async () => {
    btnUnlock.disabled    = true;
    btnUnlock.textContent = '> verifying...';

    try {
      let token;
      try {
        token = await navigator.clipboard.readText();
      } catch {
        Toast.show('clipboard access denied — allow and retry');
        btnUnlock.disabled    = false;
        btnUnlock.textContent = '> Paste & Unlock';
        return;
      }

      token = token.trim();
      if (!token) {
        Toast.show('clipboard empty — copy token from email first');
        btnUnlock.disabled    = false;
        btnUnlock.textContent = '> Paste & Unlock';
        return;
      }

      const res  = await fetch('/api/verify-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      });
      const json = await res.json();

      if (!res.ok || !json.valid) {
        Toast.show(json.error || 'access denied');
        btnUnlock.disabled    = false;
        btnUnlock.textContent = '> Paste & Unlock';
        return;
      }

      if (_countdownInterval) clearInterval(_countdownInterval);
      State.set('sessionToken', 'session-' + Date.now());
      loginScreen.classList.add('hidden');
      vaultScreen.classList.remove('hidden');

      try {
        const rows  = await loadItems();
        const items = rows.map(normalizeRow);
        State.set('items', items);
        Explorer.renderAll();
      } catch (err) {
        console.error('[app] load failed:', err);
        Explorer.renderAll();
      }

      Toast.show('vault unlocked');

    } catch (err) {
      console.error('[app] unlock error:', err);
      Toast.show('something went wrong — retry');
      btnUnlock.disabled    = false;
      btnUnlock.textContent = '> Paste & Unlock';
    }
  });

  btnBack.addEventListener('click', () => {
    if (_countdownInterval) clearInterval(_countdownInterval);
    step2.classList.remove('active');
    step1.classList.add('active');
    step2.setAttribute('aria-hidden', 'true');
    step1.setAttribute('aria-hidden', 'false');
    btnUnlock.disabled = true;
  });

  btnLock.addEventListener('click', () => {
    State.logout();
    vaultScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    step1.classList.add('active');
    step2.classList.remove('active');
    step1.setAttribute('aria-hidden', 'false');
    step2.setAttribute('aria-hidden', 'true');
    btnUnlock.disabled = true;
    Toast.show('vault locked');
  });

  function startCountdown(seconds) {
    if (_countdownInterval) clearInterval(_countdownInterval);
    let remaining = seconds;
    countdown.classList.remove('countdown-value--expired');

    _countdownInterval = setInterval(() => {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      countdown.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      remaining--;

      if (remaining < 0) {
        clearInterval(_countdownInterval);
        countdown.textContent = 'expired';
        countdown.classList.add('countdown-value--expired');
        btnUnlock.disabled = true;
      }
    }, 1000);
  }

});
