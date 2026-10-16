// ================================================================
// utils/csv.js — Escape CSV + neutralisasi formula injection
// ================================================================

function escapeCSV(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);

  // Netralisasi formula injection
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

  // Quote jika ada koma, petik, atau newline
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';

  return s;
}

function toCSV(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(row.map(escapeCSV).join(','));
  return '\uFEFF' + lines.join('\n'); // BOM untuk Excel
}

module.exports = { escapeCSV, toCSV };