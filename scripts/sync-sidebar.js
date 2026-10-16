// ================================================================
// scripts/sync-sidebar.js
// Samakan blok <aside>...</aside> di semua HTML
// Sumber: file yang ada "SMPN 1 Taman" (sudah benar)
// ================================================================
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const TEMPLATE_FILE = 'anggota.html'; // sumber sidebar yang bagus

// 1. Ambil sidebar template
const templateHtml = fs.readFileSync(path.join(PUBLIC, TEMPLATE_FILE), 'utf8');
const m = templateHtml.match(/<aside[\s\S]*?<\/aside>/);
if (!m) {
  console.error('❌ Sidebar tidak ditemukan di', TEMPLATE_FILE);
  process.exit(1);
}

// Normalisasi: highlight biru dikosongkan dulu (biar bisa di-set per halaman)
let sidebarTemplate = m[0]
  .replace(/class="[^"]*bg-blue-600[^"]*"[^>]*>/g, (tag) => {
    // ganti jadi class default (tanpa bg-blue-600 text-white font-medium)
    return tag
      .replace(/\bbg-blue-600\b/g, '')
      .replace(/\btext-white\b/g, 'text-slate-300')
      .replace(/\bfont-medium\b/g, '')
      .replace(/\s+/g, ' ')
      .replace(/class="\s+/, 'class="')
      .replace(/\s+"/g, '"');
  });

// 2. Path menu → teks menu (untuk matching)
const MENU_MAP = [
  { href: '/',                label: 'Dashboard' },
  { href: '/buku.html',       label: 'Buku' },
  { href: '/anggota.html',    label: 'Anggota' },
  { href: '/peminjaman.html', label: 'Peminjaman' },
  { href: '/scan.html',       label: 'Scan Mode' },
  { href: '/laporan.html',    label: 'Laporan' },
  { href: '/pengaturan.html', label: 'Pengaturan' }
];

// Fungsi: aktifkan menu tertentu (highlight hijau)
function activateMenu(sidebar, activeHref) {
  // Reset dulu
  let s = sidebar;

  // Cari blok <a href="XXX" class="...">...</a>
  MENU_MAP.forEach(m => {
    const re = new RegExp(
      `<a href="${m.href.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"([^>]*)>`,
      'g'
    );
    s = s.replace(re, (match, attrs) => {
      // Bersihkan class lama dulu
      let cleaned = attrs
        .replace(/class="[^"]*"/, '')
        .trim();
      if (m.href === activeHref) {
        return `<a href="${m.href}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-600 text-white font-medium" ${cleaned}>`;
      } else {
        return `<a href="${m.href}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300" ${cleaned}>`;
      }
    });
  });
  return s;
}

// 3. Proses semua HTML
const files = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));
let changed = 0;

for (const file of files) {
  if (file === 'login.html') continue; // skip

  const p = path.join(PUBLIC, file);
  const html = fs.readFileSync(p, 'utf8');

  if (!/<aside[\s\S]*?<\/aside>/.test(html)) {
    console.log(`⚠️  ${file}: tidak ada <aside>, skip`);
    continue;
  }

  // Tentukan halaman aktif dari nama file
  let activeHref = '/';
  if (file === 'index.html') activeHref = '/';
  else if (file === 'buku.html') activeHref = '/buku.html';
  else if (file === 'anggota.html') activeHref = '/anggota.html';
  else if (file === 'peminjaman.html') activeHref = '/peminjaman.html';
  else if (file === 'scan.html') activeHref = '/scan.html';
  else if (file === 'laporan.html') activeHref = '/laporan.html';
  else if (file === 'pengaturan.html') activeHref = '/pengaturan.html';

  const newSidebar = activateMenu(sidebarTemplate, activeHref);

  // Ganti <aside>...</aside> lama
  const newHtml = html.replace(/<aside[\s\S]*?<\/aside>/, newSidebar);

  if (newHtml !== html) {
    fs.writeFileSync(p, newHtml, 'utf8');
    console.log(`✓ ${file}  (aktif: ${activeHref})`);
    changed++;
  } else {
    console.log(`· ${file}  (tidak berubah)`);
  }
}

console.log(`\nSelesai. ${changed} file di-update.`);