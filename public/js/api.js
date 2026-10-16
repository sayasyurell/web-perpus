// ================================================================
// api.js — Helper fetch + Lucide re-render untuk konten dinamis
// ================================================================

const API_BASE = '/api';

async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function toast(message, type = 'info') {
  const colors = {
    info: 'bg-blue-500', success: 'bg-green-500',
    error: 'bg-red-500', warning: 'bg-amber-500'
  };
  const el = document.createElement('div');
  el.className = `fixed top-4 right-4 ${colors[type]} text-white px-5 py-3 rounded-lg shadow-lg z-[9999] transition-opacity duration-300`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2500);
}

// ================================================================
// Refresh Lucide icons — panggil setelah setiap render dinamis
// ================================================================
function refreshIcons() {
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

// Auto-render untuk initial page + MutationObserver untuk perubahan dinamis
(function() {
  function init() {
    refreshIcons();
    // Observer untuk render tabel/modal (dari JS) yang mengandung emoji
    const observer = new MutationObserver(() => {
      clearTimeout(window.__iconTimer);
      window.__iconTimer = setTimeout(refreshIcons, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ================================================================
// Global event delegation — pengganti onclick inline
// Pola: <button data-action="fnName" data-id="123" data-str="...">
// ================================================================
document.addEventListener('click', (e) => {
  // Handler data-action
  const el = e.target.closest('[data-action]');
  if (el) {
    const fn = window[el.dataset.action];
    if (typeof fn === 'function') {
      const args = [];
      if (el.dataset.id !== undefined)  args.push(Number(el.dataset.id));
      if (el.dataset.str !== undefined) args.push(el.dataset.str);
      try { fn(...args); } catch (err) { console.error('action error:', err); }
    }
  }
  // Helper stop propagation
  if (e.target.closest('[data-stop]')) e.stopPropagation();
});