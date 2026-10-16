// ================================================================
// routes/pengaturan.js — Pengaturan & Backup
// ================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const DB_PATH = path.join(__dirname, '..', 'database', 'perpus.db');

// ================================================================
// GET /api/pengaturan — semua pengaturan
// ================================================================
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value, keterangan FROM pengaturan ORDER BY key ASC').all();

    // Info database
    let dbSize = 0, dbMtime = null;
    try {
      const stat = fs.statSync(DB_PATH);
      dbSize = stat.size;
      dbMtime = stat.mtime;
    } catch (e) { /* ignore */ }

    // Info sistem
    const counts = {
      buku:     db.prepare('SELECT COUNT(*) as n FROM buku').get().n,
      anggota:  db.prepare('SELECT COUNT(*) as n FROM anggota').get().n,
      peminjaman: db.prepare('SELECT COUNT(*) as n FROM peminjaman').get().n,
      detail:   db.prepare('SELECT COUNT(*) as n FROM peminjaman_detail').get().n
    };

        res.json({
      status: 'ok',
      data: rows,
      app: {                                    // ← BARU
        version: pkg.version,                   // ← BARU
        name: pkg.name                          // ← BARU
      },                                        // ← BARU
      info: {
        db_size: dbSize,
        db_size_human: (dbSize / 1024).toFixed(2) + ' KB',
        db_mtime: dbMtime,
        counts
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});


// ================================================================
// PUT /api/pengaturan — update banyak setting sekaligus
// Body: { denda_per_hari: "1000", lama_pinjam_default: "14", ... }
// ================================================================
router.put('/', (req, res) => {
  try {
    const updates = req.body || {};
    const allowedKeys = ['denda_per_hari', 'lama_pinjam_default', 'max_buku_per_pinjam', 'nama_perpustakaan'];

    // Validasi
    const errors = [];
    for (const [k, v] of Object.entries(updates)) {
      if (!allowedKeys.includes(k)) continue;
      if (['denda_per_hari', 'lama_pinjam_default', 'max_buku_per_pinjam'].includes(k)) {
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 0) errors.push(`${k} harus angka >= 0`);
      }
    }
    if (errors.length) {
      return res.status(400).json({ status: 'error', message: errors.join(', ') });
    }

    const stmt = db.prepare('UPDATE pengaturan SET value = ? WHERE key = ?');
    const updateAll = db.transaction((data) => {
      let count = 0;
      for (const [k, v] of Object.entries(data)) {
        if (!allowedKeys.includes(k)) continue;
        stmt.run(String(v), k);
        count++;
      }
      return count;
    });

    const count = updateAll(updates);

    // Kembalikan setting terbaru
    const rows = db.prepare('SELECT key, value, keterangan FROM pengaturan ORDER BY key ASC').all();
    res.json({ status: 'ok', message: `${count} pengaturan berhasil disimpan`, data: rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// ================================================================
// GET /api/pengaturan/backup — Download database
// ================================================================
router.get('/backup', async (req, res) => {
  try {
    const tmp = path.join(__dirname, '..', 'database', `.backup-${Date.now()}.db`);

    // Gunakan native backup API (aman untuk DB yang sedang aktif)
    await db.backup(tmp);

    const now = new Date();
    const stamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0');

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="perpus_backup_${stamp}.db"`);

    const stream = fs.createReadStream(tmp);
    stream.pipe(res);

    // Hapus file temporer setelah selesai dikirim
    stream.on('end', () => fs.unlink(tmp, () => {}));
    stream.on('error', () => fs.unlink(tmp, () => {}));
  } catch (err) {
    console.error('[backup]', err.message, err.stack);
    res.status(500).json({ status: 'error', message: 'Gagal membuat backup' });
  }
});

// ================================================================
// POST /api/pengaturan/reset — Reset data (BERBAHAYA)
// Body: { konfirmasi: "HAPUS" }
// ================================================================
router.post('/reset', (req, res) => {
  try {
    if (req.body.konfirmasi !== 'HAPUS') {
      return res.status(400).json({ status: 'error', message: 'Konfirmasi salah. Ketik "HAPUS" untuk konfirmasi.' });
    }

    const what = req.body.what || 'peminjaman'; // peminjaman | semua

    const doReset = db.transaction(() => {
      if (what === 'peminjaman') {
        db.prepare('DELETE FROM peminjaman_detail').run();
        db.prepare('DELETE FROM peminjaman').run();
        // Kembalikan stok semua buku
        db.prepare('UPDATE buku SET stok_tersedia = stok_total').run();
        return { pesan: 'Semua data peminjaman dihapus, stok buku direset' };
      } else if (what === 'semua') {
        db.prepare('DELETE FROM peminjaman_detail').run();
        db.prepare('DELETE FROM peminjaman').run();
        db.prepare('DELETE FROM buku').run();
        db.prepare('DELETE FROM anggota').run();
        return { pesan: 'Semua data (buku, anggota, peminjaman) dihapus' };
      }
      return { pesan: 'Tidak ada yang direset' };
    });

    const hasil = doReset();
    res.json({ status: 'ok', message: hasil.pesan });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;