const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname);
const zipPath = path.join(__dirname, '..', 'solar-calc-site.zip');
const desktopDir = 'C:\\Users\\User\\Desktop\\ملفات_موقع_بترونيل_للرفع';

console.log('--- Packaging Petronil Yemen Solar Calculator ---');
console.log('Source:', srcDir);
console.log('Target Zip:', zipPath);
console.log('Target Desktop:', desktopDir);

// 1. Sync to desktop folder
if (!fs.existsSync(desktopDir)) {
  fs.mkdirSync(desktopDir, { recursive: true });
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(srcDir, desktopDir);
console.log('✅ Copied files to Desktop folder successfully');

// 2. Compress via PowerShell Compress-Archive without variable syntax
try {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const psCmd = `powershell -Command "Compress-Archive -Path '${desktopDir}\\*' -DestinationPath '${zipPath}' -Force"`;
  execSync(psCmd, { stdio: 'inherit' });
  const stats = fs.statSync(zipPath);
  console.log(`✅ Zip archive created successfully: ${(stats.size / 1024).toFixed(1)} KB`);
} catch (err) {
  console.error('Error creating zip:', err);
}
