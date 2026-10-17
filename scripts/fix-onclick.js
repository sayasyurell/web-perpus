// ================================================================
// scripts/fix-onclick.js
// Ubah semua onclick inline jadi data-action + data-id + data-str
// Pakai: node scripts/fix-onclick.js            (dry-run)
//        node scripts/fix-onclick.js --apply    (tulis)
// ================================================================
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DIR = path.join(__dirname, '..', 'public', 'js');

// Pisahkan argumen fungsi dengan aman (handle tanda kutip)
function splitArgs(str) {
  const args = [];
  let cur = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (quote) {
      cur += c;
      if (c === quote && str[i-1] !== '\\') quote = null;
    } else if (c === "'" || c === '"' || c === '`') {
      quote = c; cur += c;
    } else if (c === '(' || c === '{' || c === '[') {
      depth++; cur += c;
    } else if (c === ')' || c === '}' || c === ']') {
      depth--; cur += c;
    } else if (c === ',' && depth === 0) {
      args.push(cur.trim()); cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

// Transform satu string onclick
function transform(code) {
  code = code.trim();

  // Skip yang pakai event/this (aman, tidak ada user data)
  if (code.includes('event.') || code.includes('this.')) {
    return { skip: true, reason: 'pakai event/this — aman' };
  }

  const m = code.match(/^(\w+)\((.*)\)$/s);
  if (!m) return { skip: true, reason: 'tidak bisa parse' };

  const [, fn, argsStr] = m;
  const args = splitArgs(argsStr);
  if (args.length > 2) return { skip: true, reason: 'argumen > 2' };

  const attrs = [`data-action="${fn}"`];

  if (args.length >= 1) {
    const a = args[0];
    // Terima ${...} atau angka literal
    if (/^\$\{.+\}$/.test(a)) attrs.push(`data-id="${a}"`);
    else if (/^\d+$/.test(a)) attrs.push(`data-id="${a}"`);
    else return { skip: true, reason: 'arg 1 bukan ID' };
  }

  if (args.length >= 2) {
    const a = args[1];
    // Terima '${...}' atau "${...}" atau 'literal'
    const q = a.match(/^['"](.+)['"]$/s);
    if (!q) return { skip: true, reason: 'arg 2 bukan string' };
    // Buang .replace(/'/g, "\\'") jika ada
    let inner = q[1].replace(/\.replace\(\/'\/g,\s*["']\\\\'["']\)\s*$/,'');
    attrs.push(`data-str="${inner}"`);
  }

  return { result: attrs.join(' ') };
}

// Proses file
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js'));
let totalChanged = 0, totalSkip = 0;
const report = [];

for (const file of files) {
  const p = path.join(DIR, file);
  const src = fs.readFileSync(p, 'utf8');
  let changes = 0;

  const out = src.replace(/onclick="([^"]+)"/g, (full, code) => {
    const r = transform(code);
    if (r.skip) {
      totalSkip++;
      report.push(`  ⚠️  ${file}: SKIP (${r.reason}) → ${code.substring(0, 60)}`);
      return full;
    }
    changes++;
    report.push(`  ✅ ${file}: ${code.substring(0, 50)} → ${r.result.substring(0, 60)}`);
    return r.result;
  });

  if (changes > 0) {
    totalChanged += changes;
    if (APPLY) fs.writeFileSync(p, out, 'utf8');
  }
}

// Laporan
console.log('\n=== Laporan Fix Onclick ===\n');
console.log(report.join('\n'));
console.log('\n─────────────────────────────');
console.log(`Total diubah : ${totalChanged}`);
console.log(`Total di-skip: ${totalSkip}`);
console.log(`Mode         : ${APPLY ? 'WRITE (file ditulis)' : 'DRY-RUN (tidak ada file diubah)'}`);
if (!APPLY && totalChanged > 0) {
  console.log('\n💡 Jalankan dengan --apply untuk menulis:');
  console.log('   node scripts/fix-onclick.js --apply');
}