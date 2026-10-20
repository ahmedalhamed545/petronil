const localtunnel = require('localtunnel');
const fs = require('fs');

(async () => {
  try {
    console.log("Starting tunnel...");
    const tunnel = await localtunnel({ port: 3000 });
    console.log("Tunnel URL:", tunnel.url);
    fs.writeFileSync('tunnel_url.txt', tunnel.url, 'utf8');
  } catch (err) {
    console.error("Tunnel error:", err);
    fs.writeFileSync('tunnel_url.txt', "Error: " + err.message, 'utf8');
  }
})();
