// ================================================================
// scripts/fix-error-handler.js
// Ubah semua `message: err.message` → pesan generik
// ================================================================
const fs = require('fs');
const path = require('path');

const ROUTES = path.join(__dirname, '..', 'routes');
const files = fs.readdirSync(ROUTES).filter(f => f.endsWith('.js'));

let total = 0;

for (const file of files) {
  const p = path.join(ROUTES, file);
  let src = fs.readFileSync(p, 'utf8');
  const before = src;

  src = src.replace(
    /res\.status\(500\)\.json\(\{ status: 'error', message: err\.message \}\)/g,
    "res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' })"
  );

  src = src.replace(
    /console\.error\('([^']+):', err\)/g,
    "console.error('[$1]', err.message, err.stack)"
  );

  if (src !== before) {
    fs.writeFileSync(p, src, 'utf8');
    console.log(`✓ ${file}`);
    total++;
  }
}

console.log(`\nSelesai. ${total} file di-update.`);