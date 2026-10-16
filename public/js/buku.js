// ================================================================
// buku.js — Logika halaman Kelola Buku
// ================================================================

const state = {
  page: 1,
  limit: 10,
  search: '',
  kategori: '',
  total_page: 1,
  kategoriList: [],
  deleteId: null,
  deleteNama: ''
};

// ================================================================
// LOAD DATA
// ================================================================
async function loadBuku() {
  const tbody = document.getElementById('tabel-body');
  tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400">⏳ Memuat data...</td></tr>`;

  try {
    const res = await apiGet('/buku', {
      page: state.page,
      limit: state.limit,
      search: state.search,
      kategori: state.kategori
    });

    renderTabel(res.data);
    renderPagination(res.pagination);
    renderKategoriDropdown(res.kategori_list);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-red-500">❌ ${err.message}</td></tr>`;
  }
}

// ================================================================
// RENDER TABEL
// ================================================================
function renderTabel(list) {
  const tbody = document.getElementById('tabel-body');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400">📭 Tidak ada data buku</td></tr>`;
    return;
  }

  const startNo = (state.page - 1) * state.limit + 1;

  tbody.innerHTML = list.map((b, i) => {
    const stokBadge = b.stok_tersedia === 0
      ? `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">${b.stok_tersedia}/${b.stok_total} (habis)</span>`
      : b.stok_tersedia < b.stok_total
        ? `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">${b.stok_tersedia}/${b.stok_total}</span>`
        : `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">${b.stok_tersedia}/${b.stok_total}</span>`;

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-4 py-3 text-slate-500">${startNo + i}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-600">${escapeHtml(b.kode_buku)}</td>
        <td class="px-4 py-3">
          <div class="font-medium text-slate-800">${escapeHtml(b.judul)}</div>
          ${b.penerbit ? `<div class="text-xs text-slate-400">${escapeHtml(b.penerbit)}${b.tahun_terbit ? ' · ' + b.tahun_terbit : ''}</div>` : ''}
        </td>
        <td class="px-4 py-3 text-slate-600">${escapeHtml(b.penulis) || '-'}</td>
        <td class="px-4 py-3 text-slate-600">${escapeHtml(b.kategori) || '-'}</td>
        <td class="px-4 py-3 text-center">${stokBadge}</td>
        <td class="px-4 py-3">
          <div class="flex gap-1 justify-center">
            <button data-action="editBuku" data-id="${b.id}" title="Edit"
              class="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200">✏️</button>
            <button data-action="konfirmasiHapus" data-id="${b.id}" data-str="${escapeHtml(b.judul)}" title="Hapus"
              class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ================================================================
// RENDER PAGINATION
// ================================================================
function renderPagination(p) {
  state.total_page = p.total_page;

  const start = (p.page - 1) * p.limit + 1;
  const end = Math.min(p.page * p.limit, p.total);

  document.getElementById('info-page').textContent =
    p.total === 0 ? 'Tidak ada data' :
    `Menampilkan ${start}–${end} dari ${p.total} buku`;

  const el = document.getElementById('pagination');
  const btn = (label, targetPage, disabled = false, active = false) => `
    <button ${disabled ? 'disabled' : ''} data-action="gotoPage" data-id="${targetPage}"
      class="px-3 py-1.5 rounded text-sm border ${
        active ? 'bg-blue-600 text-white border-blue-600'
        : disabled ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
      }">${label}</button>
  `;

  let html = '';
  html += btn('«', p.page - 1, p.page <= 1);
  html += btn(String(p.page), p.page, false, true);
  html += btn('»', p.page + 1, p.page >= p.total_page);
  el.innerHTML = html;
}

function gotoPage(p) {
  if (p < 1 || p > state.total_page) return;
  state.page = p;
  loadBuku();
}

// ================================================================
// KATEGORI DROPDOWN + DATALIST
// ================================================================
function renderKategoriDropdown(list) {
  if (JSON.stringify(list) === JSON.stringify(state.kategoriList)) return;
  state.kategoriList = list;

  const sel = document.getElementById('filter-kategori');
  sel.innerHTML = '<option value="">Semua Kategori</option>' +
    list.map(k => `<option value="${escapeHtml(k)}" ${k === state.kategori ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('');

  const dl = document.getElementById('kategori-datalist');
  dl.innerHTML = list.map(k => `<option value="${escapeHtml(k)}">`).join('');
}

// ================================================================
// MODAL FORM — TAMBAH / EDIT
// ================================================================
function openModal(mode = 'tambah', data = null) {
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('form-buku').reset();
  document.getElementById('f-id').value = '';

  if (mode === 'edit' && data) {
    document.getElementById('modal-title').textContent = 'Edit Buku';
    document.getElementById('f-id').value = data.id;
    document.getElementById('f-kode_buku').value = data.kode_buku || '';
    document.getElementById('f-judul').value = data.judul || '';
    document.getElementById('f-penulis').value = data.penulis || '';
    document.getElementById('f-penerbit').value = data.penerbit || '';
    document.getElementById('f-tahun_terbit').value = data.tahun_terbit || '';
    document.getElementById('f-isbn').value = data.isbn || '';
    document.getElementById('f-kategori').value = data.kategori || '';
    document.getElementById('f-lokasi_rak').value = data.lokasi_rak || '';
    document.getElementById('f-stok_total').value = data.stok_total ?? 1;
  } else {
    document.getElementById('modal-title').textContent = 'Tambah Buku';
    document.getElementById('f-stok_total').value = 1;
  }

  setTimeout(() => document.getElementById('f-judul').focus(), 100);
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// ================================================================
// SUBMIT FORM
// ================================================================
async function submitForm(e) {
  e.preventDefault();

  const id = document.getElementById('f-id').value;
  const payload = {
    kode_buku:    document.getElementById('f-kode_buku').value.trim(),
    judul:        document.getElementById('f-judul').value.trim(),
    penulis:      document.getElementById('f-penulis').value.trim(),
    penerbit:     document.getElementById('f-penerbit').value.trim(),
    tahun_terbit: document.getElementById('f-tahun_terbit').value,
    isbn:         document.getElementById('f-isbn').value.trim(),
    kategori:     document.getElementById('f-kategori').value.trim(),
    lokasi_rak:   document.getElementById('f-lokasi_rak').value.trim(),
    stok_total:   Number(document.getElementById('f-stok_total').value) || 0
  };

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    if (id) {
      await apiPut('/buku/' + id, payload);
      toast('Buku berhasil diupdate', 'success');
    } else {
      await apiPost('/buku', payload);
      toast('Buku berhasil ditambahkan', 'success');
    }
    closeModal();
    loadBuku();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan';
  }
}

// ================================================================
// EDIT
// ================================================================
async function editBuku(id) {
  try {
    const res = await apiGet('/buku/' + id);
    openModal('edit', res.data);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ================================================================
// HAPUS
// ================================================================
function konfirmasiHapus(id, nama) {
  state.deleteId = id;
  state.deleteNama = nama;
  document.getElementById('hapus-nama').textContent = nama;
  document.getElementById('modal-hapus').classList.remove('hidden');
}

async function lakukanHapus() {
  const btn = document.getElementById('btn-konfirmasi-hapus');
  btn.disabled = true;
  btn.textContent = 'Menghapus...';
  try {
    await apiDelete('/buku/' + state.deleteId);
    toast('Buku berhasil dihapus', 'success');
    document.getElementById('modal-hapus').classList.add('hidden');
    // Kalau halaman terakhir jadi kosong, mundur 1 halaman
    if (state.page > 1) {
      const sisa = await apiGet('/buku', { page: state.page, limit: state.limit, search: state.search, kategori: state.kategori });
      if (!sisa.data.length) state.page = Math.max(1, state.page - 1);
    }
    loadBuku();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Hapus';
  }
}

// ================================================================
// INIT — Pasang event listener
// ================================================================
document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('btn-tambah').addEventListener('click', () => openModal('tambah'));
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('form-buku').addEventListener('submit', submitForm);

  document.getElementById('btn-cancel-hapus').addEventListener('click', () => {
    document.getElementById('modal-hapus').classList.add('hidden');
  });
  document.getElementById('btn-konfirmasi-hapus').addEventListener('click', lakukanHapus);

  // Search (debounce 400ms)
  let searchTimer = null;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 1;
      loadBuku();
    }, 400);
  });

  // Filter kategori
  document.getElementById('filter-kategori').addEventListener('change', (e) => {
    state.kategori = e.target.value;
    state.page = 1;
    loadBuku();
  });

  // Limit
  document.getElementById('filter-limit').addEventListener('change', (e) => {
    state.limit = Number(e.target.value);
    state.page = 1;
    loadBuku();
  });

  // Reset
  document.getElementById('btn-reset').addEventListener('click', () => {
    state.page = 1;
    state.search = '';
    state.kategori = '';
    document.getElementById('search').value = '';
    document.getElementById('filter-kategori').value = '';
    loadBuku();
  });

  // Tutup modal kalau klik area gelap
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  document.getElementById('modal-hapus').addEventListener('click', (e) => {
    if (e.target.id === 'modal-hapus') e.currentTarget.classList.add('hidden');
  });

  // Esc untuk tutup modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('modal-hapus').classList.add('hidden');
    }
  });

  // Load data pertama kali
  loadBuku();
});