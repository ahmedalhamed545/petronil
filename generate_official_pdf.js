const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TEMPLATE_IMG_PATH = path.join(__dirname, 'official_quote_template.jpg');

function tafqeet(n) {
  if (!n || n <= 0) return 'صفر ريال سعودي لا غير';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertChunk(num) {
    let parts = [];
    const h = Math.floor(num / 100);
    const rem = num % 100;
    if (h > 0) parts.push(hundreds[h]);
    if (rem > 0) {
      if (rem < 20) {
        parts.push(ones[rem]);
      } else {
        const o = rem % 10;
        const t = Math.floor(rem / 10);
        if (o > 0) parts.push(ones[o] + ' و' + tens[t]);
        else parts.push(tens[t]);
      }
    }
    return parts.join(' و');
  }

  let thousands = Math.floor(n / 1000);
  let remHundred = n % 1000;
  let res = [];

  if (thousands > 0) {
    if (thousands === 1) res.push('ألف');
    else if (thousands === 2) res.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) res.push(convertChunk(thousands) + ' آلاف');
    else res.push(convertChunk(thousands) + ' ألفاً');
  }

  if (remHundred > 0) {
    res.push(convertChunk(remHundred));
  }

  return 'فقط وقدره ' + res.join(' و') + ' ريال سعودي لا غير';
}

function buildQuotationHtml(data) {
  let templateBase64 = '';
  if (fs.existsSync(TEMPLATE_IMG_PATH)) {
    templateBase64 = fs.readFileSync(TEMPLATE_IMG_PATH).toString('base64');
  }

  const quoteNo = data.quoteNo || data.id || 'PET-2026-4927';
  const date = data.date || new Date().toISOString().split('T')[0];
  const currency = data.currency || 'ريال سعودي (SAR)';
  
  // بناءً على توجيهات الإدارة: يظهر اسم العميل فقط في الترويسة (الرقم والمنطقة للإدارة فقط)
  const clientName = data.customerName || data.name || data.clientPrintName || 'عميل بترونيل المحترم';
  const fullClientStr = clientName;

  const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];
  const grandTotal = Math.round(Number(data.grandTotal || data.subtotal || 0));
  const subtotal = Math.round(Number(data.subtotal || grandTotal));
  const discount = Math.round(Number(data.discount || 0));
  const verbalTotal = data.verbalTotal || tafqeet(grandTotal);

  // ملخص المواصفات الفنية المعتمدة للمنظومة والإنفرتر من كتالوج كراون مايكرو 2026
  // (كم يسحب من الكهرباء، كم مجموعات شمسية، قدرة التشغيل والإقلاع، شحن البطارية)
  const defaultSpecsSummary = [
    'كم يسحب من الكهرباء: سحب شبكة ومولد حتى 7.0kW (تيار 30A) يدعم الشحن السريع وتغذية الأحمال بحماية كاملة.',
    'المجموعات الشمسية: منظم MPPT ذكي باستطاعة شمسية حتى 6.5kW، نطاق جهد 120-450V يدعم سلاسل متوازية.',
    'القدرة التشغيلية: قدرة مستمرة 6kW بموجة جيبية نقية Pure Sine Wave، وتحمل إقلاع 12kW للمكيفات والمحركات.',
    'نظام البطاريات والشحن: بطاريات ليثيوم كراون LiFePO4 جهد 48V، تيار شحن 100A يشحن بالكامل في 1.8 ساعة مع BMS.'
  ];

  const specs = (Array.isArray(data.specsSummary) && data.specsSummary.length >= 4)
    ? data.specsSummary
    : ((Array.isArray(data.terms) && data.terms.length >= 4) ? data.terms : defaultSpecsSummary);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>عرض سعر رسمي - ${quoteNo}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800;900&display=swap');

@page {
  size: 210mm 297mm;
  margin: 0;
}

* {
  box-sizing: border-box;
}

body, html {
  margin: 0;
  padding: 0;
  width: 210mm;
  height: 297mm;
  direction: rtl;
  font-family: 'Tajawal', 'Cairo', Arial, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.sheet {
  position: relative;
  width: 210mm;
  height: 297mm;
  background-image: url('data:image/jpeg;base64,${templateBase64}');
  background-size: 100% 100%;
  background-position: top center;
  background-repeat: no-repeat;
  color: #0f172a;
}

.pos {
  position: absolute;
  white-space: nowrap;
}

/* NO. value (placed to the right of 'NO.') */
.quote-no {
  top: 17.8%;
  left: 17.0%;
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
  direction: ltr;
}

/* Currency value (placed to the left of 'العملة:') */
.quote-currency {
  top: 19.8%;
  left: 27.0%;
  font-size: 12px;
  font-weight: 800;
  color: #1e3a8a;
}

/* Date value (placed to the left of 'التاريخ:') */
.quote-date {
  top: 17.8%;
  right: 18.0%;
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
  direction: ltr;
}

/* Clean full customer banner covering template box completely */
.clean-customer-box {
  position: absolute;
  top: 22.6%;
  right: 8.65%;
  width: 82.7%;
  height: 2.3%;
  background: #ffffff;
  border: 1.5px solid #1e293b;
  display: flex;
  align-items: center;
  padding: 0 12px;
  direction: rtl;
  box-sizing: border-box;
  z-index: 10;
}

.clean-cb-label {
  font-weight: 800;
  font-size: 11px;
  color: #0f172a;
  margin-left: 8px;
}

.clean-cb-name {
  font-weight: 900;
  font-size: 12px;
  color: #1e3a8a;
}

/* Header banner covering "الضمان وشروطه:" with matching dark blue */
.clean-specs-header {
  position: absolute;
  top: 56.35%;
  right: 8.65%;
  width: 82.7%;
  height: 2.05%;
  background: #1e3a8a;
  color: #ffffff;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 9.5px;
  font-weight: 800;
  box-sizing: border-box;
  z-index: 10;
}

/* Feature 1 override to remove legacy warranty mention */
.clean-feature-1 {
  position: absolute;
  top: 69.45%;
  right: 12.0%;
  width: 75.0%;
  height: 1.6%;
  background: #ffffff;
  display: flex;
  align-items: center;
  font-size: 8.5px;
  font-weight: 700;
  color: #0f172a;
  z-index: 10;
}

/* Table Item Rows (Y = 28.03% + idx * 1.76%, Height = 1.76%) */
.row-item {
  position: absolute;
  height: 1.76%;
  display: flex;
  align-items: center;
  font-size: 10.5px;
  line-height: 1;
}

.cell-num {
  position: absolute;
  right: 7.30%;
  width: 4.46%;
  text-align: center;
  font-weight: 800;
}

.cell-desc {
  position: absolute;
  right: 11.76%;
  width: 38.65%;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 4px;
  font-weight: 700;
  color: #0f172a;
}

.cell-unit {
  position: absolute;
  right: 50.41%;
  width: 8.92%;
  text-align: center;
  font-weight: 600;
}

.cell-qty {
  position: absolute;
  right: 59.32%;
  width: 8.92%;
  text-align: center;
  font-weight: 800;
}

.cell-price {
  position: absolute;
  right: 68.24%;
  width: 8.51%;
  text-align: center;
  font-weight: 700;
}

.cell-total {
  position: absolute;
  right: 76.76%;
  width: 14.59%;
  text-align: center;
  font-weight: 800;
  color: #1e3a8a;
}

/* Financial Totals on bottom left (covering the template zeroes with white box & bold number) */
.val-subtotal {
  top: 47.56%;
  left: 8.65%;
  width: 14.59%;
  height: 1.76%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  font-size: 12.5px;
  font-weight: 800;
  color: #0f172a;
}

.val-discount {
  top: 49.32%;
  left: 8.65%;
  width: 14.59%;
  height: 1.76%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  font-size: 12.5px;
  font-weight: 800;
  color: #0f172a;
}

.val-grandtotal {
  top: 51.07%;
  left: 8.65%;
  width: 14.59%;
  height: 2.25%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  font-size: 13px;
  font-weight: 900;
  color: #b91c1c;
}

/* Verbal Total on bottom right (in the row to the left of 'الإجمالي النهائي:') */
.val-verbal {
  top: 51.07%;
  right: 21.0%;
  width: 58.0%;
  height: 2.25%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-size: 11px;
  font-weight: 800;
  color: #1e3a8a;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 4 Technical Summary Lines from Crown Micro 2026 Catalog */
.term-line {
  position: absolute;
  right: 12.0%;
  width: 74.0%;
  display: flex;
  align-items: center;
  font-size: 8.5px;
  font-weight: 700;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.term-1 { top: 58.5%; height: 1.76%; }
.term-2 { top: 60.5%; height: 1.76%; }
.term-3 { top: 62.5%; height: 1.76%; }
.term-4 { top: 64.5%; height: 1.76%; }
</style>
</head>
<body>
<div class="sheet">
  <div class="pos quote-no">${quoteNo}</div>
  <div class="pos quote-currency">${currency}</div>
  <div class="pos quote-date">${date}</div>
  
  <!-- Clean Customer Banner (Name only, positioned properly next to مطلوب من الأخ:) -->
  <div class="clean-customer-box">
    <span class="clean-cb-label">مطلوب من الأخ:</span>
    <span class="clean-cb-name">${clientName}</span>
  </div>

  <!-- Items -->
  ${items.map((it, idx) => {
    const topPct = (28.03 + (idx * 1.76)).toFixed(2);
    const itemNum = it.itemNumber || (idx + 1);
    const itemName = it.name + (it.specs ? ` (${it.specs})` : '');
    const itemUnit = it.unit || 'حبة';
    const itemQty = it.quantity || 1;
    const itemPrice = typeof it.unitPrice === 'number' ? it.unitPrice.toLocaleString('en-US') : (it.unitPrice || '0');
    const itemTotal = typeof it.totalPrice === 'number' ? it.totalPrice.toLocaleString('en-US') : (it.totalPrice || '0');

    return `
    <div class="row-item" style="top: ${topPct}%; width: 100%;">
      <div class="cell-num">${itemNum}</div>
      <div class="cell-desc">${itemName}</div>
      <div class="cell-unit">${itemUnit}</div>
      <div class="cell-qty">${itemQty}</div>
      <div class="cell-price">${itemPrice}</div>
      <div class="cell-total">${itemTotal}</div>
    </div>`;
  }).join('')}

  <!-- Financial Figures -->
  <div class="pos val-subtotal">${subtotal.toLocaleString('en-US')}</div>
  <div class="pos val-discount">${discount.toLocaleString('en-US')}</div>
  <div class="pos val-grandtotal">${grandTotal.toLocaleString('en-US')}</div>
  <div class="pos val-verbal">${verbalTotal}</div>

  <!-- Clean Specs Banner covering "الضمان وشروطه:" -->
  <div class="clean-specs-header">
    ملخص المواصفات الفنية المعتمدة للمنظومة والإنفرتر (كتالوج Crown Micro 2026):
  </div>

  <!-- Technical Specs Summary Lines (Arabic Catalog Specs Summary) -->
  <div class="term-line term-1">${specs[0]}</div>
  <div class="term-line term-2">${specs[1]}</div>
  <div class="term-line term-3">${specs[2]}</div>
  <div class="term-line term-4">${specs[3]}</div>

  <!-- Feature 1 Override (No warranty mentions) -->
  <div class="clean-feature-1">تقديم أفضل الخدمات الفنية بعد البيع ومتابعة المنظومة مع الدعم الهندسي المستمر.</div>
</div>
</body>
</html>`;
}

function generatePdfFile(quoteData, targetPdfPath) {
  const htmlContent = buildQuotationHtml(quoteData);
  const tempHtmlPath = path.join(__dirname, `temp_quote_${Date.now()}.html`);
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

  try {
    if (!fs.existsSync(EDGE_PATH)) {
      throw new Error(`Edge executable not found at: ${EDGE_PATH}`);
    }

    const absPdfPath = path.resolve(targetPdfPath);
    const absHtmlPath = path.resolve(tempHtmlPath);

    const cmd = `"${EDGE_PATH}" --headless=new --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${absPdfPath}" "${absHtmlPath}"`;
    execSync(cmd, { stdio: 'pipe', timeout: 30000 });

    if (fs.existsSync(absPdfPath)) {
      const stats = fs.statSync(absPdfPath);
      return { success: true, pdfPath: absPdfPath, sizeBytes: stats.size };
    } else {
      throw new Error("PDF file was not created by browser.");
    }
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      try { fs.unlinkSync(tempHtmlPath); } catch (e) {}
    }
  }
}

module.exports = {
  buildQuotationHtml,
  generatePdfFile,
  tafqeet
};
