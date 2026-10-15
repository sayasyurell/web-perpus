// ================================================================
// icons.js — Auto-replace emoji → Lucide SVG
// Cukup include 1 kali di setiap HTML, semua emoji otomatis diganti.
// ================================================================

// Peta emoji → nama ikon Lucide
const EMOJI_MAP = {
  '🏠': 'layout-dashboard',
  '📖': 'book-open',
  '👥': 'users',
  '🔄': 'repeat-2',
  '📊': 'bar-chart-3',
  '⚙️': 'settings',
  '📚': 'library',
  '🔍': 'search',
  '＋': 'plus',
  '✏️': 'pencil',
  '🗑️': 'trash-2',
  '👁️': 'eye',
  '🖨️': 'printer',
  '💾': 'save',
  '⬇️': 'download',
  '📥': 'file-down',
  '📤': 'file-up',
  '⚠️': 'alert-triangle',
  '✅': 'check-circle-2',
  '🎫': 'credit-card',
  '📈': 'trending-up',
  '🏆': 'trophy',
  '🕐': 'clock',
  '📦': 'package',
  'ℹ️': 'info',
  '💰': 'banknote',
  '🚨': 'alert-octagon',
  '👤': 'user',
  '📝': 'sticky-note',
  '📋': 'clipboard-list',
  '📄': 'file-text',
  '📅': 'calendar',
  '🥇': 'medal',
  '🥈': 'medal',
  '🥉': 'medal',
  '👍': 'thumbs-up'
};

// Ukuran ikon default — bisa di-override via CSS class .icon-lg, .icon-sm
const SIZE_MAP = { sm: 14, md: 16, lg: 20, xl: 40 };

// Cari & ganti emoji di semua text node
function replaceEmojis(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip node di dalam <script>, <style>, atau sudah pernah diproses
      const p = node.parentNode;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
      if (p.dataset && p.dataset.noIcons === 'true') return NodeFilter.FILTER_REJECT;
      return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(node.nodeValue)
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const text = node.nodeValue;
    // Cek apakah ada emoji yang terdaftar
    let hasMatch = false;
    for (const emoji of Object.keys(EMOJI_MAP)) {
      if (text.includes(emoji)) { hasMatch = true; break; }
    }
    if (!hasMatch) continue;

    // Bangun fragmen HTML
    const frag = document.createDocumentFragment();
    let remaining = text;

    // Loop: cari emoji satu per satu dari kiri
    while (remaining.length) {
      let found = null, pos = -1;
      for (const emoji of Object.keys(EMOJI_MAP)) {
        const idx = remaining.indexOf(emoji);
        if (idx !== -1 && (pos === -1 || idx < pos)) {
          pos = idx; found = emoji;
        }
      }

      if (found === null) {
        // Tidak ada emoji lagi → sisanya text biasa
        if (remaining) frag.appendChild(document.createTextNode(remaining));
        break;
      }

      // Text sebelum emoji
      if (pos > 0) frag.appendChild(document.createTextNode(remaining.slice(0, pos)));

      // Buat elemen ikon
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', EMOJI_MAP[found]);
      icon.className = 'lucide-inline';
      icon.style.cssText = 'display:inline-block;vertical-align:-0.125em;width:1em;height:1em;stroke-width:2.5;';
      frag.appendChild(icon);

      remaining = remaining.slice(pos + found.length);
    }

    node.parentNode.replaceChild(frag, node);
  }

  // Render semua <i data-lucide> via Lucide
  if (window.lucide) window.lucide.createIcons();
}

// ================================================================
// AUTO-RUN
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Delay sedikit biar konten dinamis (dari JS) sudah selesai render dulu
  setTimeout(() => replaceEmojis(), 100);
  setTimeout(() => replaceEmojis(), 500); // 2nd pass untuk data async

  // MutationObserver — panggil ulang kalau ada elemen baru (dari render tabel, modal, dsb)
  const observer = new MutationObserver(() => {
    // Debounce biar tidak spam
    clearTimeout(window._iconTimer);
    window._iconTimer = setTimeout(() => replaceEmojis(), 80);
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

// Export untuk dipanggil manual
window.refreshIcons = replaceEmojis;