// ================================================================
// scripts/add-view-transition-meta.js
// Tambah <meta name="view-transition"> ke semua HTML
// ================================================================
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));

const META = '<meta name="view-transition" content="same-origin">';
let total = 0;

for (const file of files) {
  const p = path.join(PUBLIC, file);
  let html = fs.readFileSync(p, 'utf8');

  if (html.includes('view-transition')) {
    console.log(`· ${file}  (sudah ada)`);
    continue;
  }

  html = html.replace('<meta charset="UTF-8">',
    '<meta charset="UTF-8">\n  ' + META);

  fs.writeFileSync(p, html, 'utf8');
  console.log(`✓ ${file}`);
  total++;
}

console.log(`\nSelesai. ${total} file di-update.`);