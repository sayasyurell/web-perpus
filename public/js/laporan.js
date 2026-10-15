// ================================================================
// laporan.js — Logika halaman Laporan
// ================================================================

const state = {
  dari: '', sampai: '', status: '',
  activeTab: 'peminjaman',
  bukuData: []
};

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatTanggal(str) {
  if (!str) return '-';
  const [y, m, d] = str.split('-');
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${parseInt(d)} ${bulan[parseInt(m)-1]} ${y}`;
}

function formatRupiah(n) {
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
}

// ================================================================
// LOAD PEMINJAMAN
// ================================================================
async function loadPeminjaman() {
  const tbody = document.getElementById('tabel-laporan');
  tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">⏳ Memuat data...</td></tr>`;

  try {
    const res = await apiGet('/laporan/peminjaman', {
      dari: state.dari, sampai: state.sampai, status: state.status
    });

    renderTabel(res.data);
    renderRekap(res.rekap);
    document.getElementById('periode-label').textContent =
      `📅 Periode: ${formatTanggal(state.dari)} — ${formatTanggal(state.sampai)}`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-red-500">❌ ${err.message}</td></tr>`;
  }
}

function renderTabel(list) {
  const tbody = document.getElementById('tabel-laporan');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">📭 Tidak ada data di periode ini</td></tr>`;
    return;
  }

  const today = todayStr();
  tbody.innerHTML = list.map((p, i) => {
    const statusBadge = {
      'dipinjam':     '<span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Dipinjam</span>',
      'sebagian':     '<span class="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Sebagian</span>',
      'dikembalikan': '<span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Kembali</span>'
    }[p.status] || p.status;

    const telat = (p.status === 'dipinjam' || p.status === 'sebagian') && p.tanggal_jatuh < today;

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-4 py-3 text-slate-500">${i + 1}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-700">${escapeHtml(p.kode_pinjam)}</td>
        <td class="px-4 py-3">
          <div class="font-medium text-slate-800">${escapeHtml(p.anggota_nama)}</div>
          <div class="text-xs text-slate-400">${escapeHtml(p.anggota_nis)} ${p.anggota_kelas ? '· ' + escapeHtml(p.anggota_kelas) : ''}</div>
        </td>
        <td class="px-4 py-3 text-slate-600 text-xs">${formatTanggal(p.tanggal_pinjam)}</td>
        <td class="px-4 py-3 text-xs ${telat ? 'text-red-600 font-medium' : 'text-slate-600'}">
          ${formatTanggal(p.tanggal_jatuh)}${telat ? ' ⚠️' : ''}
        </td>
        <td class="px-4 py-3 text-slate-600 text-xs max-w-xs">
          <div class="font-medium">${p.jumlah_buku} buku</div>
          <div class="text-slate-400 truncate" title="${escapeHtml(p.judul_buku || '')}">${escapeHtml(p.judul_buku || '-')}</div>
        </td>
        <td class="px-4 py-3 text-center">${statusBadge}</td>
        <td class="px-4 py-3 text-right font-medium ${p.denda > 0 ? 'text-red-600' : 'text-slate-400'}">
          ${p.denda > 0 ? formatRupiah(p.denda) : '-'}
        </td>
      </tr>
    `;
  }).join('');
}

function renderRekap(r) {
  document.getElementById('rekap-transaksi').textContent = r.total_transaksi || 0;
  document.getElementById('rekap-buku').textContent = r.total_buku || 0;
  document.getElementById('rekap-terlambat').textContent = r.terlambat || 0;
  document.getElementById('rekap-denda').textContent = formatRupiah(r.total_denda || 0);
}

// ================================================================
// LOAD STATISTIK BUKU
// ================================================================
async function loadBukuStats() {
  const tbody = document.getElementById('tabel-buku-laporan');
  tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">⏳ Memuat data...</td></tr>`;

  try {
    const res = await apiGet('/laporan/buku');
    state.bukuData = res.data;

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">📭 Belum ada buku</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map((b, i) => `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-4 py-3 text-slate-500">${i + 1}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-700">${escapeHtml(b.kode_buku)}</td>
        <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(b.judul)}</td>
        <td class="px-4 py-3 text-slate-600 text-xs">${escapeHtml(b.penulis) || '-'}</td>
        <td class="px-4 py-3 text-slate-600 text-xs">${escapeHtml(b.kategori) || '-'}</td>
        <td class="px-4 py-3 text-center text-slate-600">${b.stok_tersedia}/${b.stok_total}</td>
        <td class="px-4 py-3 text-center font-bold text-blue-600">${b.total_dipinjam}×</td>
        <td class="px-4 py-3 text-center font-medium text-amber-600">${b.sedang_dipinjam}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-red-500">❌ ${err.message}</td></tr>`;
  }
}

// ================================================================
// EXPORT CSV — PEMINJAMAN
// ================================================================
function exportPeminjamanCSV() {
  window.location.href = `/api/laporan/export-peminjaman?dari=${state.dari}&sampai=${state.sampai}`;
  toast('Mengunduh CSV...', 'info');
}

// ================================================================
// EXPORT CSV — BUKU
// ================================================================
function exportBukuCSV() {
  if (!state.bukuData.length) return toast('Belum ada data untuk diexport', 'warning');

  const header = 'kode_buku,judul,penulis,kategori,stok_total,stok_tersedia,total_dipinjam,sedang_dipinjam';
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [header];
  state.bukuData.forEach(b => {
    lines.push([b.kode_buku, b.judul, b.penulis, b.kategori, b.stok_total, b.stok_tersedia, b.total_dipinjam, b.sedang_dipinjam]
      .map(esc).join(','));
  });

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `statistik_buku_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV ter-download', 'success');
}

// ================================================================
// PRINT / PDF — PEMINJAMAN
// ================================================================
async function printLaporan() {
  try {
    const res = await apiGet('/laporan/peminjaman', {
      dari: state.dari, sampai: state.sampai, status: state.status
    });
    const r = res.rekap;

    const rows = res.data.map((p, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td class="mono">${escapeHtml(p.kode_pinjam)}</td>
        <td>
          ${escapeHtml(p.anggota_nama)}<br>
          <small style="color:#666;font-size:8pt;">${escapeHtml(p.anggota_nis)}${p.anggota_kelas ? ' · ' + escapeHtml(p.anggota_kelas) : ''}</small>
        </td>
        <td class="text-center">${formatTanggal(p.tanggal_pinjam)}</td>
        <td class="text-center">${formatTanggal(p.tanggal_jatuh)}</td>
        <td class="text-center">${p.jumlah_buku}</td>
        <td class="text-center">${p.status}</td>
        <td class="text-right">${p.denda > 0 ? 'Rp ' + p.denda.toLocaleString('id-ID') : '-'}</td>
      </tr>
    `).join('');

    document.getElementById('print-area').innerHTML = `
      <div class="print-page">
        <div class="print-header">
          <h1>Perpustakaan Sekolah</h1>
          <h2>Laporan Peminjaman Buku</h2>
          <p class="meta">Periode: ${formatTanggal(state.dari)} — ${formatTanggal(state.sampai)}</p>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th style="width:25pt" class="text-center">No</th>
              <th style="width:75pt">Kode</th>
              <th>Anggota</th>
              <th style="width:65pt" class="text-center">Pinjam</th>
              <th style="width:65pt" class="text-center">Jatuh Tempo</th>
              <th style="width:35pt" class="text-center">Buku</th>
              <th style="width:60pt" class="text-center">Status</th>
              <th style="width:65pt" class="text-right">Denda</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8" class="text-center" style="padding:20pt;color:#888;">Tidak ada data</td></tr>'}</tbody>
        </table>

        <div class="print-summary">
          <div class="row"><span>Total Transaksi</span><span><b>${r.total_transaksi}</b></span></div>
          <div class="row"><span>Total Buku Dipinjam</span><span><b>${r.total_buku}</b></span></div>
          <div class="row"><span>Transaksi Terlambat</span><span><b>${r.terlambat}</b></span></div>
          <div class="row total"><span>Total Denda Terkumpul</span><span>Rp ${r.total_denda.toLocaleString('id-ID')}</span></div>
        </div>

        <div class="print-signature right">
          <div class="date">Sidoarjo, ${new Date().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</div>
          <div>Kepala Perpustakaan,</div>
          <div class="line">&nbsp;</div>
        </div>
      </div>
    `;

    window.print();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ================================================================
// TAB SWITCH
// ================================================================
function switchTab(tab) {
  state.activeTab = tab;
  const btnP = document.getElementById('tab-peminjaman');
  const btnB = document.getElementById('tab-buku');
  const viewP = document.getElementById('view-peminjaman');
  const viewB = document.getElementById('view-buku');

  if (tab === 'peminjaman') {
    btnP.className = 'px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600 -mb-px';
    btnB.className = 'px-4 py-2 font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent -mb-px';
    viewP.classList.remove('hidden');
    viewB.classList.add('hidden');
  } else {
    btnB.className = 'px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600 -mb-px';
    btnP.className = 'px-4 py-2 font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent -mb-px';
    viewB.classList.remove('hidden');
    viewP.classList.add('hidden');
    if (!state.bukuData.length) loadBukuStats();
  }
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Default periode: 30 hari terakhir
  const today = todayStr();
  state.dari = addDaysStr(today, -30);
  state.sampai = today;
  document.getElementById('filter-dari').value = state.dari;
  document.getElementById('filter-sampai').value = state.sampai;

  // Tab
  document.getElementById('tab-peminjaman').addEventListener('click', () => switchTab('peminjaman'));
  document.getElementById('tab-buku').addEventListener('click', () => switchTab('buku'));

  // Filter
  document.getElementById('btn-terapkan').addEventListener('click', () => {
    state.dari = document.getElementById('filter-dari').value || todayStr();
    state.sampai = document.getElementById('filter-sampai').value || todayStr();
    state.status = document.getElementById('filter-status').value;
    loadPeminjaman();
  });

  // Preset
  document.getElementById('btn-preset-hari').addEventListener('click', () => {
    state.dari = todayStr(); state.sampai = todayStr();
    document.getElementById('filter-dari').value = state.dari;
    document.getElementById('filter-sampai').value = state.sampai;
    loadPeminjaman();
  });
  document.getElementById('btn-preset-minggu').addEventListener('click', () => {
    state.sampai = todayStr(); state.dari = addDaysStr(state.sampai, -6);
    document.getElementById('filter-dari').value = state.dari;
    document.getElementById('filter-sampai').value = state.sampai;
    loadPeminjaman();
  });
  document.getElementById('btn-preset-bulan').addEventListener('click', () => {
    state.sampai = todayStr(); state.dari = addDaysStr(state.sampai, -29);
    document.getElementById('filter-dari').value = state.dari;
    document.getElementById('filter-sampai').value = state.sampai;
    loadPeminjaman();
  });

  // Export & print
  document.getElementById('btn-export-csv').addEventListener('click', exportPeminjamanCSV);
  document.getElementById('btn-print-laporan').addEventListener('click', printLaporan);
  document.getElementById('btn-export-buku-csv').addEventListener('click', exportBukuCSV);

  // Load awal
  loadPeminjaman();
});