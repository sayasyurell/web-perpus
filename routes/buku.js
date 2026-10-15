// ================================================================
// routes/buku.js — CRUD Buku
// ================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');

// ================================================================
// Helper
// ================================================================

// Generate kode buku otomatis: BK-0001, BK-0002, ...
function generateKodeBuku() {
  const row = db.prepare(`
    SELECT kode_buku FROM buku
    WHERE kode_buku LIKE 'BK-%'
    ORDER BY id DESC LIMIT 1
  `).get();

  if (!row) return 'BK-0001';

  const num = parseInt(row.kode_buku.replace('BK-', ''), 10) + 1;
  return 'BK-' + String(num).padStart(4, '0');
}

// Validasi input buku
function validateBuku(body, isUpdate = false) {
  const errors = [];
  if (!body.judul || String(body.judul).trim() === '') {
    errors.push('Judul wajib diisi');
  }
  if (body.stok_total !== undefined && body.stok_total !== null) {
    const n = Number(body.stok_total);
    if (isNaN(n) || n < 0) errors.push('Stok total harus angka >= 0');
  }
  return errors;
}

// ================================================================
// GET /api/buku — List dengan pagination + search + filter
// Query: ?page=1&limit=10&search=laskar&kategori=Novel&sort=judul&order=asc
// ================================================================
router.get('/', (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset   = (page - 1) * limit;
    const search   = (req.query.search || '').trim();
    const kategori = (req.query.kategori || '').trim();
    const sort     = req.query.sort || 'id';
    const order    = (req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Whitelist kolom sort (biar aman dari SQL injection)
    const allowedSort = ['id', 'judul', 'penulis', 'kategori', 'stok_total', 'stok_tersedia', 'created_at'];
    const sortCol = allowedSort.includes(sort) ? sort : 'id';

    // Bangun WHERE
    const where = [];
    const params = {};

    if (search) {
      where.push('(judul LIKE @search OR penulis LIKE @search OR isbn LIKE @search OR kode_buku LIKE @search)');
      params.search = `%${search}%`;
    }
    if (kategori) {
      where.push('kategori = @kategori');
      params.kategori = kategori;
    }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Count total
    const total = db.prepare(`SELECT COUNT(*) as n FROM buku ${whereSQL}`).get(params).n;

    // Ambil data
    const rows = db.prepare(`
      SELECT * FROM buku
      ${whereSQL}
      ORDER BY ${sortCol} ${order}
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    // Ambil daftar kategori unik (untuk dropdown filter)
    const kategoriList = db.prepare(`
      SELECT DISTINCT kategori FROM buku
      WHERE kategori IS NOT NULL AND kategori != ''
      ORDER BY kategori ASC
    `).all().map(r => r.kategori);

    res.json({
      status: 'ok',
      data: rows,
      pagination: {
        page,
        limit,
        total,
        total_page: Math.ceil(total / limit)
      },
      kategori_list: kategoriList
    });
  } catch (err) {
    console.error('GET /buku error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// GET /api/buku/:id — Detail
// ================================================================
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM buku WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ status: 'error', message: 'Buku tidak ditemukan' });
    }
    res.json({ status: 'ok', data: row });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// POST /api/buku — Tambah buku
// ================================================================
router.post('/', (req, res) => {
  try {
    const errors = validateBuku(req.body);
    if (errors.length) {
      return res.status(400).json({ status: 'error', message: errors.join(', ') });
    }

    const {
      kode_buku, judul, penulis, penerbit, tahun_terbit,
      isbn, kategori, stok_total, lokasi_rak, cover_url
    } = req.body;

    const kodeBuku = kode_buku && kode_buku.trim() ? kode_buku.trim() : generateKodeBuku();
    const stok = Number(stok_total) || 0;

    // Cek duplikat kode_buku
    const existing = db.prepare('SELECT id FROM buku WHERE kode_buku = ?').get(kodeBuku);
    if (existing) {
      return res.status(400).json({ status: 'error', message: `Kode buku "${kodeBuku}" sudah dipakai` });
    }

    const info = db.prepare(`
      INSERT INTO buku
      (kode_buku, judul, penulis, penerbit, tahun_terbit, isbn, kategori, stok_total, stok_tersedia, lokasi_rak, cover_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      kodeBuku,
      judul.trim(),
      penulis || null,
      penerbit || null,
      tahun_terbit ? Number(tahun_terbit) : null,
      isbn || null,
      kategori || null,
      stok,
      stok, // stok_tersedia = stok_total saat baru
      lokasi_rak || null,
      cover_url || null
    );

    const created = db.prepare('SELECT * FROM buku WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ status: 'ok', message: 'Buku berhasil ditambahkan', data: created });
  } catch (err) {
    console.error('POST /buku error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// PUT /api/buku/:id — Update buku
// ================================================================
router.put('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM buku WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Buku tidak ditemukan' });
    }

    const errors = validateBuku(req.body, true);
    if (errors.length) {
      return res.status(400).json({ status: 'error', message: errors.join(', ') });
    }

    const {
      kode_buku, judul, penulis, penerbit, tahun_terbit,
      isbn, kategori, stok_total, lokasi_rak, cover_url
    } = req.body;

    const stok = stok_total !== undefined ? Number(stok_total) : existing.stok_total;

    // Hitung selisih stok untuk update stok_tersedia
    const selisih = stok - existing.stok_total;
    let stokTersediaBaru = existing.stok_tersedia + selisih;
    if (stokTersediaBaru < 0) stokTersediaBaru = 0;
    if (stokTersediaBaru > stok) stokTersediaBaru = stok;

    // Cek duplikat kode_buku (selain id ini)
    const newKode = (kode_buku || existing.kode_buku).trim();
    const dup = db.prepare('SELECT id FROM buku WHERE kode_buku = ? AND id != ?').get(newKode, id);
    if (dup) {
      return res.status(400).json({ status: 'error', message: `Kode buku "${newKode}" sudah dipakai` });
    }

    db.prepare(`
      UPDATE buku SET
        kode_buku = ?, judul = ?, penulis = ?, penerbit = ?,
        tahun_terbit = ?, isbn = ?, kategori = ?,
        stok_total = ?, stok_tersedia = ?,
        lokasi_rak = ?, cover_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newKode,
      (judul || existing.judul).trim(),
      penulis ?? existing.penulis,
      penerbit ?? existing.penerbit,
      tahun_terbit ? Number(tahun_terbit) : existing.tahun_terbit,
      isbn ?? existing.isbn,
      kategori ?? existing.kategori,
      stok,
      stokTersediaBaru,
      lokasi_rak ?? existing.lokasi_rak,
      cover_url ?? existing.cover_url,
      id
    );

    const updated = db.prepare('SELECT * FROM buku WHERE id = ?').get(id);
    res.json({ status: 'ok', message: 'Buku berhasil diupdate', data: updated });
  } catch (err) {
    console.error('PUT /buku error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// DELETE /api/buku/:id
// ================================================================
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM buku WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Buku tidak ditemukan' });
    }

    // Cek apakah buku sedang dipinjam
    const dipinjam = db.prepare(`
      SELECT COUNT(*) as n FROM peminjaman_detail
      WHERE buku_id = ? AND status = 'dipinjam'
    `).get(id).n;

    if (dipinjam > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Tidak bisa dihapus, ada ${dipinjam} buku sedang dipinjam`
      });
    }

    db.prepare('DELETE FROM buku WHERE id = ?').run(id);
    res.json({ status: 'ok', message: 'Buku berhasil dihapus' });
  } catch (err) {
    console.error('DELETE /buku error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;