// ================================================================
// routes/scan.js — Endpoint lookup untuk Mode Scan
// ================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');

// ================================================================
// GET /api/scan/lookup/:kode — Deteksi otomatis buku/anggota
// Terima: BK-0001 | ISBN 13 digit | EAN-13 (200 + NIS) | NIS langsung
// ================================================================
router.get('/lookup/:kode', (req, res) => {
  try {
    const rawKode = (req.params.kode || '').trim();
    const kode = rawKode.toUpperCase();

    if (!kode) {
      return res.status(400).json({ status: 'error', message: 'Kode kosong' });
    }

    // 1) Cek buku by kode_buku
    let buku = db.prepare('SELECT * FROM buku WHERE UPPER(kode_buku) = ?').get(kode);
    if (buku) return res.json({ status: 'ok', tipe: 'buku', data: buku });

    // 2) Cek buku by ISBN (10-13 digit numeric)
    if (/^\d{10,13}$/.test(kode)) {
      buku = db.prepare('SELECT * FROM buku WHERE isbn = ?').get(kode);
      if (buku) return res.json({ status: 'ok', tipe: 'buku', data: buku });
    }

    // 3) Kalau EAN-13 dengan prefix 200 → konversi ke NIS
    let nisKandidat = kode;
    if (/^200\d{10}$/.test(kode)) {
      nisKandidat = kode.substring(3, 12).replace(/^0+/, '') || '0';
    }

    // 4) Cek anggota by NIS (coba beberapa variasi)
    let anggota = db.prepare('SELECT * FROM anggota WHERE UPPER(nis) = ?').get(nisKandidat);
    if (!anggota) anggota = db.prepare('SELECT * FROM anggota WHERE UPPER(nis) = ?').get(kode);
    if (!anggota) {
      // fallback: cari yang nis-nya pad dengan leading zero
      anggota = db.prepare('SELECT * FROM anggota WHERE UPPER(nis) = ?').get(nisKandidat.padStart(7, '0'));
    }
    if (anggota) return res.json({ status: 'ok', tipe: 'anggota', data: anggota });

    // 5) Tidak ketemu
    res.status(404).json({
      status: 'error',
      message: 'Kode tidak dikenali: ' + rawKode
    });
  } catch (err) {
    console.error('Scan lookup error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// GET /api/scan/pinjam-aktif/:anggota_id — Peminjaman yang belum lunas
// ================================================================
router.get('/pinjam-aktif/:anggota_id', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.id, p.kode_pinjam, p.tanggal_pinjam, p.tanggal_jatuh, p.status,
             (SELECT COUNT(*) FROM peminjaman_detail
              WHERE peminjaman_id = p.id AND status = 'dipinjam') AS sisa
      FROM peminjaman p
      WHERE p.anggota_id = ? AND p.status IN ('dipinjam','sebagian')
      ORDER BY p.id DESC
    `).all(req.params.anggota_id);

    res.json({ status: 'ok', data: rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// POST /api/scan/proses — Auto-detect pinjam/kembali + eksekusi
// Body: { anggota_id, buku_list: [{buku_id, jumlah}] }
// ================================================================
router.post('/proses', (req, res) => {
  try {
    const { anggota_id, buku_list } = req.body;

    if (!anggota_id || !Array.isArray(buku_list) || !buku_list.length) {
      return res.status(400).json({ status: 'error', message: 'Data tidak lengkap' });
    }

    const anggota = db.prepare('SELECT * FROM anggota WHERE id = ?').get(anggota_id);
    if (!anggota) return res.status(400).json({ status: 'error', message: 'Anggota tidak ditemukan' });
    if (anggota.status !== 'aktif') return res.status(400).json({ status: 'error', message: 'Anggota tidak aktif' });

    const today = new Date().toISOString().slice(0, 10);
    const dendaPerHari = parseInt((db.prepare('SELECT value FROM pengaturan WHERE key = ?').get('denda_per_hari') || {}).value || '500', 10);

    // Kelompokkan tiap buku: kembali atau pinjam
    const items = buku_list.map(item => {
      const detail = db.prepare(`
        SELECT pd.id AS detail_id, pd.jumlah, p.id AS peminjaman_id, p.tanggal_jatuh
        FROM peminjaman_detail pd
        JOIN peminjaman p ON p.id = pd.peminjaman_id
        WHERE pd.buku_id = ? AND pd.status = 'dipinjam' AND p.anggota_id = ?
        ORDER BY p.id DESC LIMIT 1
      `).get(item.buku_id, anggota_id);

      return {
        buku_id: item.buku_id,
        jumlah: parseInt(item.jumlah) || 1,
        action: detail ? 'kembali' : 'pinjam',
        detail_id: detail ? detail.detail_id : null,
        peminjaman_id: detail ? detail.peminjaman_id : null,
        tanggal_jatuh: detail ? detail.tanggal_jatuh : null
      };
    });

    const kembaliItems = items.filter(i => i.action === 'kembali');
    const pinjamItems  = items.filter(i => i.action === 'pinjam');

    // Validasi stok untuk buku yang mau dipinjam
    for (const item of pinjamItems) {
      const b = db.prepare('SELECT judul, stok_tersedia FROM buku WHERE id = ?').get(item.buku_id);
      if (!b) return res.status(400).json({ status: 'error', message: `Buku ID ${item.buku_id} tidak ditemukan` });
      if (b.stok_tersedia < item.jumlah) {
        return res.status(400).json({ status: 'error', message: `Stok "${b.judul}" tidak cukup (tersedia: ${b.stok_tersedia})` });
      }
    }

    // ============ TRANSACTION ============
    const doProcess = db.transaction(() => {
      const hasil = { pengembalian: [], peminjaman: null };

      // ---- 1) PENGEMBALIAN ----
      if (kembaliItems.length) {
        const updDetail = db.prepare(`
          UPDATE peminjaman_detail SET status='dikembalikan', tanggal_kembali=?, denda=? WHERE id=?
        `);
        const updStok = db.prepare(`UPDATE buku SET stok_tersedia = stok_tersedia + ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);

        for (const item of kembaliItems) {
          const jatuh = new Date(item.tanggal_jatuh + 'T00:00:00');
          const now   = new Date(today + 'T00:00:00');
          const hari  = Math.floor((now - jatuh) / 86400000);
          const denda = hari > 0 ? hari * dendaPerHari : 0;

          updDetail.run(today, denda, item.detail_id);
          updStok.run(item.jumlah, item.buku_id);

          const buku = db.prepare('SELECT judul, kode_buku FROM buku WHERE id = ?').get(item.buku_id);
          hasil.pengembalian.push({ ...buku, denda, hari_terlambat: Math.max(0, hari) });
        }

        // Update header peminjaman untuk tiap transaksi yang terpengaruh
        const pids = [...new Set(kembaliItems.map(i => i.peminjaman_id))];
        for (const pid of pids) {
          const sisa = db.prepare(`SELECT COUNT(*) as n FROM peminjaman_detail WHERE peminjaman_id=? AND status='dipinjam'`).get(pid).n;
          const totalDenda = db.prepare(`SELECT COALESCE(SUM(denda),0) as t FROM peminjaman_detail WHERE peminjaman_id=?`).get(pid).t;
          if (sisa === 0) {
            db.prepare(`UPDATE peminjaman SET status='dikembalikan', tanggal_kembali=?, denda=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
              .run(today, totalDenda, pid);
          } else {
            db.prepare(`UPDATE peminjaman SET status='sebagian', denda=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
              .run(totalDenda, pid);
          }
        }
      }

      // ---- 2) PEMINJAMAN BARU ----
      if (pinjamItems.length) {
        const lamaPinjam = parseInt((db.prepare('SELECT value FROM pengaturan WHERE key=?').get('lama_pinjam_default') || {}).value || '7', 10);
        const tglJatuh = new Date(today + 'T00:00:00');
        tglJatuh.setDate(tglJatuh.getDate() + lamaPinjam);
        const tglJatuhStr = tglJatuh.toISOString().slice(0, 10);

        // Generate kode pinjam
        const ymd = today.replace(/-/g, '');
        const prefix = `PJ-${ymd}-`;
        const last = db.prepare(`SELECT kode_pinjam FROM peminjaman WHERE kode_pinjam LIKE ? ORDER BY id DESC LIMIT 1`).get(prefix + '%');
        const seq = last ? parseInt(last.kode_pinjam.replace(prefix, ''), 10) + 1 : 1;
        const kodePinjam = prefix + String(seq).padStart(3, '0');

        const info = db.prepare(`
          INSERT INTO peminjaman (kode_pinjam, anggota_id, tanggal_pinjam, tanggal_jatuh, status, catatan)
          VALUES (?, ?, ?, ?, 'dipinjam', 'Auto-scan')
        `).run(kodePinjam, anggota_id, today, tglJatuhStr);

        const pid = info.lastInsertRowid;
        const insDetail = db.prepare(`INSERT INTO peminjaman_detail (peminjaman_id, buku_id, jumlah, status) VALUES (?, ?, ?, 'dipinjam')`);
        const updStok = db.prepare(`UPDATE buku SET stok_tersedia = stok_tersedia - ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);

        const bukuInfo = [];
        for (const item of pinjamItems) {
          insDetail.run(pid, item.buku_id, item.jumlah);
          updStok.run(item.jumlah, item.buku_id);
          const b = db.prepare('SELECT judul, kode_buku FROM buku WHERE id = ?').get(item.buku_id);
          bukuInfo.push(b);
        }

        hasil.peminjaman = {
          id: pid, kode_pinjam: kodePinjam,
          tanggal_pinjam: today, tanggal_jatuh: tglJatuhStr,
          buku: bukuInfo
        };
      }

      return hasil;
    });

    const hasil = doProcess();

    res.json({
      status: 'ok',
      message: `Selesai: ${hasil.pengembalian.length} kembali, ${hasil.peminjaman ? hasil.peminjaman.buku.length : 0} pinjam`,
      anggota: { id: anggota.id, nama: anggota.nama, nis: anggota.nis, kelas: anggota.kelas },
      ...hasil
    });

  } catch (err) {
    console.error('POST /scan/proses error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;