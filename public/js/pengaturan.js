// ================================================================
// pengaturan.js — Logika halaman Pengaturan
// ================================================================

const state = {
  settings: {},
  resetType: null,
  anggotaList: []
};

function formatTanggalWaktu(str) {
  if (!str) return '-';
  const d = new Date(str);
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ================================================================
// LOAD
// ================================================================
async function loadPengaturan() {
  try {
    const res = await apiGet('/pengaturan');
    state.settings = {};
    res.data.forEach(p => { state.settings[p.key] = p.value; });

    // Isi form
    document.getElementById('f-nama_perpustakaan').value  = state.settings.nama_perpustakaan || '';
    document.getElementById('f-denda_per_hari').value     = state.settings.denda_per_hari || 500;
    document.getElementById('f-lama_pinjam_default').value = state.settings.lama_pinjam_default || 7;
    document.getElementById('f-max_buku_per_pinjam').value = state.settings.max_buku_per_pinjam || 3;

    // Info aplikasi — versi otomatis dari package.json
    const versionEl = document.querySelector('[data-app-version]');
    if (versionEl && res.app) versionEl.textContent = 'v' + res.app.version;

    // Isi info
    const info = res.info;
    document.getElementById('info-size').textContent = info.db_size_human;
    document.getElementById('info-mtime').textContent = formatTanggalWaktu(info.db_mtime);
    document.getElementById('info-buku').textContent = info.counts.buku.toLocaleString('id-ID');
    document.getElementById('info-anggota').textContent = info.counts.anggota.toLocaleString('id-ID');
    document.getElementById('info-peminjaman').textContent = info.counts.peminjaman.toLocaleString('id-ID');
    document.getElementById('info-detail').textContent = info.counts.detail.toLocaleString('id-ID');
  } catch (err) {
    toast('Gagal memuat pengaturan: ' + err.message, 'error');
  }
}

// ================================================================
// SIMPAN
// ================================================================
async function simpanPengaturan(e) {
  e.preventDefault();

  const payload = {
    nama_perpustakaan:   document.getElementById('f-nama_perpustakaan').value.trim(),
    denda_per_hari:      document.getElementById('f-denda_per_hari').value,
    lama_pinjam_default: document.getElementById('f-lama_pinjam_default').value,
    max_buku_per_pinjam: document.getElementById('f-max_buku_per_pinjam').value
  };

  const btn = document.getElementById('btn-simpan');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const res = await apiPut('/pengaturan', payload);
    toast(res.message, 'success');
    await loadPengaturan();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Simpan Pengaturan';
  }
}

// ================================================================
// BACKUP
// ================================================================
function downloadBackup() {
  toast('Menyiapkan backup...', 'info');
  window.location.href = '/api/pengaturan/backup';
}

// ================================================================
// RESET
// ================================================================
function bukaModalReset(type) {
  state.resetType = type;
  const title = document.getElementById('reset-title');
  const desc = document.getElementById('reset-desc');

  if (type === 'peminjaman') {
    title.textContent = 'Reset Data Peminjaman?';
    desc.textContent = 'Semua transaksi peminjaman akan dihapus dan stok buku dikembalikan seperti semula.';
  } else {
    title.textContent = 'Hapus SEMUA Data?';
    desc.textContent = 'Semua buku, anggota, dan peminjaman akan dihapus permanen. Pengaturan tetap disimpan.';
  }

  document.getElementById('input-konfirmasi').value = '';
  document.getElementById('btn-konfirmasi-reset').disabled = true;
  document.getElementById('modal-reset').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-konfirmasi').focus(), 100);
}

async function lakukanReset() {
  const btn = document.getElementById('btn-konfirmasi-reset');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const res = await apiPost('/pengaturan/reset', {
      konfirmasi: 'HAPUS',
      what: state.resetType
    });
    toast(res.message, 'success');
    document.getElementById('modal-reset').classList.add('hidden');
    await loadPengaturan();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Konfirmasi Reset';
  }
}

// ================================================================
// KARTU ANGGOTA QR
// ================================================================
async function loadAnggotaDropdown() {
  try {
    const res = await apiGet('/anggota', { limit: 200, status: 'aktif' });
    state.anggotaList = res.data;

    const sel = document.getElementById('pilih-anggota');
    sel.innerHTML = '<option value="">-- Pilih Anggota --</option>' +
      res.data.map(a =>
        `<option value="${a.id}">${escapeHtml(a.nama)} — ${escapeHtml(a.nis)}${a.kelas ? ' (' + escapeHtml(a.kelas) + ')' : ''}</option>`
      ).join('');
  } catch (err) {
    toast('Gagal memuat anggota: ' + err.message, 'error');
  }
}

// ================================================================
// KARTU ANGGOTA BARCODE (EAN-13 format ISBN)
// ================================================================

// Konversi NIS → EAN-13 (13 digit valid)
function nisToEAN13(nis) {
  const digits = String(nis).replace(/\D/g, '');
  const prefix = '200'; // Prefix internal perpustakaan
  const body = digits.padStart(9, '0').slice(-9);
  const base12 = prefix + body;

  // Hitung check digit EAN-13 (standar internasional)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base12[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;

  return base12 + check;
}

async function generateKartuHTML(anggota) {
  const namaPerpus = state.settings.nama_perpustakaan || 'Perpustakaan Sekolah';
  const barcodeVal = nisToEAN13(anggota.nis);
  const uid = 'bc-' + anggota.id + '-' + Math.random().toString(36).slice(2, 6);

  return `
    <div class="print-card">
      <div class="print-card-header">
        <img src="/img/logo.png" alt="Logo">
        <div class="print-card-title">
          ${escapeHtml(namaPerpus)}
          <div class="sub">Kartu Anggota Perpustakaan</div>
        </div>
      </div>

      <div class="print-card-info-block">
        <div class="name">${escapeHtml(anggota.nama)}</div>
        <div class="nis">NIS: ${escapeHtml(anggota.nis)}</div>
        <div class="meta">
          ${escapeHtml(anggota.kelas) || '—'} · ${anggota.jenis.toUpperCase()}
          ${anggota.jenis_kelamin ? ' · ' + (anggota.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan') : ''}
        </div>
      </div>

      <div class="print-card-barcode">
        <svg id="${uid}" class="barcode-svg" data-value="${barcodeVal}"></svg>
      </div>

      <div class="print-card-footer">
        <span>Simpan kartu ini dengan baik</span>
        <span>${new Date().getFullYear()}</span>
      </div>
    </div>
  `;
}

// Render semua barcode setelah HTML di-insert
function renderAllBarcodes() {
  if (typeof JsBarcode === 'undefined') {
    console.warn('JsBarcode belum ke-load');
    return;
  }
  document.querySelectorAll('.barcode-svg').forEach(svg => {
    const val = svg.dataset.value;
    if (!val) return;
    try {
      JsBarcode(svg, val, {
        format: 'EAN13',
        width: 1.4,
        height: 38,
        displayValue: true,
        fontSize: 9,
        margin: 0,
        font: 'Courier New',
        textMargin: 1
      });
    } catch (e) {
      // Fallback kalau EAN13 tidak valid
      try {
        JsBarcode(svg, val, {
          format: 'CODE128',
          width: 1.4, height: 38, displayValue: true,
          fontSize: 9, margin: 0, font: 'Courier New'
        });
      } catch (e2) { console.error('Barcode gagal:', e2); }
    }
  });
}

async function cetakKartu() {
  const id = document.getElementById('pilih-anggota').value;
  if (!id) return toast('Pilih anggota dulu', 'warning');

  const anggota = state.anggotaList.find(a => a.id == id);
  if (!anggota) return toast('Anggota tidak ditemukan', 'error');

  const html = await generateKartuHTML(anggota);

  document.getElementById('print-area').innerHTML = `
    <div class="print-page">
      <div class="print-cards-container">${html}</div>
    </div>
  `;
  setTimeout(() => { 
  renderAllBarcodes(); 
  setTimeout(() => window.print(), 300); // Naikkan ke 300ms
}, 100);
}

async function cetakSemuaKartu() {
  if (!state.anggotaList.length) return toast('Belum ada anggota', 'warning');

  const list = state.anggotaList.slice(0, 10);
  const cards = await Promise.all(list.map(a => generateKartuHTML(a)));

  document.getElementById('print-area').innerHTML = `
    <div class="print-page">
      <div class="print-header">
        <h1>Kartu Anggota Perpustakaan</h1>
        <p class="meta">${list.length} kartu — ${new Date().toLocaleDateString('id-ID')}</p>
      </div>
      <div class="print-cards-container">${cards.join('')}</div>
    </div>
  `;
  setTimeout(() => { 
  renderAllBarcodes(); 
  setTimeout(() => window.print(), 300); // Naikkan ke 300ms
}, 100);
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadPengaturan();
  await loadAnggotaDropdown();

  // Form pengaturan
  document.getElementById('form-pengaturan').addEventListener('submit', simpanPengaturan);

  // Backup
  document.getElementById('btn-backup').addEventListener('click', downloadBackup);

  // Reset
  document.getElementById('btn-reset-peminjaman').addEventListener('click', () => bukaModalReset('peminjaman'));
  document.getElementById('btn-reset-semua').addEventListener('click', () => bukaModalReset('semua'));

  // Modal reset
  const inputKonfirmasi = document.getElementById('input-konfirmasi');
  inputKonfirmasi.addEventListener('input', (e) => {
    document.getElementById('btn-konfirmasi-reset').disabled = e.target.value !== 'HAPUS';
  });

  document.getElementById('btn-cancel-reset').addEventListener('click', () => {
    document.getElementById('modal-reset').classList.add('hidden');
  });
  document.getElementById('btn-konfirmasi-reset').addEventListener('click', lakukanReset);
  document.getElementById('modal-reset').addEventListener('click', (e) => {
    if (e.target.id === 'modal-reset') e.currentTarget.classList.add('hidden');
  });

  // Kartu
  document.getElementById('pilih-anggota').addEventListener('change', (e) => {
    document.getElementById('btn-cetak-kartu').disabled = !e.target.value;
  });
  document.getElementById('btn-cetak-kartu').addEventListener('click', cetakKartu);
  document.getElementById('btn-cetak-semua').addEventListener('click', cetakSemuaKartu);

  // Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('modal-reset').classList.add('hidden');
  });
});