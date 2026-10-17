const { spawn } = require('child_process');
const http = require('http');

console.log('⏳ Menyalakan server untuk testing...');
const server = spawn('node', ['server.js'], { stdio: 'ignore' });

const checkServer = setInterval(() => {
  http.get('http://127.0.0.1:3000/api/ping', (res) => {
    if (res.statusCode === 200) {
      clearInterval(checkServer);
      console.log('✅ Server siap. Menjalankan test...\n');
      
      const tester = spawn('node', ['--test', 'test/'], { stdio: 'inherit', shell: true });
      
      tester.on('exit', (code) => {
        console.log('\n🛑 Mematikan server...');
        server.kill();
        process.exit(code);
      });
    }
  }).on('error', () => {
    // Server belum siap, tunggu 500ms lagi
  });
}, 500);