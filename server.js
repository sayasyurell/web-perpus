const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const pkg = require('./package.json');
// Import routes
const bukuRouter       = require('./routes/buku');
const anggotaRouter    = require('./routes/anggota');
const peminjamanRouter = require('./routes/peminjaman');
const laporanRouter    = require('./routes/laporan');
const pengaturanRouter = require('./routes/pengaturan');
const scanRouter       = require('./routes/scan');
const app = express();
const PORT = 3000;

// ===== Middleware =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================================================
// AUTO-REPLACE EMOJI → Lucide SVG DI SERVER (anti-FOUC)
// ================================================================
const EMOJI_MAP = {
  '🏠': 'layout-dashboard', '📖': 'book-open', '👥': 'users',
  '🔄': 'repeat-2', '📊': 'bar-chart-3', '⚙️': 'settings',
  '📚': 'library', '🔍': 'search', '＋': 'plus',
  '✏️': 'pencil', '🗑️': 'trash-2', '👁️': 'eye',
  '🖨️': 'printer', '💾': 'save', '⬇️': 'download',
  '📥': 'file-down', '📤': 'file-up', '⚠️': 'alert-triangle',
  '✅': 'check-circle-2', '🎫': 'credit-card', '📈': 'trending-up',
  '🏆': 'trophy', '🕐': 'clock', '📦': 'package',
  'ℹ️': 'info', '💰': 'banknote', '🚨': 'alert-octagon',
  '👤': 'user', '📝': 'sticky-note', '📋': 'clipboard-list',
  '📄': 'file-text', '📅': 'calendar', '🥇': 'medal',
  '🥈': 'medal', '🥉': 'medal', '👍': 'thumbs-up'
};

function emojiToIcon(html) {
  Object.entries(EMOJI_MAP).forEach(([emoji, icon]) => {
    html = html.split(emoji).join(`<i data-lucide="${icon}" class="icon-inline"></i>`);
  });
  return html;
}

// Middleware: intercept file HTML sebelum di-serve
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path !== '/' && !req.path.endsWith('.html')) return next();

  const relPath = req.path === '/' ? 'index.html' : req.path.replace(/^\//, '');
  const publicDir = path.join(__dirname, 'public');
  const filePath = path.join(publicDir, relPath);

  // Keamanan: pastikan path masih di dalam folder public
  if (!filePath.startsWith(publicDir)) return next();

  if (fs.existsSync(filePath)) {
    let html = fs.readFileSync(filePath, 'utf8');
    // Auto-inject Theme CSS kalau belum ada

    if (!html.includes('/css/theme.css')) {
      html = html.replace('</head>',
        '  <link rel="stylesheet" href="/css/theme.css">\n</head>');
    }
    // Auto-inject print.css
    if (!html.includes('/css/print.css')) {
      html = html.replace('</head>',
        `  <link rel="stylesheet" href="/css/print.css?v=${Date.now()}" media="print">\n</head>`);
    }

    // Auto-replace emoji 📚 di sidebar jadi logo sekolah
    html = html.replace(/>Perpustakaan<\/div>/g, '>SMPN 1 Taman</div>');
    html = html.replace(/>Sekolah<\/div>/g, '>Sidoarjo</div>');
    // Auto-update info versi & fase
    html = html.replace(/>v0\.7<\/dd>/g, `>v${pkg.version}</dd>`);
    html = html.replace(/>v0\.\d+ — Fase \d+<\/div>/g, `>v${pkg.version} — Production</div>`);
        // Auto-inject menu "Scan Mode" ke sidebar (skip kalau sudah ada)
    if (!html.includes('/scan.html')) {
      html = html.replace(
        '<a href="/laporan.html"',
        '<a href="/scan.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300"><i data-lucide="scan-line" class="w-5 h-5"></i> <span>Scan Mode</span></a>\n        <a href="/laporan.html"'
      );
    }
    
    // Auto-inject Lucide CDN kalau belum ada
    if (!html.includes('lucide.min.js')) {
      html = html.replace('</head>',
        '  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>\n</head>');
    }

    // Auto-inject icons.js (auto-render) kalau belum ada
    if (!html.includes('/js/icons.js')) {
      html = html.replace('</body>',
        '  <script src="/js/icons.js"></script>\n</body>');
    }

        // Auto-inject JsBarcode
    if (!html.includes('jsbarcode')) {
      html = html.replace('</head>',
        '  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>\n</head>');
    }

    html = emojiToIcon(html);
    return res.type('html').send(html);
  }
  next();
});

// Static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// ===== Routes =====
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Server perpus jalan 🚀', waktu: new Date().toISOString() });
});

app.get('/api/db-test', (req, res) => {
  try {
    const buku    = db.prepare('SELECT COUNT(*) as n FROM buku').get().n;
    const anggota = db.prepare('SELECT COUNT(*) as n FROM anggota').get().n;
    const pinjam  = db.prepare('SELECT COUNT(*) as n FROM peminjaman').get().n;
    const setting = db.prepare('SELECT key, value FROM pengaturan').all();
    res.json({
      status: 'ok', message: 'Database terkoneksi ✅',
      jumlah: { buku, anggota, peminjaman: pinjam },
      pengaturan: setting
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Mount routes
app.use('/api/buku',       bukuRouter);
app.use('/api/anggota',    anggotaRouter);
app.use('/api/peminjaman', peminjamanRouter);
app.use('/api/laporan',    laporanRouter);
app.use('/api/pengaturan', pengaturanRouter);
app.use('/api/scan',       scanRouter);
// ===== 404 & Error =====
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: err.message || 'Server error' });
});

// ===== Start =====
app.listen(PORT, () => {
  console.log('====================================');
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
  console.log(`🎨 Emoji auto-replace: ON`);
  console.log('====================================');
});