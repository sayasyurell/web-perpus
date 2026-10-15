// ================================================================
// db.js — Koneksi & Inisialisasi Database SQLite
// ================================================================
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Pastikan folder database ada
const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'perpus.db');

// Buka / buat database
const db = new Database(DB_PATH);

// Konfigurasi performa (penting untuk ribuan data)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

console.log(`📦 Database: ${DB_PATH}`);

// ================================================================
// SCHEMA — Dijalankan setiap start (IF NOT EXISTS, aman)
// ================================================================
db.exec(`
  -- ============ TABEL BUKU ============
  CREATE TABLE IF NOT EXISTS buku (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_buku       TEXT UNIQUE,
    judul           TEXT NOT NULL,
    penulis         TEXT,
    penerbit        TEXT,
    tahun_terbit    INTEGER,
    isbn            TEXT,
    kategori        TEXT,
    stok_total      INTEGER NOT NULL DEFAULT 0,
    stok_tersedia   INTEGER NOT NULL DEFAULT 0,
    lokasi_rak      TEXT,
    cover_url       TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_buku_judul    ON buku(judul);
  CREATE INDEX IF NOT EXISTS idx_buku_penulis  ON buku(penulis);
  CREATE INDEX IF NOT EXISTS idx_buku_kategori ON buku(kategori);
  CREATE INDEX IF NOT EXISTS idx_buku_kode     ON buku(kode_buku);

  -- ============ TABEL ANGGOTA ============
  CREATE TABLE IF NOT EXISTS anggota (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nis             TEXT UNIQUE NOT NULL,
    nama            TEXT NOT NULL,
    jenis           TEXT NOT NULL DEFAULT 'siswa',  -- siswa / guru / staf
    kelas           TEXT,
    jenis_kelamin   TEXT,                            -- L / P
    no_hp           TEXT,
    alamat          TEXT,
    status          TEXT NOT NULL DEFAULT 'aktif',   -- aktif / nonaktif
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_anggota_nis   ON anggota(nis);
  CREATE INDEX IF NOT EXISTS idx_anggota_nama  ON anggota(nama);
  CREATE INDEX IF NOT EXISTS idx_anggota_kelas ON anggota(kelas);

  -- ============ TABEL PEMINJAMAN (header) ============
  CREATE TABLE IF NOT EXISTS peminjaman (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_pinjam       TEXT UNIQUE NOT NULL,
    anggota_id        INTEGER NOT NULL,
    tanggal_pinjam    DATE NOT NULL,
    tanggal_jatuh     DATE NOT NULL,
    tanggal_kembali   DATE,                          -- NULL = belum dikembalikan semua
    status            TEXT NOT NULL DEFAULT 'dipinjam', -- dipinjam / dikembalikan / sebagian
    denda             INTEGER NOT NULL DEFAULT 0,
    catatan           TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_pinjam_anggota ON peminjaman(anggota_id);
  CREATE INDEX IF NOT EXISTS idx_pinjam_status  ON peminjaman(status);
  CREATE INDEX IF NOT EXISTS idx_pinjam_tgl     ON peminjaman(tanggal_pinjam);

  -- ============ TABEL PEMINJAMAN DETAIL (per buku) ============
  CREATE TABLE IF NOT EXISTS peminjaman_detail (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    peminjaman_id   INTEGER NOT NULL,
    buku_id         INTEGER NOT NULL,
    jumlah          INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'dipinjam', -- dipinjam / dikembalikan
    tanggal_kembali DATE,
    denda           INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id) ON DELETE CASCADE,
    FOREIGN KEY (buku_id)      REFERENCES buku(id)      ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_detail_pinjam ON peminjaman_detail(peminjaman_id);
  CREATE INDEX IF NOT EXISTS idx_detail_buku   ON peminjaman_detail(buku_id);

  -- ============ TABEL PENGATURAN ============
  CREATE TABLE IF NOT EXISTS pengaturan (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    keterangan  TEXT
  );
`);

console.log('✅ Schema database siap');

// ================================================================
// SEED — Isi data default jika tabel masih kosong
// ================================================================

// Pengaturan default
const pengaturanDefault = [
  ['denda_per_hari',       '500',  'Denda keterlambatan per hari (Rp)'],
  ['lama_pinjam_default',  '7',    'Lama peminjaman default (hari)'],
  ['max_buku_per_pinjam',  '3',    'Maksimal buku per transaksi'],
  ['nama_perpustakaan',    'Perpustakaan Sekolah', 'Nama perpustakaan'],
];

const insertPengaturan = db.prepare(`
  INSERT OR IGNORE INTO pengaturan (key, value, keterangan) VALUES (?, ?, ?)
`);
pengaturanDefault.forEach(p => insertPengaturan.run(...p));

// Seed buku contoh (hanya jika tabel kosong)
const countBuku = db.prepare('SELECT COUNT(*) as n FROM buku').get().n;
if (countBuku === 0) {
  const seedBuku = db.prepare(`
    INSERT INTO buku (kode_buku, judul, penulis, penerbit, tahun_terbit, kategori, stok_total, stok_tersedia, lokasi_rak)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const contohBuku = [
    ['BK-001', 'Laskar Pelangi', 'Andrea Hirata', 'Bentang Pustaka', 2005, 'Novel', 5, 5, 'A-01'],
    ['BK-002', 'Bumi Manusia', 'Pramoedya Ananta Toer', 'Hasta Mitra', 1980, 'Novel', 3, 3, 'A-02'],
    ['BK-003', 'Filosofi Teras', 'Henry Manampiring', 'Kompas', 2018, 'Non-Fiksi', 4, 4, 'B-01'],
    ['BK-004', 'Matematika Kelas X', 'Kemendikbud', 'Erlangga', 2020, 'Pelajaran', 20, 20, 'C-01'],
    ['BK-005', 'Bahasa Indonesia Kelas X', 'Kemendikbud', 'Erlangga', 2020, 'Pelajaran', 20, 20, 'C-02'],
    ['BK-006', 'Sapiens', 'Yuval Noah Harari', 'Kepustakaan Populer Gramedia', 2017, 'Sejarah', 2, 2, 'B-03'],
    ['BK-007', 'Atomic Habits', 'James Clear', 'Gramedia', 2019, 'Pengembangan Diri', 3, 3, 'B-04'],
    ['BK-008', 'Negeri 5 Menara', 'Ahmad Fuadi', 'Gramedia', 2009, 'Novel', 4, 4, 'A-03'],
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) seedBuku.run(...row);
  });
  insertMany(contohBuku);
  console.log(`📚 Seed ${contohBuku.length} buku contoh`);
}

// Seed anggota contoh
const countAnggota = db.prepare('SELECT COUNT(*) as n FROM anggota').get().n;
if (countAnggota === 0) {
  const insertAnggota = db.prepare(`
    INSERT INTO anggota (nis, nama, jenis, kelas, jenis_kelamin, no_hp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const contohAnggota = [
    ['2024001', 'Ahmad Fauzi',        'siswa', 'X-IPA-1', 'L', '081234567001'],
    ['2024002', 'Siti Nurhaliza',     'siswa', 'X-IPA-1', 'P', '081234567002'],
    ['2024003', 'Budi Santoso',       'siswa', 'X-IPS-1', 'L', '081234567003'],
    ['2024004', 'Dewi Lestari',       'siswa', 'XI-IPA-2', 'P', '081234567004'],
    ['2024005', 'Rizki Pratama',      'siswa', 'XI-IPS-1', 'L', '081234567005'],
    ['G001',    'Pak Bambang, S.Pd',  'guru',  null,      'L', '081234567010'],
    ['G002',    'Bu Sri, M.Pd',       'guru',  null,      'P', '081234567011'],
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insertAnggota.run(...row);
  });
  insertMany(contohAnggota);
  console.log(`👥 Seed ${contohAnggota.length} anggota contoh`);
}

// ================================================================
// EXPORT
// ================================================================
module.exports = db;