// ================================================================
// routes/laporan.js — Dashboard & Laporan
// ================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function escapeCSV(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ================================================================
// GET /api/laporan/dashboard
// ================================================================
router.get('/dashboard', (req, res) => {
  try {
    const today = todayStr();

    // Kartu statistik
    const buku = db.prepare(`
      SELECT COUNT(*) as judul, COALESCE(SUM(stok_total),0) as total_stok,
             COALESCE(SUM(stok_tersedia),0) as stok_tersedia
      FROM buku
    `).get();

    const anggota = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN jenis='siswa' THEN 1 ELSE 0 END) as siswa,
        SUM(CASE WHEN jenis='guru'  THEN 1 ELSE 0 END) as guru
      FROM anggota WHERE status='aktif'
    `).get();

    const pinjam = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='dipinjam' THEN 1 ELSE 0 END) as aktif,
        SUM(CASE WHEN status='dikembalikan' THEN 1 ELSE 0 END) as selesai
      FROM peminjaman
    `).get();

    const terlambat = db.prepare(`
      SELECT COUNT(*) as n FROM peminjaman
      WHERE status IN ('dipinjam','sebagian') AND tanggal_jatuh < ?
    `).get(today).n;

    const totalDenda = db.prepare(`
      SELECT COALESCE(SUM(denda),0) as total FROM peminjaman_detail
    `).get().total;

    // Buku populer (top 5)
    const populer = db.prepare(`
      SELECT b.id, b.kode_buku, b.judul, b.penulis,
             COALESCE(SUM(pd.jumlah), 0) as total_dipinjam
      FROM buku b
      LEFT JOIN peminjaman_detail pd ON pd.buku_id = b.id
      GROUP BY b.id
      ORDER BY total_dipinjam DESC, b.judul ASC
      LIMIT 5
    `).all();

    // Peminjaman terbaru (5)
    const terbaru = db.prepare(`
      SELECT p.id, p.kode_pinjam, p.tanggal_pinjam, p.tanggal_jatuh, p.status,
             a.nama AS anggota_nama, a.nis AS anggota_nis, a.kelas AS anggota_kelas,
             (SELECT COUNT(*) FROM peminjaman_detail WHERE peminjaman_id = p.id) as jumlah_buku
      FROM peminjaman p
      LEFT JOIN anggota a ON a.id = p.anggota_id
      ORDER BY p.id DESC
      LIMIT 5
    `).all();

    // Peminjaman 7 hari terakhir (untuk mini chart)
    const chart7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ymd = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      const n = db.prepare(`
        SELECT COUNT(*) as n FROM peminjaman WHERE tanggal_pinjam = ?
      `).get(ymd).n;
      chart7.push({ tanggal: ymd, jumlah: n });
    }

    // Buku stok menipis (stok_tersedia <= 2 dan > 0)
    const stokMenipis = db.prepare(`
      SELECT id, kode_buku, judul, stok_tersedia, stok_total
      FROM buku
      WHERE stok_tersedia <= 2
      ORDER BY stok_tersedia ASC, judul ASC
      LIMIT 5
    `).all();

    res.json({
      status: 'ok',
      data: {
        buku, anggota, pinjam, terlambat,
        total_denda: totalDenda,
        populer, terbaru, chart_7hari: chart7, stok_menipis: stokMenipis
      }
    });
  } catch (err) {
    console.error('GET /laporan/dashboard error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// GET /api/laporan/peminjaman?dari=&sampai=&status=
// ================================================================
router.get('/peminjaman', (req, res) => {
  try {
    const dari   = req.query.dari   || todayStr();
    const sampai = req.query.sampai || todayStr();
    const status = (req.query.status || '').trim();

    const where = ['p.tanggal_pinjam BETWEEN @dari AND @sampai'];
    const params = { dari, sampai };

    if (status && ['dipinjam','sebagian','dikembalikan'].includes(status)) {
      where.push('p.status = @status');
      params.status = status;
    }

    const whereSQL = 'WHERE ' + where.join(' AND ');

    const rows = db.prepare(`
      SELECT
        p.id, p.kode_pinjam, p.tanggal_pinjam, p.tanggal_jatuh, p.tanggal_kembali,
        p.status, p.denda,
        a.nis AS anggota_nis, a.nama AS anggota_nama, a.kelas AS anggota_kelas, a.jenis AS anggota_jenis,
        (SELECT COUNT(*) FROM peminjaman_detail WHERE peminjaman_id = p.id) as jumlah_buku,
        (SELECT GROUP_CONCAT(b.judul, ', ') FROM peminjaman_detail pd
           JOIN buku b ON b.id = pd.buku_id WHERE pd.peminjaman_id = p.id) as judul_buku
      FROM peminjaman p
      LEFT JOIN anggota a ON a.id = p.anggota_id
      ${whereSQL}
      ORDER BY p.tanggal_pinjam DESC, p.id DESC
    `).all(params);

    // Rekap
    const rekap = {
      total_transaksi: rows.length,
      total_buku: rows.reduce((s, r) => s + (r.jumlah_buku || 0), 0),
      total_denda: rows.reduce((s, r) => s + (r.denda || 0), 0),
      dipinjam: rows.filter(r => r.status === 'dipinjam' || r.status === 'sebagian').length,
      dikembalikan: rows.filter(r => r.status === 'dikembalikan').length,
      terlambat: rows.filter(r => {
        const today = todayStr();
        return (r.status === 'dipinjam' || r.status === 'sebagian') && r.tanggal_jatuh < today;
      }).length
    };

    res.json({ status: 'ok', data: rows, rekap, periode: { dari, sampai } });
  } catch (err) {
    console.error('GET /laporan/peminjaman error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// GET /api/laporan/export-peminjaman?dari=&sampai= — CSV
// ================================================================
router.get('/export-peminjaman', (req, res) => {
  try {
    const dari   = req.query.dari   || todayStr();
    const sampai = req.query.sampai || todayStr();

    const rows = db.prepare(`
      SELECT
        p.kode_pinjam, p.tanggal_pinjam, p.tanggal_jatuh, p.tanggal_kembali,
        p.status, p.denda,
        a.nis AS anggota_nis, a.nama AS anggota_nama, a.kelas AS anggota_kelas,
        (SELECT COUNT(*) FROM peminjaman_detail WHERE peminjaman_id = p.id) as jumlah_buku,
        (SELECT GROUP_CONCAT(b.judul, ' | ') FROM peminjaman_detail pd
           JOIN buku b ON b.id = pd.buku_id WHERE pd.peminjaman_id = p.id) as judul_buku
      FROM peminjaman p
      LEFT JOIN anggota a ON a.id = p.anggota_id
      WHERE p.tanggal_pinjam BETWEEN ? AND ?
      ORDER BY p.tanggal_pinjam DESC, p.id DESC
    `).all(dari, sampai);

    const header = 'kode_pinjam,tanggal_pinjam,tanggal_jatuh,tanggal_kembali,status,nis,nama,kelas,jumlah_buku,judul_buku,denda';
    const lines = [header];

    rows.forEach(r => {
      lines.push([
        r.kode_pinjam, r.tanggal_pinjam, r.tanggal_jatuh, r.tanggal_kembali || '',
        r.status, r.anggota_nis, r.anggota_nama, r.anggota_kelas || '',
        r.jumlah_buku, r.judul_buku || '', r.denda
      ].map(escapeCSV).join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="laporan_peminjaman_${dari}_${sampai}.csv"`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// GET /api/laporan/buku — Semua buku + statistik peminjaman
// ================================================================
router.get('/buku', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        b.id, b.kode_buku, b.judul, b.penulis, b.kategori,
        b.stok_total, b.stok_tersedia,
        COALESCE(SUM(pd.jumlah), 0) as total_dipinjam,
        COALESCE(SUM(CASE WHEN pd.status='dipinjam' THEN pd.jumlah ELSE 0 END), 0) as sedang_dipinjam
      FROM buku b
      LEFT JOIN peminjaman_detail pd ON pd.buku_id = b.id
      GROUP BY b.id
      ORDER BY total_dipinjam DESC, b.judul ASC
    `).all();

    res.json({ status: 'ok', data: rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;