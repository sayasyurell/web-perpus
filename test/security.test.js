// ================================================================
// test/security.test.js — Unit test tanpa server
// ================================================================
const test = require('node:test');
const assert = require('node:assert');
const { escapeCSV } = require('../utils/csv');

test('escapeCSV: netralkan formula injection', () => {
  assert.strictEqual(escapeCSV('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.strictEqual(escapeCSV('+cmd|calc'), "'+cmd|calc");
  assert.strictEqual(escapeCSV('-1+1'), "'-1+1");
  assert.strictEqual(escapeCSV('@admin'), "'@admin");
  assert.strictEqual(escapeCSV('\tDDE'), "'\tDDE");
});

test('escapeCSV: quote koma & petik', () => {
  assert.strictEqual(escapeCSV('a,b'), '"a,b"');
  assert.strictEqual(escapeCSV('ini "petik"'), '"ini ""petik"""');
});

test('escapeCSV: null & undefined jadi kosong', () => {
  assert.strictEqual(escapeCSV(null), '');
  assert.strictEqual(escapeCSV(undefined), '');
});

test('escapeCSV: nama dengan petik tunggal tidak jadi formula', () => {
  const nama = `Test'); alert('XSS`;
  const result = escapeCSV(nama);
  // Tidak diawali karakter formula berbahaya
  assert.ok(!/^[=+\-@\t\r]/.test(result));
  // Output tetap string literal yang aman
  assert.strictEqual(result, `Test'); alert('XSS`);
});

test('escapeCSV: nama dengan petik ganda di-escape', () => {
  const nama = `Test"); alert("XSS`;
  const result = escapeCSV(nama);
  // Harus dibungkus quote dan petik ganda di-double
  assert.ok(result.startsWith('"'));
  assert.ok(result.endsWith('"'));
  assert.ok(result.includes('""'));
});

test('escapeCSV: nama dengan petik + formula di-netralkan', () => {
  const nama = `=Test'); alert('XSS`;
  const result = escapeCSV(nama);
  // Harus diawali petik tunggal (netralisasi formula)
  assert.ok(result.startsWith("'="));
});