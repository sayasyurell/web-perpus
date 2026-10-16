// ================================================================
// anggota.js — Logika halaman Kelola Anggota
// ================================================================

const state = {
  page: 1,
  limit: 20,
  search: '',
  jenis: '',
  kelas: '',
  status: '',
  total_page: 1,
  kelasList: [],
  deleteId: null,
  deleteNama: '',
  csvData: [],       // hasil parse CSV
  csvHeaders: []
};

// ================================================================
// LOAD DATA
// ================================================================
async function loadAnggota() {
  const tbody = document.getElementById('tabel-body');
  tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">⏳ Memuat data...</td></tr>`;

  try {
    const res = await apiGet('/anggota', {
      page: state.page, limit: state.limit,
      search: state.search, jenis: state.jenis,
      kelas: state.kelas, status: state.status
    });
    renderTabel(res.data);
    renderPagination(res.pagination);
    renderKelasDropdown(res.kelas_list);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-red-500">❌ ${err.message}</td></tr>`;
  }
}

// ================================================================
// RENDER TABEL
// ================================================================
function renderTabel(list) {
  const tbody = document.getElementById('tabel-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">📭 Tidak ada data anggota</td></tr>`;
    return;
  }

  const startNo = (state.page - 1) * state.limit + 1;

  tbody.innerHTML = list.map((a, i) => {
    const jenisBadge = {
      siswa: '<span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Siswa</span>',
      guru:  '<span class="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">Guru</span>',
      staf:  '<span class="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Staf</span>'
    }[a.jenis] || a.jenis;

    const statusBadge = a.status === 'aktif'
      ? '<span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Aktif</span>'
      : '<span class="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-600">Nonaktif</span>';

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 ${a.status !== 'aktif' ? 'opacity-60' : ''}">
        <td class="px-4 py-3 text-slate-500">${startNo + i}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-600">${escapeHtml(a.nis)}</td>
        <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(a.nama)}</td>
        <td class="px-4 py-3">${jenisBadge}</td>
        <td class="px-4 py-3 text-slate-600">${escapeHtml(a.kelas) || '-'}</td>
        <td class="px-4 py-3 text-slate-600">${a.jenis_kelamin || '-'}</td>
        <td class="px-4 py-3 text-center">${statusBadge}</td>
        <td class="px-4 py-3">
          <div class="flex gap-1 justify-center">
<button data-action="editAnggota" data-id="${a.id}" title="Edit" class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
  ✏️
</button>
<button data-action="konfirmasiHapus" data-id="${a.id}" data-str="${escapeHtml(a.nama)}" title="Hapus" class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
  🗑️
</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ================================================================
// PAGINATION
// ================================================================
function renderPagination(p) {
  state.total_page = p.total_page;
  const start = (p.page - 1) * p.limit + 1;
  const end = Math.min(p.page * p.limit, p.total);

  document.getElementById('info-page').textContent =
    p.total === 0 ? 'Tidak ada data' :
    `Menampilkan ${start}–${end} dari ${p.total} anggota`;

  const btn = (label, targetPage, disabled = false, active = false) => `
    <button ${disabled ? 'disabled' : ''} data-action="gotoPage" data-id="${targetPage}"
      class="px-3 py-1.5 rounded text-sm border ${
        active ? 'bg-blue-600 text-white border-blue-600'
        : disabled ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
      }">${label}</button>
  `;

  document.getElementById('pagination').innerHTML =
    btn('«', p.page - 1, p.page <= 1) +
    btn(String(p.page), p.page, false, true) +
    btn('»', p.page + 1, p.page >= p.total_page);
}

function gotoPage(p) {
  if (p < 1 || p > state.total_page) return;
  state.page = p;
  loadAnggota();
}

function renderKelasDropdown(list) {
  if (JSON.stringify(list) === JSON.stringify(state.kelasList)) return;
  state.kelasList = list;
  const sel = document.getElementById('filter-kelas');
  sel.innerHTML = '<option value="">Semua Kelas</option>' +
    list.map(k => `<option value="${escapeHtml(k)}" ${k === state.kelas ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('');
}

// ================================================================
// MODAL FORM
// ================================================================
function openModal(mode = 'tambah', data = null) {
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('form-anggota').reset();
  document.getElementById('f-id').value = '';

  if (mode === 'edit' && data) {
    document.getElementById('modal-title').textContent = 'Edit Anggota';
    document.getElementById('f-id').value = data.id;
    document.getElementById('f-nis').value = data.nis || '';
    document.getElementById('f-nama').value = data.nama || '';
    document.getElementById('f-jenis').value = data.jenis || 'siswa';
    document.getElementById('f-kelas').value = data.kelas || '';
    document.getElementById('f-jenis_kelamin').value = data.jenis_kelamin || '';
    document.getElementById('f-no_hp').value = data.no_hp || '';
    document.getElementById('f-alamat').value = data.alamat || '';
    document.getElementById('f-status').value = data.status || 'aktif';
  } else {
    document.getElementById('modal-title').textContent = 'Tambah Anggota';
  }

  setTimeout(() => document.getElementById('f-nis').focus(), 100);
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

async function submitForm(e) {
  e.preventDefault();
  const id = document.getElementById('f-id').value;
  const payload = {
    nis:           document.getElementById('f-nis').value.trim(),
    nama:          document.getElementById('f-nama').value.trim(),
    jenis:         document.getElementById('f-jenis').value,
    kelas:         document.getElementById('f-kelas').value.trim(),
    jenis_kelamin: document.getElementById('f-jenis_kelamin').value,
    no_hp:         document.getElementById('f-no_hp').value.trim(),
    alamat:        document.getElementById('f-alamat').value.trim(),
    status:        document.getElementById('f-status').value
  };

  const btn = document.getElementById('btn-submit');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  try {
    if (id) {
      await apiPut('/anggota/' + id, payload);
      toast('Anggota berhasil diupdate', 'success');
    } else {
      await apiPost('/anggota', payload);
      toast('Anggota berhasil ditambahkan', 'success');
    }
    closeModal();
    loadAnggota();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan';
  }
}

async function editAnggota(id) {
  try {
    const res = await apiGet('/anggota/' + id);
    openModal('edit', res.data);
  } catch (err) { toast(err.message, 'error'); }
}

// ================================================================
// HAPUS
// ================================================================
function konfirmasiHapus(id, nama) {
  state.deleteId = id; state.deleteNama = nama;
  document.getElementById('hapus-nama').textContent = nama;
  document.getElementById('modal-hapus').classList.remove('hidden');
}

async function lakukanHapus() {
  const btn = document.getElementById('btn-konfirmasi-hapus');
  btn.disabled = true; btn.textContent = 'Menghapus...';
  try {
    await apiDelete('/anggota/' + state.deleteId);
    toast('Anggota berhasil dihapus', 'success');
    document.getElementById('modal-hapus').classList.add('hidden');
    loadAnggota();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Hapus';
  }
}

// ================================================================
// IMPORT CSV — Parsing
// ================================================================

// Parser CSV sederhana yang support tanda kutip
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuote) {
      if (c === '"' && next === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { cur += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else { cur += c; }
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function openImportModal() {
  document.getElementById('modal-import').classList.remove('hidden');
  document.getElementById('file-csv').value = '';
  document.getElementById('preview-import').classList.add('hidden');
  document.getElementById('import-result').classList.add('hidden');
  document.getElementById('btn-proses-import').disabled = true;
  state.csvData = [];
  state.csvHeaders = [];
}

function closeImportModal() {
  document.getElementById('modal-import').classList.add('hidden');
}

function handleFileCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const text = ev.target.result;
      const rows = parseCSV(text);

      if (rows.length < 2) {
        toast('File CSV kosong atau hanya berisi header', 'error');
        return;
      }

      const headers = rows[0].map(h => h.trim().toLowerCase());
      const requiredCols = ['nis', 'nama'];
      const missing = requiredCols.filter(c => !headers.includes(c));
      if (missing.length) {
        toast(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'error');
        return;
      }

      // Konversi baris jadi object
      const data = rows.slice(1).map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
        return obj;
      });

      state.csvHeaders = headers;
      state.csvData = data;

      renderPreview(headers, data.slice(0, 10));
      document.getElementById('preview-import').classList.remove('hidden');
      document.getElementById('import-result').classList.add('hidden');
      document.getElementById('btn-proses-import').disabled = false;

      document.getElementById('preview-info').innerHTML =
        `✅ Terbaca <b>${data.length}</b> baris data. Preview 10 pertama:`;
    } catch (err) {
      toast('Gagal baca file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function renderPreview(headers, rows) {
  document.getElementById('preview-head').innerHTML =
    headers.map(h => `<th class="px-2 py-1.5 text-left font-semibold text-slate-600">${escapeHtml(h)}</th>`).join('');
  document.getElementById('preview-body').innerHTML = rows.map(r =>
    `<tr class="border-t border-slate-100">${headers.map(h =>
      `<td class="px-2 py-1.5 text-slate-700">${escapeHtml(r[h]) || '-'}</td>`
    ).join('')}</tr>`
  ).join('');
}

async function prosesImport() {
  if (!state.csvData.length) return;

  const btn = document.getElementById('btn-proses-import');
  btn.disabled = true;
  btn.textContent = `Memproses ${state.csvData.length} baris...`;

  try {
    const res = await apiPost('/anggota/import', { rows: state.csvData });
    const hasil = res.hasil;

    const resultEl = document.getElementById('import-result');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="font-semibold text-green-800 mb-2">✅ ${res.message}</div>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="bg-white rounded p-2 text-center">
            <div class="text-2xl font-bold text-green-600">${hasil.sukses}</div>
            <div class="text-xs text-slate-500">Sukses</div>
          </div>
          <div class="bg-white rounded p-2 text-center">
            <div class="text-2xl font-bold text-amber-600">${hasil.duplikat}</div>
            <div class="text-xs text-slate-500">Duplikat (skip)</div>
          </div>
          <div class="bg-white rounded p-2 text-center">
            <div class="text-2xl font-bold text-red-600">${hasil.gagal}</div>
            <div class="text-xs text-slate-500">Gagal</div>
          </div>
        </div>
        ${hasil.errors.length ? `
          <details class="mt-3 text-xs">
            <summary class="cursor-pointer text-red-700 font-medium">Detail error (${hasil.errors.length})</summary>
            <ul class="mt-2 space-y-1 text-red-600 max-h-40 overflow-y-auto list-disc list-inside">
              ${hasil.errors.slice(0, 50).map(e => `<li>${escapeHtml(e)}</li>`).join('')}
              ${hasil.errors.length > 50 ? `<li>... dan ${hasil.errors.length - 50} lainnya</li>` : ''}
            </ul>
          </details>
        ` : ''}
      </div>
    `;

    toast(`Import selesai: ${hasil.sukses} sukses`, 'success');
    loadAnggota();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Proses Import';
  }
}

function downloadTemplate() {
  const csv = [
    'nis,nama,jenis,kelas,jenis_kelamin,no_hp,alamat',
    '2025001,Ahmad Contoh,siswa,X-IPA-1,L,081234567001,Jl. Merdeka No. 1',
    '2025002,Siti Contoh,siswa,X-IPA-1,P,081234567002,Jl. Sudirman No. 2',
    'G010,Bapak Guru,guru,,L,081234567010,'
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'template_import_anggota.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Form modal
  document.getElementById('btn-tambah').addEventListener('click', () => openModal('tambah'));
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('form-anggota').addEventListener('submit', submitForm);

  // Hapus modal
  document.getElementById('btn-cancel-hapus').addEventListener('click', () => {
    document.getElementById('modal-hapus').classList.add('hidden');
  });
  document.getElementById('btn-konfirmasi-hapus').addEventListener('click', lakukanHapus);

  // Import modal
  document.getElementById('btn-import').addEventListener('click', openImportModal);
  document.getElementById('btn-close-import').addEventListener('click', closeImportModal);
  document.getElementById('btn-cancel-import').addEventListener('click', closeImportModal);
  document.getElementById('file-csv').addEventListener('change', handleFileCSV);
  document.getElementById('btn-proses-import').addEventListener('click', prosesImport);
  document.getElementById('btn-download-template').addEventListener('click', downloadTemplate);

  // Export
  document.getElementById('btn-export').addEventListener('click', () => {
    window.location.href = '/api/anggota/export';
  });

  // Filter & search
  let searchTimer = null;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 1;
      loadAnggota();
    }, 400);
  });

  document.getElementById('filter-jenis').addEventListener('change', (e) => {
    state.jenis = e.target.value; state.page = 1; loadAnggota();
  });
  document.getElementById('filter-kelas').addEventListener('change', (e) => {
    state.kelas = e.target.value; state.page = 1; loadAnggota();
  });
  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.status = e.target.value; state.page = 1; loadAnggota();
  });
  document.getElementById('filter-limit').addEventListener('change', (e) => {
    state.limit = Number(e.target.value); state.page = 1; loadAnggota();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    state.page = 1; state.search = ''; state.jenis = ''; state.kelas = ''; state.status = '';
    document.getElementById('search').value = '';
    document.getElementById('filter-jenis').value = '';
    document.getElementById('filter-kelas').value = '';
    document.getElementById('filter-status').value = '';
    loadAnggota();
  });

  // Esc tutup semua modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeImportModal();
      document.getElementById('modal-hapus').classList.add('hidden');
    }
  });

  // Klik backdrop untuk tutup
  ['modal', 'modal-hapus', 'modal-import'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('click', (e) => {
      if (e.target.id === id) el.classList.add('hidden');
    });
  });

  // Event delegation untuk tombol aksi
document.getElementById('tabel-body').addEventListener('click', (e) => {
  const btnEdit = e.target.closest('.btn-edit');
  if (btnEdit) return editAnggota(btnEdit.dataset.id);

  const btnHapus = e.target.closest('.btn-hapus');
  if (btnHapus) return konfirmasiHapus(btnHapus.dataset.id, btnHapus.dataset.nama);
});

  loadAnggota();
});