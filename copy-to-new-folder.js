const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = 'C:\\Users\\User\\.gemini\\antigravity\\scratch\\solar-calc-site';
const targetDir = 'C:\\Users\\User\\Desktop\\ملفات_موقع_بترونيل_للرفع_جديد';
const zipPath = 'C:\\Users\\User\\Desktop\\ملفات_موقع_بترونيل_للرفع_جديد.zip';

console.log('=== نسخ ملفات المشروع إلى المجلد الجديد على سطح المكتب ===');
console.log('المصدر:', srcDir);
console.log('المجلد المستهدف:', targetDir);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('solar-calc-site-backup')) continue;
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

copyRecursive(srcDir, targetDir);
console.log('✅ تم نسخ كافة الملفات والمجلدات بنجاح إلى المجلد الجديد.');

// إضافة ملف نصي سريع برابط الموقع
const note = `رابط موقع شركة بترونيل يمن للطاقة (لتجربته على الأندرويد والآيفون مباشرة):
https://fibre-loads-alike-pond.trycloudflare.com

تاريخ الحزمة: ${new Date().toLocaleString('ar-YE')}
المحتويات:
- الموقع الكامل (HTML, CSS, JS)
- محرك الحسابات والمحاكاة الهندسية 24h
- كشف المواد BOM وعرض السعر الرسمي
- شعار بترونيل الأصلي وجميع الأيقونات
`;
fs.writeFileSync(path.join(targetDir, 'معلومات_ورابط_الموقع.txt'), note, 'utf8');

// إنشاء أرشيف مضغوط ZIP على سطح المكتب
try {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${targetDir}\\*' -DestinationPath '${zipPath}' -Force"`;
  execSync(cmd, { stdio: 'inherit' });
  const stat = fs.statSync(zipPath);
  console.log(`✅ تم إنشاء الملف المضغوط الجديد على سطح المكتب: ${(stat.size / 1024).toFixed(1)} KB`);
} catch (err) {
  console.error('تنبيه عند ضغط الأرشيف:', err.message);
}

console.log('=== اكتمل العمل بنجاح ===');
