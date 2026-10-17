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
// 1. LOAD PEMINJAMAN
// ================================================================
async function loadPeminjaman() {
  const tbody = document.getElementById('tabel-laporan');
  tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">⏳ Memuat data...</td></tr>`;

  try {
    const res = await apiGet('/laporan/peminjaman', {
      dari: state.dari, sampai: state.sampai, status: state.status
    });

    renderTabelPeminjaman(res.data);
    renderRekapPeminjaman(res.rekap);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-red-500">❌ ${err.message}</td></tr>`;
  }
}

function renderTabelPeminjaman(list) {
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

function renderRekapPeminjaman(r) {
  document.getElementById('rekap-transaksi').textContent = r.total_transaksi || 0;
  document.getElementById('rekap-buku').textContent = r.total_buku || 0;
  document.getElementById('rekap-terlambat').textContent = r.terlambat || 0;
  document.getElementById('rekap-denda').textContent = formatRupiah(r.total_denda || 0);
}

// ================================================================
// 2. LOAD STATISTIK BUKU
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
// 3. LOAD KUNJUNGAN (BUKU TAMU)
// ================================================================
async function loadKunjungan() {
  const tbody = document.getElementById('tabel-kunjungan');
  tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400">⏳ Memuat data...</td></tr>`;

  const tujuan = document.getElementById('filter-tujuan').value;

  try {
    const res = await apiGet('/laporan/kunjungan', {
      dari: state.dari, sampai: state.sampai, tujuan
    });

    document.getElementById('rekap-kunjungan-total').textContent = res.rekap.total;
    document.getElementById('rekap-kunjungan-baca').textContent = res.rekap.totalBaca;
    document.getElementById('rekap-kunjungan-pinjam').textContent = res.rekap.totalPinjam;

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400">📭 Tidak ada pengunjung di periode ini</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map((k, i) => `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-4 py-3 text-slate-500">${i + 1}</td>
        <td class="px-4 py-3 text-slate-600 text-xs">${formatTanggal(k.tanggal)}</td>
        <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(k.nama)}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-600">${escapeHtml(k.nis)}</td>
        <td class="px-4 py-3 text-slate-600">${escapeHtml(k.kelas) || '-'}</td>
        <td class="px-4 py-3 text-center text-slate-600 font-mono text-xs">${k.jam_masuk.split(' ')[1] || k.jam_masuk}</td>
        <td class="px-4 py-3 text-center">
          ${k.tujuan === 'pinjam' 
            ? '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Pinjam Buku</span>' 
            : '<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Baca di Tempat</span>'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-red-500">❌ ${err.message}</td></tr>`;
  }
}

function exportKunjunganCSV() {
  const tujuan = document.getElementById('filter-tujuan').value;
  window.location.href = `/api/laporan/export-kunjungan?dari=${state.dari}&sampai=${state.sampai}&tujuan=${tujuan}`;
  toast('Mengunduh CSV...', 'info');
}

// ================================================================
// 4. EXPORT & PRINT
// ================================================================
function exportPeminjamanCSV() {
  window.location.href = `/api/laporan/export-peminjaman?dari=${state.dari}&sampai=${state.sampai}`;
  toast('Mengunduh CSV...', 'info');
}

function exportBukuCSV() {
  if (!state.bukuData.length) return toast('Belum ada data', 'warning');
  const header = 'kode_buku,judul,penulis,kategori,stok_total,stok_tersedia,total_dipinjam,sedang_dipinjam';
  const esc = (v) => { if(v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const lines = [header];
  state.bukuData.forEach(b => lines.push([b.kode_buku, b.judul, b.penulis, b.kategori, b.stok_total, b.stok_tersedia, b.total_dipinjam, b.sedang_dipinjam].map(esc).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `statistik_buku_${todayStr()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  toast('CSV ter-download', 'success');
}

async function printLaporan() {
  try {
    const res = await apiGet('/laporan/peminjaman', { dari: state.dari, sampai: state.sampai, status: state.status });
    const rowsHTML = res.data.map((p, i) => `
      <tr><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px;">${i + 1}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px;">${escapeHtml(p.kode_pinjam)}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px;">${escapeHtml(p.anggota_nama)}<br><small>${escapeHtml(p.anggota_nis)}</small></td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px;">${formatTanggal(p.tanggal_pinjam)}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px;">${formatTanggal(p.tanggal_jatuh)}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px;text-align:center;">${p.jumlah_buku}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px;text-align:center;">${p.status}</td><td style="padding:4px 6px;border-bottom:1px solid #ddd;font-size:11px;text-align:right;">${p.denda > 0 ? formatRupiah(p.denda) : '-'}</td></tr>
    `).join('');

    document.getElementById('print-area').innerHTML = `
      <div style="font-family:Arial,sans-serif;padding:20px;">
        <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:16px;"><h2 style="margin:0;">📚 PERPUSTAKAAN SEKOLAH</h2><p style="margin:4px 0;font-size:12px;color:#666;">Laporan Peminjaman · ${formatTanggal(state.dari)} — ${formatTanggal(state.sampai)}</p></div>
        <table style="width:100%;font-size:11px;border-collapse:collapse;"><thead><tr style="background:#f0f0f0;"><th style="padding:6px;text-align:left;border-bottom:2px solid #333;">No</th><th style="padding:6px;text-align:left;border-bottom:2px solid #333;">Kode</th><th style="padding:6px;text-align:left;border-bottom:2px solid #333;">Anggota</th><th style="padding:6px;text-align:left;border-bottom:2px solid #333;">Pinjam</th><th style="padding:6px;text-align:left;border-bottom:2px solid #333;">Jatuh Tempo</th><th style="padding:6px;text-align:center;border-bottom:2px solid #333;">Buku</th><th style="padding:6px;text-align:center;border-bottom:2px solid #333;">Status</th><th style="padding:6px;text-align:right;border-bottom:2px solid #333;">Denda</th></tr></thead><tbody>${rowsHTML || '<tr><td colspan="8" style="padding:20px;text-align:center;color:#888;">Tidak ada data</td></tr>'}</tbody></table>
        <div style="margin-top:16px;padding:10px;background:#f9f9f9;border-radius:4px;font-size:12px;"><b>Rekap:</b> Transaksi: ${res.rekap.total_transaksi} · Buku: ${res.rekap.total_buku} · Terlambat: ${res.rekap.terlambat} · Denda: ${formatRupiah(res.rekap.total_denda)}</div>
      </div>`;
    window.print();
  } catch (err) { toast(err.message, 'error'); }
}

async function printKunjungan() {
  try {
    const tujuan = document.getElementById('filter-tujuan').value;
    const res = await apiGet('/laporan/kunjungan', { dari: state.dari, sampai: state.sampai, tujuan });
    const rowsHTML = res.data.map((k, i) => `
      <tr><td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:11px;text-align:center;">${i + 1}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:11px;">${formatTanggal(k.tanggal)}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:11px;">${escapeHtml(k.nama)}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:11px;">${escapeHtml(k.nis)}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:11px;text-align:center;">${k.jam_masuk.split(' ')[1] || k.jam_masuk}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;font-size:11px;text-align:center;">${k.tujuan === 'pinjam' ? 'Pinjam' : 'Baca'}</td></tr>
    `).join('');

    document.getElementById('print-area').innerHTML = `
      <div style="font-family:Arial,sans-serif;padding:20px;">
        <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:16px;"><h2 style="margin:0;">BUKU TAMU PERPUSTAKAAN</h2><p style="margin:4px 0;font-size:12px;color:#666;">Periode: ${formatTanggal(state.dari)} — ${formatTanggal(state.sampai)}</p></div>
        <table style="width:100%;font-size:11px;border-collapse:collapse;"><thead><tr style="background:#f0f0f0;"><th style="padding:6px;text-align:center;border-bottom:2px solid #333;width:30px;">No</th><th style="padding:6px;text-align:left;border-bottom:2px solid #333;">Tanggal</th><th style="padding:6px;text-align:left;border-bottom:2px solid #333;">Nama</th><th style="padding:6px;text-align:left;border-bottom:2px solid #333;">NIS</th><th style="padding:6px;text-align:center;border-bottom:2px solid #333;">Jam</th><th style="padding:6px;text-align:center;border-bottom:2px solid #333;">Tujuan</th></tr></thead><tbody>${rowsHTML || '<tr><td colspan="6" style="padding:20px;text-align:center;color:#888;">Tidak ada data</td></tr>'}</tbody></table>
        <div style="margin-top:16px;padding:10px;background:#f9f9f9;border-radius:4px;font-size:12px;"><b>Rekap:</b> Total Pengunjung: ${res.rekap.total} · Baca: ${res.rekap.totalBaca} · Pinjam: ${res.rekap.totalPinjam}</div>
      </div>`;
    window.print();
  } catch (err) { toast(err.message, 'error'); }
}

// ================================================================
// 5. TAB SWITCH & INIT
// ================================================================
function switchTab(tab) {
  state.activeTab = tab;
  const btnP = document.getElementById('tab-peminjaman');
  const btnB = document.getElementById('tab-buku');
  const btnK = document.getElementById('tab-kunjungan');
  const viewP = document.getElementById('view-peminjaman');
  const viewB = document.getElementById('view-buku');
  const viewK = document.getElementById('view-kunjungan');

  // Class dasar (Kunci: flex items-center gap-2 rounded-none)
  const baseClass = 'flex items-center gap-2 px-4 py-2 font-medium border-b-2 -mb-px rounded-none transition-colors';
  
  // Reset semua ke tidak aktif
  btnP.className = `${baseClass} text-slate-500 hover:text-slate-800 border-transparent`;
  btnB.className = `${baseClass} text-slate-500 hover:text-slate-800 border-transparent`;
  btnK.className = `${baseClass} text-slate-500 hover:text-slate-800 border-transparent`;
  
  // Sembunyikan semua view
  viewP.classList.add('hidden');
  viewB.classList.add('hidden');
  viewK.classList.add('hidden');

  // Aktifkan yang dipilih
  if (tab === 'peminjaman') {
    btnP.className = `${baseClass} text-blue-600 border-blue-600`;
    viewP.classList.remove('hidden');
    document.getElementById('wrap-filter-status').style.display = 'block';
  } else if (tab === 'buku') {
    btnB.className = `${baseClass} text-blue-600 border-blue-600`;
    viewB.classList.remove('hidden');
    document.getElementById('wrap-filter-status').style.display = 'none';
    if (!state.bukuData.length) loadBukuStats();
  } else if (tab === 'kunjungan') {
    btnK.className = `${baseClass} text-blue-600 border-blue-600`;
    viewK.classList.remove('hidden');
    document.getElementById('wrap-filter-status').style.display = 'none';
    loadKunjungan();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const today = todayStr();
  state.dari = addDaysStr(today, -30);
  state.sampai = today;
  document.getElementById('filter-dari').value = state.dari;
  document.getElementById('filter-sampai').value = state.sampai;

  // Tabs
  document.getElementById('tab-peminjaman').addEventListener('click', () => switchTab('peminjaman'));
  document.getElementById('tab-buku').addEventListener('click', () => switchTab('buku'));
  document.getElementById('tab-kunjungan').addEventListener('click', () => switchTab('kunjungan'));

  // Filter Actions
  document.getElementById('btn-terapkan').addEventListener('click', () => {
    state.dari = document.getElementById('filter-dari').value || todayStr();
    state.sampai = document.getElementById('filter-sampai').value || todayStr();
    state.status = document.getElementById('filter-status').value;
    
    if (state.activeTab === 'peminjaman') loadPeminjaman();
    else if (state.activeTab === 'kunjungan') loadKunjungan();
  });

  // Presets
  document.getElementById('btn-preset-hari').addEventListener('click', () => {
    state.dari = todayStr(); state.sampai = todayStr();
    document.getElementById('filter-dari').value = state.dari;
    document.getElementById('filter-sampai').value = state.sampai;
    if (state.activeTab === 'peminjaman') loadPeminjaman(); else loadKunjungan();
  });
  document.getElementById('btn-preset-minggu').addEventListener('click', () => {
    state.sampai = todayStr(); state.dari = addDaysStr(state.sampai, -6);
    document.getElementById('filter-dari').value = state.dari;
    document.getElementById('filter-sampai').value = state.sampai;
    if (state.activeTab === 'peminjaman') loadPeminjaman(); else loadKunjungan();
  });
  document.getElementById('btn-preset-bulan').addEventListener('click', () => {
    state.sampai = todayStr(); state.dari = addDaysStr(state.sampai, -29);
    document.getElementById('filter-dari').value = state.dari;
    document.getElementById('filter-sampai').value = state.sampai;
    if (state.activeTab === 'peminjaman') loadPeminjaman(); else loadKunjungan();
  });

  // Filter Tujuan (Khusus Buku Tamu)
  document.getElementById('filter-tujuan').addEventListener('change', loadKunjungan);

  // Export & Print
  document.getElementById('btn-export-csv').addEventListener('click', exportPeminjamanCSV);
  document.getElementById('btn-print-laporan').addEventListener('click', printLaporan);
  document.getElementById('btn-export-buku-csv').addEventListener('click', exportBukuCSV);
  document.getElementById('btn-export-kunjungan').addEventListener('click', exportKunjunganCSV);
  document.getElementById('btn-print-kunjungan').addEventListener('click', printKunjungan);

  // Load awal
  loadPeminjaman();
});