// ================================================================
// scan.js — Final (match dengan scan.html wrapper)
// ================================================================

const state = {
  bukuList: [],
  processing: false
};

// ================================================================
// FULLSCREEN + EXIT
// ================================================================
async function masukFullscreen() {
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch(e){}
}
function keluar() {
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  window.location.href = '/';
}
document.addEventListener('click', masukFullscreen, { once: true });
document.addEventListener('keydown', masukFullscreen, { once: true });

// ================================================================
// UTILITY
// ================================================================
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

let audioCtx = null;
function beep(freq = 900, dur = 0.1) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch(e){}
}
const beepOk   = () => beep(1000, 0.12);
const beepErr  = () => { beep(300, 0.25); setTimeout(() => beep(250, 0.25), 150); };
const beepWarn = () => beep(600, 0.15);
const beepBig  = () => { beepOk(); setTimeout(beepOk, 100); setTimeout(beepOk, 200); };

// ================================================================
// UI — semua pakai inline style (match dengan scan.html)
// ================================================================
function showStatus(text, sub, type = 'info', icon = '📚') {
  const box = document.getElementById('status-box');
  const colors = {
    info:    { bg: '#fff',     border: '#e2e8f0', text: '#334155' },
    success: { bg: '#f0fdf4',  border: '#86efac', text: '#15803d' },
    error:   { bg: '#fef2f2',  border: '#fca5a5', text: '#b91c1c' },
    warn:    { bg: '#fffbeb',  border: '#fcd34d', text: '#b45309' }
  };
  const c = colors[type] || colors.info;
  box.style.background = c.bg;
  box.style.borderColor = c.border;
  document.getElementById('status-icon').textContent = icon;
  const textEl = document.getElementById('status-text');
  textEl.textContent = text;
  textEl.style.color = c.text;
  document.getElementById('status-sub').textContent = sub || '';
}

function addLog(msg, type = 'info') {
  const colors = { info: '#475569', success: '#16a34a', error: '#dc2626', warn: '#d97706' };
  const t = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.createElement('div');
  el.style.cssText = `color: ${colors[type]}; padding: 6px 0; border-bottom: 1px solid #f1f5f9;`;
  el.innerHTML = `<span style="color: #94a3b8;">[${t}]</span> ${msg}`;
  const log = document.getElementById('log');
  log.insertBefore(el, log.firstChild);
}

function renderList() {
  const box = document.getElementById('list-box');
  const content = document.getElementById('list-content');

  if (state.bukuList.length === 0) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  document.getElementById('list-count').textContent = state.bukuList.length + ' buku';

  content.innerHTML = state.bukuList.map((b, i) => `
    <div style="display: flex; align-items: center; gap: 12px; padding: 12px;
                background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px;">
      <div style="width: 32px; height: 32px; border-radius: 50%; background: #059669;
                  color: #fff; display: flex; align-items: center; justify-content: center;
                  font-weight: 700; font-size: 0.875rem; flex-shrink: 0;">${i + 1}</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 500; color: #1e293b; white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis;">${escapeHtml(b.judul)}</div>
        <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">${escapeHtml(b.kode_buku)}</div>
      </div>
      <button data-action="hapusBuku" data-id="${b.id}"
        style="color: #ef4444; background: none; border: none; cursor: pointer;
               padding: 8px; border-radius: 8px;">
        <i data-lucide="x" style="width:16px;height:16px;"></i>
      </button>
    </div>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function hapusBuku(id) {
  state.bukuList = state.bukuList.filter(b => b.id !== id);
  renderList();
  addLog('🗑️ Hapus 1 buku dari list', 'warn');
  document.getElementById('scan-input').focus();
}

// ================================================================
// PROCESS SCAN
// ================================================================
async function processScan(kode) {
  try {
    const res = await apiGet('/scan/lookup/' + encodeURIComponent(kode));

    if (res.tipe === 'buku') {
      const existing = state.bukuList.find(b => b.id === res.data.id);
      if (existing) {
        beepWarn(); showStatus('Sudah Discan', res.data.judul, 'warn'); return;
      }
      state.bukuList.push({ id: res.data.id, kode_buku: res.data.kode_buku, judul: res.data.judul });
      beepOk();
      showStatus('Buku Ditambah', res.data.judul, 'success');
      addLog('📖 + ' + escapeHtml(res.data.judul), 'success');
      renderList();
      
    } else if (res.tipe === 'anggota') {
      // DETEKSI NIAT: Jika ada buku di keranjang = Pinjam. Jika kosong = Baca.
      if (state.bukuList.length > 0) {
        await prosesSemua(res.data, 'pinjam'); 
      } else {
        await prosesTamu(res.data, 'baca');    
      }
    }
  } catch (err) {
    beepErr();
    showStatus('Tidak Dikenali', err.message, 'error');
  }
}

// ================================================================
// PROSES SEMUA (kembali + pinjam)
// ================================================================
async function prosesSemua(anggota, tujuan = 'pinjam') {
  try {
    showStatus('Memproses...', anggota.nama, 'info', '⏳');
    addLog('👤 ' + escapeHtml(anggota.nama) + ' (' + anggota.nis + ') — proses ' + state.bukuList.length + ' buku', 'info');

    const payload = {
      anggota_id: anggota.id,
      buku_list: state.bukuList.map(b => ({ buku_id: b.id, jumlah: 1 }))
    };

    const res = await apiPost('/scan/proses', payload);

    beepBig();
    const totalKembali = res.pengembalian ? res.pengembalian.length : 0;
    const totalPinjam  = res.peminjaman ? res.peminjaman.buku.length : 0;

    showStatus('SELESAI', `${totalKembali} kembali · ${totalPinjam} pinjam`, 'success', '✅');
    addLog(`✅ Selesai — ${totalKembali} kembali, ${totalPinjam} pinjam`, 'success');

    tampilkanSukses(anggota, res);

    // Catat ke Buku Tamu sebagai 'pinjam'
    await apiPost('/scan/tamu', { anggota_id: anggota.id, tujuan: 'pinjam' });

    state.bukuList = [];
    renderList();

    setTimeout(() => {
      document.getElementById('modal-sukses').style.display = 'none';
      showStatus('Siap Scan Buku', 'Scan buku untuk peminjaman/pengembalian berikutnya', 'info', '📚');
    }, 3000);

  } catch (err) {
    beepErr();
    showStatus('Gagal', err.message, 'error', '❌');
    addLog('❌ ' + err.message, 'error');
  }
}

// ================================================================
// MODAL SUKSES
// ================================================================
function tampilkanSukses(anggota, res) {
  document.getElementById('sukses-sub').textContent =
    `${anggota.nama} · ${anggota.nis}${anggota.kelas ? ' · ' + anggota.kelas : ''}`;

  let html = '';

  if (res.pengembalian && res.pengembalian.length) {
    html += `
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 12px;">
        <div style="font-weight: 700; color: #15803d; font-size: 0.875rem; margin-bottom: 8px;">
          📥 Dikembalikan (${res.pengembalian.length})
        </div>
        <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem;">
          ${res.pengembalian.map(b => `
            <li style="display: flex; justify-content: space-between;">
              <span>📗 ${escapeHtml(b.judul)}</span>
              ${b.denda > 0
                ? `<span style="color: #dc2626; font-size: 0.75rem;">Denda Rp ${b.denda.toLocaleString('id-ID')}</span>`
                : '<span style="color: #16a34a; font-size: 0.75rem;">✓</span>'}
            </li>
          `).join('')}
        </ul>
      </div>`;
  }

  if (res.peminjaman && res.peminjaman.buku.length) {
    html += `
      <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 10px; padding: 12px;">
        <div style="font-weight: 700; color: #1e40af; font-size: 0.875rem; margin-bottom: 8px;">
          📤 Dipinjam (${res.peminjaman.buku.length})
        </div>
        <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem;">
          ${res.peminjaman.buku.map(b => `<li>📘 ${escapeHtml(b.judul)}</li>`).join('')}
        </ul>
        <div style="font-size: 0.75rem; color: #2563eb; margin-top: 8px; padding-top: 8px; border-top: 1px solid #93c5fd;">
          Kode: <b>${escapeHtml(res.peminjaman.kode_pinjam)}</b> ·
          Jatuh tempo: <b>${res.peminjaman.tanggal_jatuh}</b>
        </div>
      </div>`;
  }

  document.getElementById('sukses-detail').innerHTML = html;
  document.getElementById('modal-sukses').style.display = 'flex';
  if (window.lucide) lucide.createIcons();
}

// ================================================================
// FUNGSI BARU: PROSES BUKU TAMU (OTOMATIS)
// ================================================================
async function prosesTamu(anggota, tujuan = 'baca') {
  try {
    const res = await apiPost('/scan/tamu', { anggota_id: anggota.id, tujuan });
    const teksTujuan = tujuan === 'pinjam' ? 'MEMINJAM BUKU' : 'BACA DI TEMPAT';
    
    if (res.tipe === 'masuk') {
      beepOk(); beepOk();
      document.getElementById('status-box').className = `card p-8 text-center shadow-lg border-2 transition-all bg-green-50 border-green-300`;
      // PERHATIKAN: ID di bawah ini menggunakan status-icon-wrap
      document.getElementById('status-icon-wrap').innerHTML = `<svg class="w-16 h-16 mx-auto text-green-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
      document.getElementById('status-text').className = `text-3xl font-bold mt-4 text-green-700`;
      document.getElementById('status-text').textContent = res.anggota.nama.toUpperCase();
      
      document.getElementById('status-sub').innerHTML = `
        <div class="text-lg mt-2 font-medium">Selamat Datang!</div>
        <div class="text-sm mt-2 text-slate-500 font-semibold uppercase">${teksTujuan}</div>
        <div class="text-sm mt-1 text-slate-500">Jam ${res.waktu}</div>
      `;
      addLog(`📥 Masuk: ${res.anggota.nama} (${teksTujuan})`, 'success');

    } else if (res.tipe === 'sudah') {
      beepWarn(); 
      document.getElementById('status-box').className = `card p-8 text-center shadow-lg border-2 transition-all bg-blue-50 border-blue-300`;
      document.getElementById('status-icon-wrap').innerHTML = `<svg class="w-16 h-16 mx-auto text-blue-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
      document.getElementById('status-text').className = `text-3xl font-bold mt-4 text-blue-700`;
      document.getElementById('status-text').textContent = res.anggota.nama.toUpperCase();
      
      document.getElementById('status-sub').innerHTML = `
        <div class="text-lg mt-2 font-medium">Anda sudah tercatat hari ini.</div>
        <div class="text-sm mt-1 text-slate-500">Silakan nikmati fasilitas perpustakaan.</div>
      `;
      addLog(`ℹ️ ${res.anggota.nama} sudah discan hari ini`, 'info');
    }

    setTimeout(() => { 
      showStatus('Siap Scan', 'Scan Buku untuk Pinjam, atau Kartu untuk Baca', 'info', 'book-open'); 
    }, 3000);

  } catch (err) {
    beepErr(); showStatus('Gagal', err.message, 'error');
  }
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('scan-input');

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const kode = input.value.trim();
      input.value = '';
      if (!kode || state.processing) return;
      state.processing = true;
      try { await processScan(kode); }
      finally { state.processing = false; input.focus(); }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('button, select, a, input')) input.focus();
  });
  setInterval(() => { if (document.activeElement.tagName === 'BODY') input.focus(); }, 1000);

  document.getElementById('btn-exit').addEventListener('click', keluar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.fullscreenElement) keluar(); });

  document.getElementById('btn-clear-log').addEventListener('click', () => {
    document.getElementById('log').innerHTML = '';
    input.focus();
  });

  setTimeout(() => input.focus(), 200);
  addLog('🚀 Mode Scan siap — scan buku dulu, lalu kartu', 'success');
});

window.hapusBuku = hapusBuku;