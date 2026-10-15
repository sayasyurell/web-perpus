// ================================================================
// routes/anggota.js — CRUD Anggota + Import CSV
// ================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');

// ================================================================
// GET /api/anggota — List dengan pagination, search, filter
// ================================================================
router.get('/', (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const jenis  = (req.query.jenis || '').trim();
    const kelas  = (req.query.kelas || '').trim();
    const status = (req.query.status || '').trim();

    const where = [];
    const params = {};

    if (search) {
      where.push('(nis LIKE @search OR nama LIKE @search OR kelas LIKE @search)');
      params.search = `%${search}%`;
    }
    if (jenis) { where.push('jenis = @jenis');   params.jenis = jenis; }
    if (kelas) { where.push('kelas = @kelas');   params.kelas = kelas; }
    if (status){ where.push('status = @status'); params.status = status; }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`SELECT COUNT(*) as n FROM anggota ${whereSQL}`).get(params).n;

    const rows = db.prepare(`
      SELECT * FROM anggota
      ${whereSQL}
      ORDER BY jenis ASC, kelas ASC, nama ASC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    // Daftar unik untuk dropdown filter
    const kelasList = db.prepare(`
      SELECT DISTINCT kelas FROM anggota
      WHERE kelas IS NOT NULL AND kelas != ''
      ORDER BY kelas ASC
    `).all().map(r => r.kelas);

    res.json({
      status: 'ok',
      data: rows,
      pagination: { page, limit, total, total_page: Math.ceil(total / limit) },
      kelas_list: kelasList
    });
  } catch (err) {
    console.error('GET /anggota error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// GET /api/anggota/export — Download CSV semua anggota
// (harus SEBELUM /:id supaya tidak tabrakan)
// ================================================================
router.get('/export', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat, status
      FROM anggota ORDER BY jenis, kelas, nama
    `).all();

    const header = 'nis,nama,jenis,kelas,jenis_kelamin,no_hp,alamat,status';
    const escapeCSV = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [header];
    for (const r of rows) {
      lines.push([r.nis, r.nama, r.jenis, r.kelas, r.jenis_kelamin, r.no_hp, r.alamat, r.status]
        .map(escapeCSV).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="anggota_${Date.now()}.csv"`);
    res.send('\uFEFF' + lines.join('\n')); // BOM biar Excel nampilkan UTF-8 dengan benar
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// GET /api/anggota/:id — Detail
// ================================================================
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM anggota WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ status: 'error', message: 'Anggota tidak ditemukan' });
    res.json({ status: 'ok', data: row });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// POST /api/anggota — Tambah
// ================================================================
router.post('/', (req, res) => {
  try {
    const { nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat } = req.body;

    if (!nis || !String(nis).trim()) return res.status(400).json({ status: 'error', message: 'NIS wajib diisi' });
    if (!nama || !String(nama).trim()) return res.status(400).json({ status: 'error', message: 'Nama wajib diisi' });

    const dup = db.prepare('SELECT id FROM anggota WHERE nis = ?').get(String(nis).trim());
    if (dup) return res.status(400).json({ status: 'error', message: `NIS "${nis}" sudah terdaftar` });

    const info = db.prepare(`
      INSERT INTO anggota (nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(nis).trim(),
      String(nama).trim(),
      jenis || 'siswa',
      kelas || null,
      jenis_kelamin || null,
      no_hp || null,
      alamat || null
    );

    const created = db.prepare('SELECT * FROM anggota WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ status: 'ok', message: 'Anggota berhasil ditambahkan', data: created });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// PUT /api/anggota/:id — Update
// ================================================================
router.put('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM anggota WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ status: 'error', message: 'Anggota tidak ditemukan' });

    const { nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat, status } = req.body;

    const newNis = (nis !== undefined ? String(nis).trim() : existing.nis);
    if (!newNis) return res.status(400).json({ status: 'error', message: 'NIS wajib diisi' });

    const dup = db.prepare('SELECT id FROM anggota WHERE nis = ? AND id != ?').get(newNis, id);
    if (dup) return res.status(400).json({ status: 'error', message: `NIS "${newNis}" sudah dipakai anggota lain` });

    db.prepare(`
      UPDATE anggota SET
        nis = ?, nama = ?, jenis = ?, kelas = ?,
        jenis_kelamin = ?, no_hp = ?, alamat = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newNis,
      (nama !== undefined ? String(nama).trim() : existing.nama),
      jenis ?? existing.jenis,
      kelas ?? existing.kelas,
      jenis_kelamin ?? existing.jenis_kelamin,
      no_hp ?? existing.no_hp,
      alamat ?? existing.alamat,
      status ?? existing.status,
      id
    );

    const updated = db.prepare('SELECT * FROM anggota WHERE id = ?').get(id);
    res.json({ status: 'ok', message: 'Anggota berhasil diupdate', data: updated });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// DELETE /api/anggota/:id
// ================================================================
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM anggota WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ status: 'error', message: 'Anggota tidak ditemukan' });

    // Cek apakah masih ada peminjaman aktif
    const aktif = db.prepare(`
      SELECT COUNT(*) as n FROM peminjaman
      WHERE anggota_id = ? AND status IN ('dipinjam', 'sebagian')
    `).get(id).n;

    if (aktif > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Tidak bisa dihapus, masih ada ${aktif} peminjaman aktif`
      });
    }

    db.prepare('DELETE FROM anggota WHERE id = ?').run(id);
    res.json({ status: 'ok', message: 'Anggota berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================================================================
// POST /api/anggota/import — Import massal dari CSV (array JSON)
// Body: { rows: [ {nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat}, ... ] }
// ================================================================
router.post('/import', (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ status: 'error', message: 'Tidak ada baris untuk di-import' });
    }
    if (rows.length > 20000) {
      return res.status(400).json({ status: 'error', message: 'Maksimal 20.000 baris per import' });
    }

    const insert = db.prepare(`
      INSERT INTO anggota (nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat)
      VALUES (@nis, @nama, @jenis, @kelas, @jenis_kelamin, @no_hp, @alamat)
    `);
    const check = db.prepare('SELECT id FROM anggota WHERE nis = ?');

    const hasil = { sukses: 0, duplikat: 0, gagal: 0, errors: [] };

    // Transaction = kunci performa untuk ribuan baris
    const insertMany = db.transaction((data) => {
      data.forEach((r, idx) => {
        const nis  = (r.nis  || '').toString().trim();
        const nama = (r.nama || '').toString().trim();

        if (!nis || !nama) {
          hasil.gagal++;
          hasil.errors.push(`Baris ${idx + 2}: NIS/nama kosong`);
          return;
        }
        if (check.get(nis)) {
          hasil.duplikat++;
          return;
        }
        try {
          insert.run({
            nis,
            nama,
            jenis: r.jenis || 'siswa',
            kelas: r.kelas || null,
            jenis_kelamin: r.jenis_kelamin || null,
            no_hp: r.no_hp || null,
            alamat: r.alamat || null
          });
          hasil.sukses++;
        } catch (e) {
          hasil.gagal++;
          hasil.errors.push(`Baris ${idx + 2} (${nis}): ${e.message}`);
        }
      });
    });

    insertMany(rows);

    res.json({
      status: 'ok',
      message: `Import selesai: ${hasil.sukses} sukses, ${hasil.duplikat} duplikat, ${hasil.gagal} gagal`,
      hasil
    });
  } catch (err) {
    console.error('POST /anggota/import error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;