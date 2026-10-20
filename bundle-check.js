const fs = require('fs');
const path = require('path');

const enginePath = path.join(__dirname, 'engine', 'solar-engine.js');
const calcPath = path.join(__dirname, 'calculator.js');

const engineCode = fs.readFileSync(enginePath, 'utf8');
const calcCode = fs.readFileSync(calcPath, 'utf8');

// Combine with safety check so it never collides
const bundledContent = `/**
 * Embedded Universal SolarEngine Fallback
 * تضمن تشغيل محرك الحسابات حتى لو لم يتم رفع مجلد engine
 */
if (typeof SolarEngine === 'undefined') {
${engineCode}
}

${calcCode}`;

try {
  new Function(bundledContent);
  console.log('✅ Combined bundled code is 100% syntactically valid!');
  fs.writeFileSync(calcPath, bundledContent, 'utf8');
  console.log('✅ Updated calculator.js with embedded self-healing SolarEngine fallback.');
} catch (err) {
  console.error('❌ Error testing bundled code:', err.message);
  process.exit(1);
}
