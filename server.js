const express = require('express');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const auth = require('./middleware/auth');

// Routes
const authRouter       = require('./routes/auth');
const bukuRouter       = require('./routes/buku');
const anggotaRouter    = require('./routes/anggota');
const peminjamanRouter = require('./routes/peminjaman');
const laporanRouter    = require('./routes/laporan');
const pengaturanRouter = require('./routes/pengaturan');
const scanRouter       = require('./routes/scan');

const app = express();

// ===== Konfigurasi host/port =====
const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Trust proxy (untuk IP di balik reverse proxy)
app.set('trust proxy', false);

// ===== Middleware dasar =====
// TIDAK pakai cors() terbuka — same-origin only
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== File statis (HTML login & assets publik) =====
// Login page & asset (css, js, img, vendor) BISA diakses tanpa auth
const PUBLIC_WHITELIST = ['/login.html', '/css/', '/js/', '/img/', '/vendor/'];
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) return next();
  return express.static(path.join(__dirname, 'public'))(req, res, next);
});

// ===== CSRF check untuk semua non-GET =====
app.use(auth.checkCSRF);

// ===== Auth routes (tidak perlu login) =====
app.use('/api/auth', authRouter);

// ===== Auth middleware untuk semua rute lain =====
app.use((req, res, next) => {
  // Izinkan login page & asset publik
  if (req.path === '/login.html') return next();
  if (PUBLIC_WHITELIST.some(p => req.path.startsWith(p))) return next();
  return auth.requireAuth(req, res, next);
});

// ===== Serve HTML (sudah tidak pakai runtime patching) =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== API Routes =====
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Server perpus jalan' });
});

app.use('/api/buku',       bukuRouter);
app.use('/api/anggota',    anggotaRouter);
app.use('/api/peminjaman', peminjamanRouter);
app.use('/api/laporan',    laporanRouter);
app.use('/api/pengaturan', pengaturanRouter);
app.use('/api/scan',       scanRouter);

// ===== 404 & Error handler =====
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message, err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' }); // pesan generik
});

// ===== Start =====
app.listen(PORT, HOST, () => {
  console.log('====================================');
  console.log(`✅ Server jalan di http://${HOST}:${PORT}`);
  console.log(`🌐 HOST=${HOST} PORT=${PORT}`);
  console.log('====================================');
});