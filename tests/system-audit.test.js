/**
 * Comprehensive Automated System Audit & Verification Suite (10 Cases)
 * شركة بترونيل يمن للطاقة - فحص هندسي وبرمجي شامل
 */

const assert = require('assert');
const path = require('path');
const SolarEngine = require('../engine/solar-engine.js');
const db = require('../database.js');

console.log('===============================================================');
console.log('🧪 بدء الفحص الشامل المعتمد لموقع وأنظمة بترونيل يمن للطاقة (10 اختبارات)');
console.log('===============================================================\n');

let passedTests = 0;
let totalTests = 10;

function runTest(testNum, testTitle, testFn) {
  try {
    process.stdout.write(`اختبار [${testNum}/10] ${testTitle}... `);
    testFn();
    console.log('✅ نجح');
    passedTests++;
  } catch (err) {
    console.log('❌ فشل');
    console.error(`   الخطأ: ${err.message}`);
    if (err.stack) {
      const lines = err.stack.split('\n').slice(1, 4).join('\n');
      console.error(`   ${lines}`);
    }
  }
}

// -------------------------------------------------------------
// Test 1: Zero Appliances Handling (loads = 0, no 100% autonomy, no NaN, no $0 packages)
// -------------------------------------------------------------
runTest(1, 'التعامل مع انعدام الأحمال (أحمال = صفر): لا استقلالية 100%، لا قيم غير معرفة، لا باقات بسعر صفر', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([], sched, 96);

  assert.strictEqual(profile.totalDailyKwh, 0, 'إجمالي الطاقة اليومية يجب أن يكون 0');
  assert.strictEqual(profile.peakContinuousKw, 0, 'القدرة المتزامنة يجب أن تكون 0');
  assert.strictEqual(profile.maxSurgeKw, 0, 'أقصى تيار إقلاع يجب أن يكون 0');

  const sim = SolarEngine.runSimulation({
    loadProfile: profile,
    gridSchedule: sched,
    pvKwPeak: 5.0,
    batteryCapacityKwh: 10.0,
    designParams: SolarEngine.DEFAULT_DESIGN_PARAMS
  });

  assert.strictEqual(sim.summary.hasLoads, false, 'hasLoads يجب أن تكون false');
  assert.strictEqual(sim.summary.solarCoveragePercent, 0, 'نسبة التغطية لا يمكن أن تكون 100% عند انعدام الأحمال');
  assert.strictEqual(isNaN(sim.summary.solarCoveragePercent), false, 'نسبة التغطية ليست NaN');

  const content = db.getContent();
  const matchResult = SolarEngine.sizeAndMatchSystem(profile, sched, content, SolarEngine.DEFAULT_DESIGN_PARAMS);
  assert.strictEqual(matchResult.success, false, 'sizeAndMatchSystem يجب أن يعيد success: false عند عدم وجود أحمال');
  assert.strictEqual(matchResult.error, 'NO_LOADS', 'كود الخطأ يجب أن يكون NO_LOADS');
  assert.strictEqual(matchResult.packages, null, 'لا يتم توليد باقات بأسعار صفر');
});

// -------------------------------------------------------------
// Test 2: Single Appliance & Quantity Scaling
// -------------------------------------------------------------
runTest(2, 'إضافة جهاز وحيد ومضاعفة عدده: الطاقة اليومية والقدرة تتناسب طردياً وبدقة', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const app1 = {
    id: 'test_tv',
    name: 'شاشة تلفزيون ذكية',
    watt: 100,
    quantity: 1,
    dayHours: 4,
    nightHours: 4,
    powerFactor: 0.95,
    surgeFactor: 1.0,
    dutyCycle: 1.0,
    priority: 'essential'
  };

  const p1 = SolarEngine.calculateLoadProfile([app1], sched, 96);
  assert.strictEqual(p1.totalDailyKwh, 0.8, '100W * 8h = 0.8 kWh');
  assert.strictEqual(p1.peakContinuousKw, 0.1, '100W = 0.1 kW');

  // مضاعفة العدد إلى 3 أجهزة
  const app3 = { ...app1, quantity: 3 };
  const p3 = SolarEngine.calculateLoadProfile([app3], sched, 96);
  assert.strictEqual(p3.totalDailyKwh, 2.4, '100W * 3 * 8h = 2.4 kWh');
  assert.strictEqual(p3.peakContinuousKw, 0.3, '300W = 0.3 kW');
  assert.strictEqual(p3.totalDayKwh, 1.2, '1.2 kWh نهاراً');
  assert.strictEqual(p3.totalNightKwh, 1.2, '1.2 kWh ليلاً');
});

// -------------------------------------------------------------
// Test 3: Day Hours vs Night Hours Modification
// -------------------------------------------------------------
runTest(3, 'تعديل ساعات النهار والليل: سعة البطارية تتناسب مع الليل وتوليد الألواح يغطي كامل اليوم', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  // حالة أ: استهلاك ليلي مكثف
  const appNightHeavy = [{
    id: 'ac_unit',
    name: 'مكيف سبليت',
    watt: 1000,
    quantity: 1,
    dayHours: 2,
    nightHours: 8,
    dutyCycle: 1.0,
    surgeFactor: 2.5
  }];
  const pNight = SolarEngine.calculateLoadProfile(appNightHeavy, sched, 96);
  assert.strictEqual(pNight.totalNightKwh, 8.0, 'استهلاك الليل يجب أن يكون 8.0 kWh');
  assert.strictEqual(pNight.totalDayKwh, 2.0, 'استهلاك النهار يجب أن يكون 2.0 kWh');

  // حالة ب: استهلاك نهاري مكثف
  const appDayHeavy = [{
    id: 'ac_unit',
    name: 'مكيف سبليت',
    watt: 1000,
    quantity: 1,
    dayHours: 8,
    nightHours: 2,
    dutyCycle: 1.0,
    surgeFactor: 2.5
  }];
  const pDay = SolarEngine.calculateLoadProfile(appDayHeavy, sched, 96);
  assert.strictEqual(pDay.totalNightKwh, 2.0, 'استهلاك الليل يجب أن يكون 2.0 kWh');
  assert.strictEqual(pDay.totalDayKwh, 8.0, 'استهلاك النهار يجب أن يكون 8.0 kWh');

  // فحص sizing للبطارية في الحالتين
  const content = db.getContent();
  const matchNight = SolarEngine.sizeAndMatchSystem(pNight, sched, content, SolarEngine.DEFAULT_DESIGN_PARAMS);
  const matchDay = SolarEngine.sizeAndMatchSystem(pDay, sched, content, SolarEngine.DEFAULT_DESIGN_PARAMS);

  assert.ok(
    matchNight.sizingRequirements.targetUsableBatteryKwh > matchDay.sizingRequirements.targetUsableBatteryKwh,
    'الاستهلاك الليلي المكثف يتطلب سعة تخزين بطاريات أكبر'
  );
});

// -------------------------------------------------------------
// Test 4: Off-grid Mode (24h Outage Autonomy)
// -------------------------------------------------------------
runTest(4, 'وضع النظام المعزول (Off-Grid): 24 ساعة انقطاع كامل واعتماد 100% على الطاقة والبطاريات', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  assert.strictEqual(sched.totalGridHours, 0, 'ساعات الشبكة 0');
  assert.strictEqual(sched.totalOutageHours, 24, 'ساعات الانقطاع 24');
  assert.strictEqual(sched.steps.every(s => s === false), true, 'كل الخطوات بدون كهرباء حكومية');
});

// -------------------------------------------------------------
// Test 5: Grid Schedule Mode (Intermittent Outage Intervals)
// -------------------------------------------------------------
runTest(5, 'وضع جدول الشبكة المتقطعة: احتساب فترات توفر الشبكة وتخفيف العبء عن البطاريات', () => {
  const sched = SolarEngine.parseGridSchedule({
    mode: 'schedule',
    intervals: [
      { start: '08:00', end: '12:00' }, // 4 ساعات
      { start: '18:00', end: '22:00' }  // 4 ساعات
    ]
  }, 96);

  assert.strictEqual(sched.totalGridHours, 8, 'إجمالي ساعات الشبكة 8 ساعات');
  assert.strictEqual(sched.totalOutageHours, 16, 'إجمالي ساعات الانقطاع 16 ساعة');

  const app = [{
    id: 'light',
    name: 'إنارة منزلية',
    watt: 200,
    quantity: 1,
    dayHours: 6,
    nightHours: 6,
    dutyCycle: 1.0
  }];
  const profile = SolarEngine.calculateLoadProfile(app, sched, 96);
  assert.ok(profile.totalOutageKwh < profile.totalDailyKwh, 'استهلاك الانقطاع أقل من إجمالي الاستهلاك بفضل وجود الشبكة');
});

// -------------------------------------------------------------
// Test 6: Incomplete & Inactive Inventory Rejection (No $0 Packages)
// -------------------------------------------------------------
runTest(6, 'استبعاد المنتجات غير المكتملة أو ذات السعر صفر: منع ظهور الباقات المضللة ($0)', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([{
    id: 'fridge', name: 'ثلاجة', watt: 150, quantity: 1, dayHours: 6, nightHours: 6, dutyCycle: 0.5
  }], sched, 96);

  // مخزون يحتوي على إنفرتر سعره 0 أو اسمه فارغ
  const brokenInventory = {
    inverters: [
      { id: 'broken_inv_1', name: '', price: 0, capacityKw: 5, available: true },
      { id: 'broken_inv_2', name: 'إنفرتر غير متاح', price: 600, capacityKw: 5, available: false }
    ],
    batteries: [
      { id: 'bat_valid', name: 'بطارية ليثيوم', price: 1200, capacityKwh: 5.12, available: true }
    ],
    panels: [
      { id: 'pnl_valid', name: 'لوح شمسي', price: 90, watt: 580, available: true }
    ]
  };

  const match = SolarEngine.sizeAndMatchSystem(profile, sched, brokenInventory, SolarEngine.DEFAULT_DESIGN_PARAMS);
  assert.strictEqual(match.success, false, 'يجب رفض المخزون غير المكتمل هندسياً ومالياً');
  assert.strictEqual(match.error, 'INCOMPLETE_INVENTORY', 'كود الخطأ INCOMPLETE_INVENTORY');
  assert.strictEqual(match.packages, null, 'عدم توليد باقات بأسعار صفر');
});

// -------------------------------------------------------------
// Test 7: Admin Price Update Reflected in Sizing & Quotation
// -------------------------------------------------------------
runTest(7, 'تحديث الأسعار في قاعدة البيانات: ينعكس فورياً ودقيقاً على عروض الأسعار', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([{
    id: 'pump', name: 'مضخة مياه', watt: 750, quantity: 1, dayHours: 4, nightHours: 2, dutyCycle: 1.0, surgeMultiplier: 3.0
  }], sched, 96);

  const initialContent = db.getContent();
  const initialMatch = SolarEngine.sizeAndMatchSystem(profile, sched, initialContent, SolarEngine.DEFAULT_DESIGN_PARAMS);
  assert.strictEqual(initialMatch.success, true);
  const initialQuote = SolarEngine.generateQuotation(initialMatch.packages.recommended, SolarEngine.DEFAULT_DESIGN_PARAMS);

  // تحديث سعر لوح الطاقة في قاعدة البيانات بزيادة $10
  const originalPanels = db.getPanels();
  const testPanel = originalPanels[0];
  const originalPrice = testPanel.price;
  
  try {
    db.updatePanel(testPanel.id, { price: originalPrice + 10 });
    const updatedContent = db.getContent();
    const updatedMatch = SolarEngine.sizeAndMatchSystem(profile, sched, updatedContent, SolarEngine.DEFAULT_DESIGN_PARAMS);
    const updatedQuote = SolarEngine.generateQuotation(updatedMatch.packages.recommended, SolarEngine.DEFAULT_DESIGN_PARAMS);

    const panelCount = updatedMatch.packages.recommended.panel.quantity;
    const expectedDiff = panelCount * 10;
    const actualDiff = Math.round(updatedQuote.financials.totalCostUsd - initialQuote.financials.totalCostUsd);

    assert.strictEqual(actualDiff, expectedDiff, `التكلفة يجب أن ترتفع بمقدار $${expectedDiff}`);
  } finally {
    // إعادة السعر الأصلي فوراً للحفاظ على سلامة البيانات
    db.updatePanel(testPanel.id, { price: originalPrice });
  }
});

// -------------------------------------------------------------
// Test 8: Lead Submission Saved in DB and Accessible in Admin
// -------------------------------------------------------------
runTest(8, 'تسجيل طلب عميل جديد: يُحفظ في قاعدة البيانات ويظهر في لوحة الإدارة مع كافة التفاصيل', () => {
  const testLead = {
    name: 'مهندس فحص تجريبي',
    phone: '777000111',
    location: 'عدن - المنصورة',
    systemType: 'الباقة الموصى بها',
    dailyEnergyKwh: 12.5,
    inverterCapacityKw: 5.0,
    totalCost: 3250,
    currency: 'USD',
    notes: 'فحص تكاملي آلي من نظام الاختبارات'
  };

  const added = db.addLead(testLead);
  assert.ok(added.id, 'الطلب يجب أن يحصل على ID فريد');

  const leads = db.getLeads();
  const found = leads.find(l => l.id === added.id);
  assert.ok(found, 'الطلب موجود ومحفوظ في قاعدة البيانات');
  assert.strictEqual(found.name, testLead.name);
  assert.strictEqual(found.totalCost, 3250);
  assert.strictEqual(found.status, 'New');

  // حذف سجل الفحص للحفاظ على نظافة بيانات الشركة
  db.deleteLead(added.id);
  const leadsAfter = db.getLeads();
  assert.strictEqual(leadsAfter.some(l => l.id === added.id), false, 'تم تنظيف سجل الفحص بنجاح');
});

// -------------------------------------------------------------
// Test 9: Real Deficit Handling & Autonomy Capping
// -------------------------------------------------------------
runTest(9, 'معالجة العجز الحقيقي في الطاقة: كسر الاستقلالية والتحذير من انقطاع الأحمال', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  // حمل ضخم 5000W طوال اليوم والليل = 120 kWh
  const massiveLoad = [{
    id: 'heavy_factory',
    name: 'حمل صناعي ثقيل',
    watt: 5000,
    quantity: 1,
    dayHours: 12,
    nightHours: 12,
    dutyCycle: 1.0
  }];
  const massiveProfile = SolarEngine.calculateLoadProfile(massiveLoad, sched, 96);

  // منظومة صغيرة جداً: ألواح 1kW وبطارية 2kWh
  const sim = SolarEngine.runSimulation({
    loadProfile: massiveProfile,
    gridSchedule: sched,
    pvKwPeak: 1.0,
    batteryCapacityKwh: 2.0,
    designParams: SolarEngine.DEFAULT_DESIGN_PARAMS
  });

  assert.strictEqual(sim.summary.hasDeficit, true, 'يجب أن يكتشف المحاكي وجود عجز في الطاقة');
  assert.ok(sim.summary.totalUnservedEnergyKwh > 0, 'الطاقة غير المغطاة أكبر من صفر');
  assert.ok(sim.summary.solarCoveragePercent < 99, 'نسبة الاستقلالية يجب ألا تتجاوز 99% عند وجود عجز حقيقي');
  assert.ok(sim.summary.batteryFullDepletionsCount > 0, 'استنزاف كامل للبطارية');
});

// -------------------------------------------------------------
// Test 10: Quotation & BOM Financials, Validity Days, and Disclaimers
// -------------------------------------------------------------
runTest(10, 'عرض السعر وجدول الكميات: صلاحية العرض الديناميكية، مطابقة المجاميع المالية، والتنويه الهندسي', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([{
    id: 'fridge_inv', name: 'ثلاجة إنفرتر', watt: 120, quantity: 1, dayHours: 6, nightHours: 6, dutyCycle: 0.5
  }], sched, 96);

  const content = db.getContent();
  const match = SolarEngine.sizeAndMatchSystem(profile, sched, content, SolarEngine.DEFAULT_DESIGN_PARAMS);
  assert.strictEqual(match.success, true);

  const customDesignParams = {
    ...SolarEngine.DEFAULT_DESIGN_PARAMS,
    quoteValidityDays: 20,
    defaultCurrency: 'USD',
    enableYerDisplay: false
  };

  const quote = SolarEngine.generateQuotation(match.packages.recommended, customDesignParams, {
    name: 'عبدالرحمن باحاج',
    phone: '783999039',
    location: 'عدن'
  });

  assert.strictEqual(quote.validUntilDays, 20, 'صلاحية العرض يجب أن تأخذ القيمة المحددة من الإعدادات (20 يوماً)');
  assert.ok(quote.terms.some(t => t.includes('20 يوماً')), 'بنود العرض تتضمن مدة الصلاحية المحددة');
  assert.ok(quote.terms.some(t => t.includes('تقديرية') || t.includes('مهندس مختص')), 'إخلاء المسؤولية والتنويه الهندسي موجود بوضوح');
  assert.ok(quote.terms.some(t => t.includes('Crown Micro')), 'ذكر وكالة Crown Micro المعتمدة في الشروط');

  // تدقيق مالي لبنود جدول الكميات BOM
  const itemsSum = quote.items.reduce((sum, it) => sum + it.totalPrice, 0);
  assert.strictEqual(itemsSum, quote.financials.totalCostUsd, 'مجموع أسعار بنود BOM يطابق تماماً إجمالي عرض السعر');
});

console.log('\n===============================================================');
console.log(`🏁 نتيجة الفحص: ${passedTests} من أصل ${totalTests} اختبارات اكتملت بنجاح!`);
if (passedTests === totalTests) {
  console.log('🎉 المنظومة مطابقة بنسبة 100% لكافة المتطلبات الهندسية والبرمجية الصارمة.');
} else {
  console.log('⚠️ هناك اختبارات لم تنجح، يرجى مراجعة التفاصيل أعلاه.');
  process.exit(1);
}
console.log('===============================================================\n');
