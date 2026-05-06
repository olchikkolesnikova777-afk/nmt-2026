// ═══════════════════════════════════════════════
//  auth.js — login / register / progress sync
// ═══════════════════════════════════════════════

const API = '';  // same origin

let currentUser = null;

function getToken() { return localStorage.getItem('nmt_token'); }
function setToken(t) { localStorage.setItem('nmt_token', t); }
function clearToken() { localStorage.removeItem('nmt_token'); localStorage.removeItem('nmt_user'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
}

// ── Init: check token on load ───────────────────
async function authInit() {
  const token = getToken();
  if (!token) { renderAuthWidget(null); return; }
  try {
    const u = JSON.parse(localStorage.getItem('nmt_user') || 'null');
    currentUser = u;
    renderAuthWidget(u);
    await syncProgressFromServer();
  } catch {
    clearToken();
    renderAuthWidget(null);
  }
}

// ── API calls ───────────────────────────────────
async function apiRegister(name, email, password) {
  const r = await fetch(API + '/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  return r.json();
}

async function apiLogin(email, password) {
  const r = await fetch(API + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return r.json();
}

async function apiGetProgress() {
  if (!getToken()) return null;
  const r = await fetch(API + '/api/progress', { headers: authHeaders() });
  if (!r.ok) return null;
  return r.json();
}

async function apiSaveProgress(topicId, data) {
  if (!getToken()) return;
  fetch(API + '/api/progress/' + topicId, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(data)
  }).catch(() => {});
}

// ── Sync server → localStorage ──────────────────
async function syncProgressFromServer() {
  const serverProg = await apiGetProgress();
  if (!serverProg) return;
  const local = JSON.parse(localStorage.getItem('nmt2026_v3') || '{}');
  const merged = { ...local };
  for (const [topicId, data] of Object.entries(serverProg)) {
    // Server wins if local has no data
    if (!merged[topicId]) merged[topicId] = data;
  }
  localStorage.setItem('nmt2026_v3', JSON.stringify(merged));
  if (typeof renderHome === 'function') renderHome();
}

// ── Save topic progress to server ───────────────
function syncProgressToServer(topicId, data) {
  apiSaveProgress(topicId, data);
}

// ── Auth widget UI ───────────────────────────────
function renderAuthWidget(user) {
  const w = document.getElementById('auth-widget');
  if (!w) return;
  if (user) {
    w.innerHTML = `
      <div class="auth-user">
        <span class="auth-avatar">${user.name.charAt(0).toUpperCase()}</span>
        <span class="auth-name">${user.name}</span>
        <button class="auth-logout-btn" onclick="handleLogout()">Вийти</button>
      </div>`;
  } else {
    w.innerHTML = `<button class="auth-login-btn" onclick="openAuthModal()">🔑 Увійти</button>`;
  }
}

// ── Modal ────────────────────────────────────────
function openAuthModal(tab) {
  document.getElementById('auth-modal').classList.remove('hidden');
  switchTab(tab || 'login');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
  clearAuthError();
}

function switchTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  clearAuthError();
}

function showAuthError(msg) {
  document.getElementById('auth-error').textContent = msg;
}
function clearAuthError() {
  document.getElementById('auth-error').textContent = '';
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { showAuthError('Заповни всі поля'); return; }
  const btn = document.getElementById('login-submit');
  btn.disabled = true; btn.textContent = 'Входжу…';
  const res = await apiLogin(email, password);
  btn.disabled = false; btn.textContent = 'Увійти';
  if (res.error) { showAuthError(res.error); return; }
  setToken(res.token);
  localStorage.setItem('nmt_user', JSON.stringify(res.user));
  currentUser = res.user;
  closeAuthModal();
  renderAuthWidget(res.user);
  await syncProgressFromServer();
  showToast('👋 Привіт, ' + res.user.name + '!');
}

async function handleRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!name || !email || !password) { showAuthError('Заповни всі поля'); return; }
  const btn = document.getElementById('reg-submit');
  btn.disabled = true; btn.textContent = 'Реєструю…';
  const res = await apiRegister(name, email, password);
  btn.disabled = false; btn.textContent = 'Зареєструватися';
  if (res.error) { showAuthError(res.error); return; }
  setToken(res.token);
  localStorage.setItem('nmt_user', JSON.stringify(res.user));
  currentUser = res.user;
  closeAuthModal();
  renderAuthWidget(res.user);
  showToast('🎉 Акаунт створено! Привіт, ' + res.user.name + '!');
}

function handleLogout() {
  clearToken();
  currentUser = null;
  renderAuthWidget(null);
  showToast('До побачення!');
}

function showToast(msg) {
  let t = document.getElementById('auth-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'auth-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'auth-toast show';
  setTimeout(() => t.className = 'auth-toast', 3000);
}

document.addEventListener('DOMContentLoaded', authInit);
