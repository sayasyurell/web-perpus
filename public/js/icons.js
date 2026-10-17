// ================================================================
// icons.js — Auto-replace emoji + render Lucide (di server & client)
// ================================================================

// Peta emoji → nama ikon Lucide (HARUS SAMA dengan server.js)
const EMOJI_MAP = {
  '🏠': 'layout-dashboard', '📖': 'book-open', '👥': 'users',
  '🔄': 'repeat-2', '📊': 'bar-chart-3', '⚙️': 'settings',
  '📚': 'library', '🔍': 'search', '＋': 'plus',
  '✏️': 'pencil', '🗑️': 'trash-2', '👁️': 'eye',
  '🖨️': 'printer', '💾': 'save', '⬇️': 'download',
  '📥': 'file-down', '📤': 'file-up', '⚠️': 'alert-triangle',
  '✅': 'check-circle-2', '🎫': 'credit-card', '📈': 'trending-up',
  '🏆': 'trophy', '🕐': 'clock', '📦': 'package',
  'ℹ️': 'info', '💰': 'banknote', '🚨': 'alert-octagon',
  '👤': 'user', '📝': 'sticky-note', '📋': 'clipboard-list',
  '📄': 'file-text', '📅': 'calendar', '🥇': 'medal',
  '🥈': 'medal', '🥉': 'medal', '👍': 'thumbs-up'
};

const EMOJI_RE = new RegExp('(' + Object.keys(EMOJI_MAP).join('|') + ')', 'gu');

// Replace emoji → <i data-lucide> di seluruh DOM
function replaceEmojisInDom(root = document.body) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const p = node.parentNode;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') {
        return NodeFilter.FILTER_REJECT;
      }
      if (p.dataset && p.dataset.noIcons === 'true') return NodeFilter.FILTER_REJECT;
      EMOJI_RE.lastIndex = 0;
      return EMOJI_RE.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;

    EMOJI_RE.lastIndex = 0;
    while ((m = EMOJI_RE.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', EMOJI_MAP[m[0]]);
      icon.style.cssText = 'display:inline-block;vertical-align:-0.15em;width:1.1em;height:1.1em;stroke-width:2.2;';
      frag.appendChild(icon);
      last = m.index + m[0].length;
    }

    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    if (frag.childNodes.length) node.parentNode.replaceChild(frag, node);
  }
}

// Render semua <i data-lucide> jadi SVG
function renderLucide() {
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

// Gabungan: replace emoji + render
function refreshIcons() {
  replaceEmojisInDom();
  renderLucide();
}

// ================================================================
// AUTO-RUN
// ================================================================
(function() {
  function init() {
    refreshIcons();

    // Re-run setiap ada perubahan DOM (tabel, modal, toast, dsb)
    const observer = new MutationObserver(() => {
      clearTimeout(window.__iconTimer);
      window.__iconTimer = setTimeout(refreshIcons, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

window.refreshIcons = refreshIcons;