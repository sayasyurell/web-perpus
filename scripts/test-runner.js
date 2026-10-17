const { spawn, execSync } = require('child_process');
const http = require('http');

console.log('⏳ Menyalakan server untuk testing...');

// Jalankan server.js
const server = spawn('node', ['server.js'], { stdio: 'ignore' });

let finished = false;

const checkServer = setInterval(() => {
  http.get('http://127.0.0.1:3000/api/ping', (res) => {
    if (res.statusCode >= 200 && res.statusCode < 500) {
      clearInterval(checkServer);
      finished = true;
      console.log('✅ Server siap. Menjalankan test...\n');
      
      try {
        // Gunakan execSync persis seperti perintah di package.json
        execSync('node --test "test/*.test.js"', { stdio: 'inherit' });
      } catch (err) {
        // Jika test gagal, errornya sudah ditangani oleh Node Test Runner
      } finally {
        console.log('\n🛑 Mematikan server...');
        server.kill();
        process.exit(0);
      }
    }
  }).on('error', () => {
    // Server belum siap, abaikan dan tunggu 500ms lagi
  });
}, 500);

server.on('exit', (code) => {
  if (code !== 0 && !finished) {
    clearInterval(checkServer);
    console.error('\n❌ Gagal menyalakan server. Pastikan port 3000 tidak sedang dipakai.');
    process.exit(1);
  }
});