// ================================================================
// scripts/add-theme-link.js
// Tambah <link theme.css> ke semua HTML kalau belum ada
// ================================================================
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));

let changed = 0, skipped = 0;

for (const file of files) {
  const p = path.join(PUBLIC, file);
  let html = fs.readFileSync(p, 'utf8');

  if (html.includes('theme.css')) {
    console.log(`· ${file}  (sudah ada)`);
    skipped++;
    continue;
  }

  if (!html.includes('</head>')) {
    console.log(`⚠️  ${file}  (tidak ada </head>)`);
    continue;
  }

  html = html.replace('</head>',
    '  <link rel="stylesheet" href="/css/theme.css">\n</head>');

  fs.writeFileSync(p, html, 'utf8');
  console.log(`✓ ${file}  (theme.css ditambah)`);
  changed++;
}

console.log(`\nSelesai. ${changed} file di-update, ${skipped} sudah ada.`);