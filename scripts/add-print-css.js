// ================================================================
// scripts/add-print-css.js
// ================================================================
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));

let total = 0;

for (const file of files) {
  const p = path.join(PUBLIC, file);
  let html = fs.readFileSync(p, 'utf8');

  if (html.includes('print.css')) {
    console.log(`· ${file}  (sudah ada)`);
    continue;
  }

  if (!html.includes('</head>')) {
    console.log(`⚠️  ${file}  (tidak ada tag </head>)`);
    continue;
  }

  const inject = '  <link rel="stylesheet" href="/css/print.css" media="print">\n</head>';
  html = html.replace('</head>', inject);

  fs.writeFileSync(p, html, 'utf8');
  console.log(`✓ ${file}  (print.css ditambahkan)`);
  total++;
}

console.log(`\nSelesai. ${total} file di-update.`);