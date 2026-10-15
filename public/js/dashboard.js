// ================================================================
// dashboard.js — Logika Dashboard
// ================================================================

function formatTanggalSingkat(str) {
  if (!str) return '-';
  const [y, m, d] = str.split('-');
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${parseInt(d)} ${bulan[parseInt(m)-1]} ${y.slice(2)}`;
}

function formatRupiah(n) {
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
}

// ================================================================
// INIT — Pasang tanggal & load
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Waktu sekarang
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const now = new Date();
  document.getElementById('waktu-sekarang').textContent =
    `${hari[now.getDay()]}, ${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}`;

  await loadDashboard();
});

// ================================================================
// LOAD
// ================================================================
async function loadDashboard() {
  try {
    const res = await apiGet('/laporan/dashboard');
    const d = res.data;

    // Kartu statistik
    document.getElementById('stat-buku').textContent = (d.buku.total_stok || 0).toLocaleString('id-ID');
    document.getElementById('stat-buku-sub').textContent =
      `${d.buku.judul} judul · ${d.buku.stok_tersedia} tersedia`;

    document.getElementById('stat-anggota').textContent = (d.anggota.total || 0).toLocaleString('id-ID');
    document.getElementById('stat-anggota-sub').textContent =
      `${d.anggota.siswa || 0} siswa · ${d.anggota.guru || 0} guru`;

    document.getElementById('stat-pinjam').textContent = (d.pinjam.aktif || 0).toLocaleString('id-ID');
    document.getElementById('stat-pinjam-sub').textContent =
      `${d.pinjam.total || 0} total transaksi`;

    document.getElementById('stat-terlambat').textContent = (d.terlambat || 0).toLocaleString('id-ID');

    renderChart7Hari(d.chart_7hari);
    renderPopuler(d.populer);
    renderTerbaru(d.terbaru);
    renderStokMenipis(d.stok_menipis);

  } catch (err) {
    console.error('Dashboard error:', err);
    toast('Gagal memuat dashboard: ' + err.message, 'error');
  }
}

// ================================================================
// CHART 7 HARI (bar chart sederhana pakai div)
// ================================================================
function renderChart7Hari(data) {
  const maxVal = Math.max(...data.map(d => d.jumlah), 1);
  const hari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  document.getElementById('chart-7hari').innerHTML = data.map(d => {
    const pct = (d.jumlah / maxVal) * 100;
    const tinggiMin = 8; // minimal 8% biar keliatan
    const tinggi = Math.max(pct, d.jumlah > 0 ? tinggiMin : 2);
    const warna = d.jumlah === 0 ? 'bg-slate-200' : 'bg-blue-500 hover:bg-blue-600';

    return `
      <div class="flex-1 flex flex-col items-center justify-end h-full">
        <div class="text-xs font-semibold text-slate-600 mb-1">${d.jumlah}</div>
        <div class="chart-bar w-full max-w-[40px] rounded-t ${warna} transition-all" style="height: ${tinggi}%"></div>
      </div>
    `;
  }).join('');

  document.getElementById('chart-labels').innerHTML = data.map(d => {
    const dt = new Date(d.tanggal + 'T00:00:00');
    return `<div class="flex-1 text-center">
      <div class="font-medium text-slate-600">${hari[dt.getDay()]}</div>
      <div class="text-slate-400">${dt.getDate()}/${dt.getMonth()+1}</div>
    </div>`;
  }).join('');
}

// ================================================================
// BUKU POPULER
// ================================================================
function renderPopuler(list) {
  const el = document.getElementById('populer-list');
  if (!list || !list.length) {
    el.innerHTML = '<div class="text-slate-400 text-sm">Belum ada data peminjaman</div>';
    return;
  }

  const medals = ['🥇','🥈','🥉'];
  el.innerHTML = list.map((b, i) => `
    <div class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
      <div class="text-xl w-6 text-center">${medals[i] || (i + 1)}</div>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-slate-800 text-sm truncate">${escapeHtml(b.judul)}</div>
        <div class="text-xs text-slate-400 truncate">${escapeHtml(b.penulis) || 'Tanpa penulis'}</div>
      </div>
      <div class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">
        ${b.total_dipinjam}×
      </div>
    </div>
  `).join('');
}

// ================================================================
// PEMINJAMAN TERBARU
// ================================================================
function renderTerbaru(list) {
  const el = document.getElementById('terbaru-list');
  if (!list || !list.length) {
    el.innerHTML = '<div class="text-slate-400 text-sm py-4 text-center">Belum ada peminjaman</div>';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  el.innerHTML = list.map(p => {
    const badge = {
      'dipinjam':     '<span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Dipinjam</span>',
      'sebagian':     '<span class="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Sebagian</span>',
      'dikembalikan': '<span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Kembali</span>'
    }[p.status] || p.status;

    const telat = (p.status === 'dipinjam' || p.status === 'sebagian') && p.tanggal_jatuh < today;

    return `
      <a href="/peminjaman.html" class="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg border border-slate-100">
        <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
          ${escapeHtml(p.anggota_nama || '?').charAt(0).toUpperCase()}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-slate-800 text-sm truncate">${escapeHtml(p.anggota_nama)}</div>
          <div class="text-xs text-slate-400">
            <span class="font-mono">${escapeHtml(p.kode_pinjam)}</span> ·
            ${p.jumlah_buku} buku ·
            ${formatTanggalSingkat(p.tanggal_pinjam)}
          </div>
        </div>
        <div>${badge}${telat ? ' <span class="text-xs text-red-600">⚠️</span>' : ''}</div>
      </a>
    `;
  }).join('');
}

// ================================================================
// STOK MENIPIS
// ================================================================
function renderStokMenipis(list) {
  const el = document.getElementById('stok-menipis-list');
  if (!list || !list.length) {
    el.innerHTML = '<div class="text-slate-400 text-sm">Semua stok aman 👍</div>';
    return;
  }

  el.innerHTML = list.map(b => {
    const habis = b.stok_tersedia === 0;
    const warna = habis ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
    return `
      <div class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-slate-800 text-sm truncate">${escapeHtml(b.judul)}</div>
          <div class="text-xs text-slate-400 font-mono">${escapeHtml(b.kode_buku)}</div>
        </div>
        <div class="px-2 py-1 rounded text-xs font-bold ${warna}">
          ${b.stok_tersedia}/${b.stok_total}
        </div>
      </div>
    `;
  }).join('');
}