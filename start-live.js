const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("=== تشغيل خادم بترونيل ونفق Cloudflare الآمن ===");

// 1. Start Server
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

server.on('error', (err) => console.error("Server error:", err));

// 2. Start Cloudflared
const cloudflaredPath = 'C:\\Users\\User\\.gemini\\antigravity\\scratch\\cloudflared.exe';
const tunnel = spawn(cloudflaredPath, ['tunnel', '--url', 'http://localhost:3000'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let tunnelUrlFound = false;

function scanOutput(data) {
  const text = data.toString();
  const match = text.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/i);
  if (match && !tunnelUrlFound) {
    tunnelUrlFound = true;
    const url = match[0];
    console.log("\n=======================================================");
    console.log("🚀 رابط الوصول المباشر والسريع للموقع (للأندرويد والآيفون):");
    console.log(url);
    console.log("=======================================================\n");
    fs.writeFileSync(path.join(__dirname, 'tunnel_url.txt'), url, 'utf8');
  }
}

tunnel.stdout.on('data', scanOutput);
tunnel.stderr.on('data', scanOutput);

tunnel.on('error', (err) => console.error("Cloudflare error:", err));
