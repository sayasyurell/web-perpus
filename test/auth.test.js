// ================================================================
// test/auth.test.js — Butuh server jalan di 127.0.0.1:3000
// Jalankan: npm run dev di terminal lain, lalu: node --test test/auth.test.js
// ================================================================
const test = require('node:test');
const assert = require('node:assert');

const BASE = 'http://127.0.0.1:3000';

test('akses /api/buku tanpa login → 401/302', async () => {
  const res = await fetch(BASE + '/api/buku', { redirect: 'manual' });
  assert.ok([401, 302].includes(res.status),
    `harusnya 401/302, dapat ${res.status}`);
});

test('akses /buku.html tanpa login → redirect login', async () => {
  const res = await fetch(BASE + '/buku.html', { redirect: 'manual' });
  assert.ok([302, 401].includes(res.status),
    `harusnya 302/401, dapat ${res.status}`);
});

test('POST /api/auth/login tanpa Origin → 403 (CSRF)', async () => {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'x' })
  });
  assert.strictEqual(res.status, 403);
});

test('login salah → 401', async () => {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE },
    body: JSON.stringify({ username: 'admin', password: 'salahbanget' })
  });
  assert.strictEqual(res.status, 401);
});