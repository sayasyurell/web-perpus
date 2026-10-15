// ================================================================
// routes/peminjaman.js — Peminjaman & Pengembalian + Denda
// ================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');

// ================================================================
// Helper
// ================================================================

function getSetting(key, def = null) {
  const row = db.prepare('SELECT value FROM pengaturan WHERE key = ?').get(key);
  return row ? row.value : def;
}

function hitungDenda(tglJatuh, tglKembali, dendaPerHari) {
  const jatuh   = new Date(tglJatuh   + 'T00:00:00');
  const kembali = new Date(tglKembali + 'T00:00:00');
  const diffHari = Math.floor((kembali - jatuh) / (1000 * 60 * 60 * 24));
  return diffHari > 0 ? diffHari * dendaPerHari : 0;
}

function generateKodePinjam(tglPinjam) {
  const d = new Date(tglPinjam + 'T00:00:00');
  const ymd = d.getFullYear().toString() +
              String(d.getMonth() + 1).padStart(2, '0') +
              String(d.getDate()).padStart(2, '0');
  const prefix = `PJ-${ymd}-`;

  const row = db.prepare(`
    SELECT kode_pinjam FROM peminjaman
    WHERE kode_pinjam LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(prefix + '%');

  let seq = 1;
  if (row) {
    seq = parseInt(row.kode_pinjam.replace(prefix, ''), 10) + 1;
  }
  return prefix + String(seq).padStart(3, '0');
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

// ================================================================
// GET /api/peminjaman — List
// ================================================================
router.get('/', (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();

    const where = [];
    const params = {};

    if (search) {
      where.push('(p.kode_pinjam LIKE @search OR a.nis LIKE @search OR a.nama LIKE @search)');
      params.search = `%${search}%`;
    }

    if (status === 'terlambat') {
      where.push(`p.status IN ('dipinjam','sebagian') AND p.tanggal_jatuh < @today`);
      params.today = todayStr();
    } else if (status) {
      where.push('p.status = @status');
      params.status = status;
    }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`
      SELECT COUNT(*) as n FROM peminjaman p
      LEFT JOIN anggota a ON a.id = p.anggota_id
      ${whereSQL}
    `).get(params).n;

    const rows = db.prepare(`
      SELECT
        p.*,
        a.nis AS anggota_nis,
        a.nama AS anggota_nama,
        a.kelas AS anggota_kelas,
        a.jenis AS anggota_jenis,
        (SELECT COUNT(*) FROM peminjaman_detail WHERE peminjaman_id = p.id) AS total_buku,
        (SELECT COUNT(*) FROM peminjaman_detail WHERE peminjaman_id = p.id AND status = 'dipinjam') AS buku_belum_kembali
      FROM peminjaman p
      LEFT JOIN anggota a ON a.id = p.anggota_id
      ${whereSQL}
      ORDER BY p.id DESC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    const today = todayStr();
    const enriched = rows.map(r => ({
      ...r,
      is_terlambat: (r.status === 'dipinjam' || r.status === 'sebagian') && r.tanggal_jatuh < today
    }));

    res.json({
      status: 'ok',
      data: enriched,
      pagination: { page, limit, total, total_page: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('GET /peminjaman error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// GET /api/peminjaman/:id — Detail
// ================================================================
router.get('/:id', (req, res) => {
  try {
    const p = db.prepare(`
      SELECT p.*, a.nis AS anggota_nis, a.nama AS anggota_nama,
             a.kelas AS anggota_kelas, a.jenis AS anggota_jenis
      FROM peminjaman p
      LEFT JOIN anggota a ON a.id = p.anggota_id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!p) return res.status(404).json({ status: 'error', message: 'Peminjaman tidak ditemukan' });

    const detail = db.prepare(`
      SELECT pd.*, b.kode_buku, b.judul, b.penulis, b.kategori
      FROM peminjaman_detail pd
      LEFT JOIN buku b ON b.id = pd.buku_id
      WHERE pd.peminjaman_id = ?
      ORDER BY pd.id ASC
    `).all(req.params.id);

    const today = todayStr();
    p.is_terlambat = (p.status === 'dipinjam' || p.status === 'sebagian') && p.tanggal_jatuh < today;

    const dendaPerHari = parseInt(getSetting('denda_per_hari', '500'), 10);
    if (p.is_terlambat) {
      p.estimasi_denda = hitungDenda(p.tanggal_jatuh, today, dendaPerHari);
      p.hari_terlambat = Math.floor(
        (new Date(today + 'T00:00:00') - new Date(p.tanggal_jatuh + 'T00:00:00')) / (1000 * 60 * 60 * 24)
      );
    } else {
      p.estimasi_denda = 0;
      p.hari_terlambat = 0;
    }

    res.json({ status: 'ok', data: { ...p, detail } });
  } catch (err) {
    console.error('GET /peminjaman/:id error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// POST /api/peminjaman — Buat peminjaman baru
// ================================================================
router.post('/', (req, res) => {
  try {
    const { anggota_id, tanggal_pinjam, catatan, buku_list } = req.body;

    if (!anggota_id) return res.status(400).json({ status: 'error', message: 'Anggota wajib dipilih' });
    if (!Array.isArray(buku_list) || !buku_list.length) {
      return res.status(400).json({ status: 'error', message: 'Minimal 1 buku harus dipilih' });
    }

    const anggota = db.prepare('SELECT * FROM anggota WHERE id = ?').get(anggota_id);
    if (!anggota) return res.status(400).json({ status: 'error', message: 'Anggota tidak ditemukan' });
    if (anggota.status !== 'aktif') {
      return res.status(400).json({ status: 'error', message: 'Anggota tidak aktif, tidak bisa meminjam' });
    }

    const maxBuku = parseInt(getSetting('max_buku_per_pinjam', '3'), 10);
    const totalBuku = buku_list.reduce((s, b) => s + (parseInt(b.jumlah) || 1), 0);
    if (totalBuku > maxBuku) {
      return res.status(400).json({ status: 'error', message: `Maksimal ${maxBuku} buku per transaksi` });
    }

    const tglPinjam = tanggal_pinjam || todayStr();
    const lamaPinjam = parseInt(getSetting('lama_pinjam_default', '7'), 10);
    const tglJatuh = addDays(tglPinjam, lamaPinjam);

    const bukuMap = {};
    for (const item of buku_list) {
      const b = db.prepare('SELECT * FROM buku WHERE id = ?').get(item.buku_id);
      if (!b) return res.status(400).json({ status: 'error', message: `Buku ID ${item.buku_id} tidak ditemukan` });
      const jml = parseInt(item.jumlah) || 1;
      if (jml < 1) return res.status(400).json({ status: 'error', message: `Jumlah buku "${b.judul}" minimal 1` });
      if (b.stok_tersedia < jml) {
        return res.status(400).json({
          status: 'error',
          message: `Stok "${b.judul}" tidak cukup. Tersedia: ${b.stok_tersedia}, diminta: ${jml}`
        });
      }
      bukuMap[item.buku_id] = { buku: b, jumlah: jml };
    }

    const idList = buku_list.map(b => b.buku_id);
    if (new Set(idList).size !== idList.length) {
      return res.status(400).json({ status: 'error', message: 'Ada buku duplikat dalam daftar' });
    }

    const kodePinjam = generateKodePinjam(tglPinjam);

    const createPeminjaman = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO peminjaman
        (kode_pinjam, anggota_id, tanggal_pinjam, tanggal_jatuh, status, catatan)
        VALUES (?, ?, ?, ?, 'dipinjam', ?)
      `).run(kodePinjam, anggota_id, tglPinjam, tglJatuh, catatan || null);

      const peminjamanId = info.lastInsertRowid;

      const insertDetail = db.prepare(`
        INSERT INTO peminjaman_detail (peminjaman_id, buku_id, jumlah, status)
        VALUES (?, ?, ?, 'dipinjam')
      `);

      const updateStok = db.prepare(`
        UPDATE buku
        SET stok_tersedia = stok_tersedia - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      for (const item of buku_list) {
        const { buku, jumlah } = bukuMap[item.buku_id];
        insertDetail.run(peminjamanId, buku.id, jumlah);
        updateStok.run(jumlah, buku.id);
      }

      return peminjamanId;
    });

    const newId = createPeminjaman();

    const result = db.prepare('SELECT * FROM peminjaman WHERE id = ?').get(newId);
    res.status(201).json({
      status: 'ok',
      message: `Peminjaman ${result.kode_pinjam} berhasil dibuat`,
      data: result
    });
  } catch (err) {
    console.error('POST /peminjaman error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// POST /api/peminjaman/:id/kembalikan
// ================================================================
router.post('/:id/kembalikan', (req, res) => {
  try {
    const id = req.params.id;
    const peminjaman = db.prepare('SELECT * FROM peminjaman WHERE id = ?').get(id);
    if (!peminjaman) return res.status(404).json({ status: 'error', message: 'Peminjaman tidak ditemukan' });

    const tglKembali = req.body.tanggal_kembali || todayStr();
    const dendaPerHari = parseInt(getSetting('denda_per_hari', '500'), 10);

    let details = db.prepare(`
      SELECT * FROM peminjaman_detail
      WHERE peminjaman_id = ? AND status = 'dipinjam'
    `).all(id);

    if (Array.isArray(req.body.detail_ids) && req.body.detail_ids.length) {
      const ids = req.body.detail_ids.map(Number);
      details = details.filter(d => ids.includes(d.id));
    }

    if (!details.length) {
      return res.status(400).json({ status: 'error', message: 'Tidak ada buku yang bisa dikembalikan' });
    }

    const doReturn = db.transaction(() => {
      const updateDetail = db.prepare(`
        UPDATE peminjaman_detail
        SET status = 'dikembalikan',
            tanggal_kembali = ?,
            denda = ?
        WHERE id = ?
      `);

      const updateStok = db.prepare(`
        UPDATE buku
        SET stok_tersedia = stok_tersedia + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      let totalDendaBaru = 0;

      for (const d of details) {
        const denda = hitungDenda(peminjaman.tanggal_jatuh, tglKembali, dendaPerHari);
        updateDetail.run(tglKembali, denda, d.id);
        updateStok.run(d.jumlah, d.buku_id);
        totalDendaBaru += denda;
      }

      const sisa = db.prepare(`
        SELECT COUNT(*) as n FROM peminjaman_detail
        WHERE peminjaman_id = ? AND status = 'dipinjam'
      `).get(id).n;

      const totalDenda = db.prepare(`
        SELECT COALESCE(SUM(denda), 0) as total FROM peminjaman_detail WHERE peminjaman_id = ?
      `).get(id).total;

      let statusBaru, tglKembaliHeader;
      if (sisa === 0) {
        statusBaru = 'dikembalikan';
        tglKembaliHeader = tglKembali;
      } else {
        statusBaru = 'sebagian';
        tglKembaliHeader = null;
      }

      db.prepare(`
        UPDATE peminjaman
        SET status = ?, tanggal_kembali = ?, denda = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(statusBaru, tglKembaliHeader, totalDenda, id);

      return { totalDendaBaru, totalDenda, sisa };
    });

    const hasil = doReturn();

    res.json({
      status: 'ok',
      message: `Berhasil mengembalikan ${details.length} buku. Denda: Rp ${hasil.totalDendaBaru.toLocaleString('id-ID')}`,
      data: {
        buku_dikembalikan: details.length,
        denda_transaksi_ini: hasil.totalDendaBaru,
        total_denda: hasil.totalDenda,
        sisa_belum_kembali: hasil.sisa
      }
    });
  } catch (err) {
    console.error('POST /peminjaman/:id/kembalikan error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// DELETE /api/peminjaman/:id
// ================================================================
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const p = db.prepare('SELECT * FROM peminjaman WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ status: 'error', message: 'Peminjaman tidak ditemukan' });

    const sudahKembali = db.prepare(`
      SELECT COUNT(*) as n FROM peminjaman_detail
      WHERE peminjaman_id = ? AND status = 'dikembalikan'
    `).get(id).n;

    if (sudahKembali > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak bisa dihapus, sudah ada buku yang dikembalikan.'
      });
    }

    const doDelete = db.transaction(() => {
      const details = db.prepare(`
        SELECT * FROM peminjaman_detail WHERE peminjaman_id = ? AND status = 'dipinjam'
      `).all(id);

      const updateStok = db.prepare(`
        UPDATE buku SET stok_tersedia = stok_tersedia + ? WHERE id = ?
      `);

      for (const d of details) updateStok.run(d.jumlah, d.buku_id);

      db.prepare('DELETE FROM peminjaman_detail WHERE peminjaman_id = ?').run(id);
      db.prepare('DELETE FROM peminjaman WHERE id = ?').run(id);
    });

    doDelete();

    res.json({ status: 'ok', message: 'Peminjaman berhasil dihapus & stok dikembalikan' });
  } catch (err) {
    console.error('DELETE /peminjaman error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;