const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/scan/lookup/:kode — Deteksi otomatis buku/anggota
router.get('/lookup/:kode', (req, res) => {
  try {
    const rawKode = (req.params.kode || '').trim();
    const kode = rawKode.toUpperCase();

    if (!kode) return res.status(400).json({ status: 'error', message: 'Kode kosong' });

    // 1) Cek buku by kode_buku
    let buku = db.prepare('SELECT * FROM buku WHERE UPPER(kode_buku) = ?').get(kode);
    if (buku) return res.json({ status: 'ok', tipe: 'buku', data: buku });

    // 2) Cek buku by ISBN (10-13 digit numeric)
    if (/^\d{10,13}$/.test(kode)) {
      buku = db.prepare('SELECT * FROM buku WHERE isbn = ?').get(kode);
      if (buku) return res.json({ status: 'ok', tipe: 'buku', data: buku });
    }

    // 3) Cek anggota by NIS (coba beberapa variasi)
    let nisKandidat = kode;
    if (/^200\d{10}$/.test(kode)) {
      nisKandidat = kode.substring(3, 12).replace(/^0+/, '') || '0';
    }

    let anggota = db.prepare('SELECT * FROM anggota WHERE UPPER(nis) = ?').get(nisKandidat);
    if (!anggota) anggota = db.prepare('SELECT * FROM anggota WHERE UPPER(nis) = ?').get(kode);
    if (!anggota) anggota = db.prepare('SELECT * FROM anggota WHERE UPPER(nis) = ?').get(nisKandidat.padStart(7, '0'));
    if (anggota) return res.json({ status: 'ok', tipe: 'anggota', data: anggota });

    res.status(404).json({ status: 'error', message: 'Kode tidak dikenali: ' + rawKode });
  } catch (err) {
    console.error('Scan lookup error:', err);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/scan/proses — Proses Peminjaman Buku
router.post('/proses', (req, res) => {
  try {
    const { anggota_id, buku_list } = req.body;
    if (!anggota_id || !Array.isArray(buku_list) || !buku_list.length) {
      return res.status(400).json({ status: 'error', message: 'Data tidak lengkap' });
    }

    const anggota = db.prepare('SELECT * FROM anggota WHERE id = ?').get(anggota_id);
    if (!anggota) return res.status(400).json({ status: 'error', message: 'Anggota tidak ditemukan' });

    const today = new Date().toISOString().slice(0, 10);
    const dendaPerHari = parseInt((db.prepare('SELECT value FROM pengaturan WHERE key = ?').get('denda_per_hari') || {}).value || '500', 10);

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

    for (const item of pinjamItems) {
      const b = db.prepare('SELECT judul, stok_tersedia FROM buku WHERE id = ?').get(item.buku_id);
      if (!b) return res.status(400).json({ status: 'error', message: `Buku ID ${item.buku_id} tidak ditemukan` });
      if (b.stok_tersedia < item.jumlah) {
        return res.status(400).json({ status: 'error', message: `Stok "${b.judul}" tidak cukup (tersedia: ${b.stok_tersedia})` });
      }
    }

    const doProcess = db.transaction(() => {
      const hasil = { pengembalian: [], peminjaman: null };

      if (kembaliItems.length) {
        const updDetail = db.prepare(`UPDATE peminjaman_detail SET status='dikembalikan', tanggal_kembali=?, denda=? WHERE id=?`);
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
        const pids = [...new Set(kembaliItems.map(i => i.peminjaman_id))];
        for (const pid of pids) {
          const sisa = db.prepare(`SELECT COUNT(*) as n FROM peminjaman_detail WHERE peminjaman_id=? AND status='dipinjam'`).get(pid).n;
          const totalDenda = db.prepare(`SELECT COALESCE(SUM(denda),0) as t FROM peminjaman_detail WHERE peminjaman_id=?`).get(pid).t;
          if (sisa === 0) {
            db.prepare(`UPDATE peminjaman SET status='dikembalikan', tanggal_kembali=?, denda=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(today, totalDenda, pid);
          } else {
            db.prepare(`UPDATE peminjaman SET status='sebagian', denda=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(totalDenda, pid);
          }
        }
      }

      if (pinjamItems.length) {
        const lamaPinjam = parseInt((db.prepare('SELECT value FROM pengaturan WHERE key=?').get('lama_pinjam_default') || {}).value || '7', 10);
        const tglJatuh = new Date(today + 'T00:00:00');
        tglJatuh.setDate(tglJatuh.getDate() + lamaPinjam);
        const tglJatuhStr = tglJatuh.toISOString().slice(0, 10);

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
        hasil.peminjaman = { id: pid, kode_pinjam: kodePinjam, tanggal_pinjam: today, tanggal_jatuh: tglJatuhStr, buku: bukuInfo };
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
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/scan/tamu — Catat Masuk (Tanpa Scan Keluar)
router.post('/tamu', (req, res) => {
  try {
    const { anggota_id, tujuan = 'baca' } = req.body;
    if (!anggota_id) return res.status(400).json({ status: 'error', message: 'Anggota tidak valid' });

    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date().toLocaleString('sv').replace('T', ' ');

    const kunjunganHariIni = db.prepare(`SELECT id, tujuan FROM kunjungan WHERE anggota_id = ? AND tanggal = ?`).get(anggota_id, today);
    const anggota = db.prepare('SELECT nama, nis, kelas FROM anggota WHERE id = ?').get(anggota_id);

    if (kunjunganHariIni) {
      if (tujuan === 'pinjam' && kunjunganHariIni.tujuan !== 'pinjam') {
        db.prepare('UPDATE kunjungan SET tujuan = ? WHERE id = ?').run('pinjam', kunjunganHariIni.id);
      }
      res.json({ status: 'ok', tipe: 'sudah', anggota, waktu: now.split(' ')[1] });
    } else {
      db.prepare('INSERT INTO kunjungan (anggota_id, tanggal, jam_masuk, tujuan) VALUES (?, ?, ?, ?)').run(anggota_id, today, now, tujuan);
      res.json({ status: 'ok', tipe: 'masuk', tujuan, anggota, waktu: now.split(' ')[1] });
    }
  } catch (err) {
    console.error('[scan/tamu]', err.message);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;