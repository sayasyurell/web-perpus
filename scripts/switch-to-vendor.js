// ================================================================
// scripts/switch-to-vendor.js
// Ganti CDN Lucide + JsBarcode ke file vendor lokal
// ================================================================
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));

let total = 0;

for (const file of files) {
  const p = path.join(PUBLIC, file);
  let src = fs.readFileSync(p, 'utf8');
  const before = src;

  // Ganti Lucide dari CDN ke vendor
  src = src.replace(
    /<script src="https:\/\/unpkg\.com\/lucide@[^"]*"[^>]*><\/script>/g,
    '<script src="/vendor/lucide.min.js"></script>'
  );

  // Ganti JsBarcode dari CDN ke vendor
  src = src.replace(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/jsbarcode@[^"]*"[^>]*><\/script>/g,
    '<script src="/vendor/JsBarcode.all.min.js"></script>'
  );

  if (src !== before) {
    fs.writeFileSync(p, src, 'utf8');
    console.log(`✓ ${file}`);
    total++;
  }
}

console.log(`\nSelesai. ${total} file di-update.`);