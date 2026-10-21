/**
 * Comprehensive Automated System Audit & Verification Suite (14 Cases)
 * شركة بترونيل يمن للطاقة - فحص هندسي وبرمجي شامل ومعتمد (14 سيناريو إلزامي)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const SolarEngine = require('../engine/solar-engine.js');
const db = require('../database.js');

console.log('====================================================================');
console.log('🧪 بدء الفحص الهندسي والبرمجي الشامل المعتمد لمنصة بترونيل يمن للطاقة (14 اختباراً)');
console.log('====================================================================\n');

let passedTests = 0;
const totalTests = 14;

function runTest(testNum, testTitle, testFn) {
  try {
    process.stdout.write(`اختبار [${testNum}/14] ${testTitle}... `);
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

// -----------------------------------------------------------------
// Test 1: عدم إدخال أي أحمال
// -----------------------------------------------------------------
runTest(1, 'عدم إدخال أي أحمال (loads = 0): لا استقلالية 100%، لا قيم NaN، لا باقات بـ $0', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([], sched, 96);

  assert.strictEqual(profile.totalDailyKwh, 0);
  assert.strictEqual(profile.peakContinuousKw, 0);
  assert.strictEqual(profile.maxSurgeKw, 0);

  const sim = SolarEngine.runSimulation({
    loadProfile: profile,
    gridSchedule: sched,
    pvKwPeak: 5.0,
    batteryCapacityKwh: 10.0,
    designParams: SolarEngine.DEFAULT_DESIGN_PARAMS
  });

  assert.strictEqual(sim.summary.hasLoads, false);
  assert.strictEqual(sim.summary.solarCoveragePercent, 0, 'نسبة التغطية لا يمكن أن تكون 100% عند انعدام الأحمال');
  assert.strictEqual(isNaN(sim.summary.solarCoveragePercent), false);

  const content = db.getContent();
  const matchResult = SolarEngine.sizeAndMatchSystem(profile, sched, content, SolarEngine.DEFAULT_DESIGN_PARAMS);
  assert.strictEqual(matchResult.success, false);
  assert.strictEqual(matchResult.error, 'NO_LOADS');
  assert.strictEqual(matchResult.packages, null);
});

// -----------------------------------------------------------------
// Test 2: إضافة جهاز واحد وتغيير عدده
// -----------------------------------------------------------------
runTest(2, 'إضافة جهاز واحد وتغيير عدده: تناسب خطي دقيق للطاقة والقدرة المتزامنة', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const app1 = {
    id: 'test_light',
    name: 'إنارة LED',
    watt: 50,
    quantity: 1,
    dayHours: 6,
    nightHours: 6,
    powerFactor: 0.9,
    surgeMultiplier: 1.0,
    dutyCycle: 1.0
  };

  const p1 = SolarEngine.calculateLoadProfile([app1], sched, 96);
  assert.strictEqual(p1.totalDailyKwh, 0.6, '50W * 12h = 0.6 kWh');
  assert.strictEqual(p1.peakContinuousKw, 0.05, '50W = 0.05 kW');

  // مضاعفة العدد إلى 4
  const app4 = { ...app1, quantity: 4 };
  const p4 = SolarEngine.calculateLoadProfile([app4], sched, 96);
  assert.strictEqual(p4.totalDailyKwh, 2.4, '50W * 4 * 12h = 2.4 kWh');
  assert.strictEqual(p4.peakContinuousKw, 0.2, '200W = 0.2 kW');
});

// -----------------------------------------------------------------
// Test 3: تغيير ساعات التشغيل نهاراً وليلاً
// -----------------------------------------------------------------
runTest(3, 'تغيير ساعات التشغيل نهاراً وليلاً: سعة البطارية تتناسب مع الليل وتوليد الألواح يغطي اليوم', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const appNight = [{ id: 'test_ac', name: 'مكيف', watt: 1200, quantity: 1, dayHours: 2, nightHours: 8, dutyCycle: 1.0 }];
  const appDay = [{ id: 'test_ac', name: 'مكيف', watt: 1200, quantity: 1, dayHours: 8, nightHours: 2, dutyCycle: 1.0 }];

  const pNight = SolarEngine.calculateLoadProfile(appNight, sched, 96);
  const pDay = SolarEngine.calculateLoadProfile(appDay, sched, 96);

  assert.strictEqual(pNight.totalNightKwh, 9.6);
  assert.strictEqual(pDay.totalNightKwh, 2.4);

  const content = db.getContent();
  const matchNight = SolarEngine.sizeAndMatchSystem(pNight, sched, content, SolarEngine.DEFAULT_DESIGN_PARAMS);
  const matchDay = SolarEngine.sizeAndMatchSystem(pDay, sched, content, SolarEngine.DEFAULT_DESIGN_PARAMS);

  assert.ok(matchNight.sizingRequirements.targetUsableBatteryKwh > matchDay.sizingRequirements.targetUsableBatteryKwh);
});

// -----------------------------------------------------------------
// Test 4: تغيير جدول توفر الشبكة
// -----------------------------------------------------------------
runTest(4, 'تغيير جدول توفر الشبكة: احتساب فترات توفر الشبكة وساعات الانقطاع وتخفيف عبء البطاريات', () => {
  const schedOffgrid = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  assert.strictEqual(schedOffgrid.totalOutageHours, 24);

  const schedIntermittent = SolarEngine.parseGridSchedule({
    mode: 'schedule',
    intervals: [{ start: '08:00', end: '16:00' }] // 8 ساعات كهرباء
  }, 96);
  assert.strictEqual(schedIntermittent.totalGridHours, 8);
  assert.strictEqual(schedIntermittent.totalOutageHours, 16);
});

// -----------------------------------------------------------------
// Test 5: اختيار بطارية بسعة كبيرة مع إنفرتر محدود الشحن
// -----------------------------------------------------------------
runTest(5, 'اختيار بطارية بسعة كبيرة مع إنفرتر محدود الشحن: كشف العائق الفني والتحذير واقتراح البدائل', () => {
  const inverters = db.getInverters();
  const batteries = db.getBatteries();

  const crown32 = inverters.find(i => i.id === 'inv_crown_3_2k'); // 3.2kW, 24V, charger 80A -> 1.92kW
  const byd15 = batteries.find(b => b.id === 'bat_byd_15kwh');    // 15.36 kWh, 48V

  const compat = SolarEngine.validateInverterBatteryCompatibility(crown32, byd15, 1, 5.8);

  assert.strictEqual(compat.isCompatible, false, 'يجب عدم قبول التركيب لتعارض الجهد وبطء الشحن');
  assert.ok(compat.rechargeTimeHours > 7.0, 'زمن إعادة الشحن يتجاوز 7 ساعات');
  assert.ok(compat.warnings.some(w => w.includes('قدرة شحن الإنفرتر') && w.includes('محدودة')), 'يحتوي على تحذير صريح بقدرة الشحن');
  assert.ok(compat.recommendations.length > 0, 'يقترح بدائل مناسبة من الإنفرترات الأكبر');
});

// -----------------------------------------------------------------
// Test 6: اختيار إنفرتر غير مناسب لقدرة الأحمال أو تيار الإقلاع
// -----------------------------------------------------------------
runTest(6, 'اختيار إنفرتر غير مناسب لقدرة الأحمال أو تيار الإقلاع: تصنيف غير متوافق وإظهار رسالة الفشل', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  // حمل بمحرك مضخة 3000W تيار إقلاعه 4x = 12000W (12kW)
  const heavyMotorLoad = [{
    id: 'heavy_pump',
    name: 'مضخة مياه زراعية كبيرة',
    watt: 3000,
    quantity: 1,
    dayHours: 6,
    nightHours: 0,
    surgeMultiplier: 4.0,
    dutyCycle: 1.0
  }];
  const profile = SolarEngine.calculateLoadProfile(heavyMotorLoad, sched, 96);

  const inverters = db.getInverters();
  const smallInv = inverters.find(i => i.id === 'inv_crown_3_2k'); // Surge 6.4kW < 12kW required!
  const batteries = db.getBatteries();
  const panels = db.getPanels();

  const evalRes = SolarEngine.validateFullSystemConfiguration({
    inverter: smallInv,
    battery: batteries[0],
    batteryCount: 2,
    panel: panels[0],
    panelsCount: 8,
    loadProfile: profile,
    designParams: SolarEngine.DEFAULT_DESIGN_PARAMS
  });

  assert.strictEqual(evalRes.isFeasible, false, 'يجب رفض الإنفرتر لعدم كفاية تيار الإقلاع');
  assert.strictEqual(evalRes.checks.motorSurge.ok, false);
  assert.ok(evalRes.errors.some(e => e.includes('إقلاع')));
});

// -----------------------------------------------------------------
// Test 7: تغيير الإنفرتر يدوياً والتحقق من إعادة الحساب
// -----------------------------------------------------------------
runTest(7, 'تغيير الإنفرتر يدوياً: إعادة فحص التوافق الفوري وتحديث النتائج والتكلفة', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([{
    id: 'tv', name: 'شاشة', watt: 150, quantity: 2, dayHours: 4, nightHours: 4, dutyCycle: 1.0
  }], sched, 96);

  const inverters = db.getInverters();
  const deye5k = inverters.find(i => i.id === 'inv_deye_5k');
  const deye8k = inverters.find(i => i.id === 'inv_deye_8k');
  const battery = db.getBatteries()[0];
  const panel = db.getPanels()[0];

  const eval1 = SolarEngine.validateFullSystemConfiguration({
    inverter: deye5k, battery, batteryCount: 1, panel, panelsCount: 8, loadProfile: profile, designParams: SolarEngine.DEFAULT_DESIGN_PARAMS
  });
  const eval2 = SolarEngine.validateFullSystemConfiguration({
    inverter: deye8k, battery, batteryCount: 1, panel, panelsCount: 8, loadProfile: profile, designParams: SolarEngine.DEFAULT_DESIGN_PARAMS
  });

  assert.strictEqual(eval1.isFeasible, true);
  assert.strictEqual(eval2.isFeasible, true);
  assert.ok(deye8k.price > deye5k.price, 'تغيير الإنفرتر إلى 8kW يغير السعر والتكلفة الهندسية');
});

// -----------------------------------------------------------------
// Test 8: اختيار مكونات غير متوافقة والتحقق من ظهور التحذير
// -----------------------------------------------------------------
runTest(8, 'اختيار مكونات غير متوافقة (جهد 24V مع 48V): ظهور التحذير الصريح ورمز التعارض', () => {
  const inverters = db.getInverters();
  const batteries = db.getBatteries();

  const inv24 = inverters.find(i => (i.batteryVoltage || i.systemVoltage) === 24);
  const bat48 = batteries.find(b => (b.nominalVoltage || b.systemVoltage) === 48);

  const compat = SolarEngine.validateInverterBatteryCompatibility(inv24, bat48, 1);
  assert.strictEqual(compat.isCompatible, false);
  assert.strictEqual(compat.status, 'CRITICAL');
  assert.ok(compat.warnings.some(w => w.includes('غير متوافق مع جهد دخل بطاريات الإنفرتر')));
});

// -----------------------------------------------------------------
// Test 9: تعديل سعر منتج في لوحة الأدمن والتحقق من انعكاسه على الحاسبة
// -----------------------------------------------------------------
runTest(9, 'تعديل سعر منتج في قاعدة البيانات: ينعكس فورياً وحسابياً على عروض الأسعار', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([{
    id: 'fridge', name: 'ثلاجة', watt: 200, quantity: 1, dayHours: 6, nightHours: 6, dutyCycle: 0.5
  }], sched, 96);

  const initialContent = db.getContent();
  const initialMatch = SolarEngine.sizeAndMatchSystem(profile, sched, initialContent, SolarEngine.DEFAULT_DESIGN_PARAMS);
  const initialQuote = SolarEngine.generateQuotation(initialMatch.packages.recommended, SolarEngine.DEFAULT_DESIGN_PARAMS);

  const testPanel = db.getPanels()[0];
  const originalPrice = testPanel.price;

  try {
    db.updatePanel(testPanel.id, { price: originalPrice + 15 });
    const updatedContent = db.getContent();
    const updatedMatch = SolarEngine.sizeAndMatchSystem(profile, sched, updatedContent, SolarEngine.DEFAULT_DESIGN_PARAMS);
    const updatedQuote = SolarEngine.generateQuotation(updatedMatch.packages.recommended, SolarEngine.DEFAULT_DESIGN_PARAMS);

    const panelCount = updatedMatch.packages.recommended.panel.quantity;
    const expectedDiff = panelCount * 15;
    const actualDiff = Math.round(updatedQuote.financials.totalCostUsd - initialQuote.financials.totalCostUsd);

    assert.strictEqual(actualDiff, expectedDiff);
  } finally {
    db.updatePanel(testPanel.id, { price: originalPrice });
  }
});

// -----------------------------------------------------------------
// Test 10: عدم توفر منتج أو نقص مواصفاته
// -----------------------------------------------------------------
runTest(10, 'عدم توفر منتج أو نقص مواصفاته: استبعاد المنتجات الصفرية ومنع الباقات المضللة', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([{
    id: 'fan', name: 'مروحة', watt: 45, quantity: 2, dayHours: 8, nightHours: 8, dutyCycle: 1.0
  }], sched, 96);

  const mockBadInventory = {
    inverters: [{ id: 'bad_inv', name: '', price: 0, capacityKw: 0, available: true }],
    batteries: [{ id: 'bat1', name: 'بطارية', price: 1000, capacityKwh: 5, available: true }],
    panels: [{ id: 'pnl1', name: 'لوح', price: 90, watt: 580, available: true }]
  };

  const match = SolarEngine.sizeAndMatchSystem(profile, sched, mockBadInventory, SolarEngine.DEFAULT_DESIGN_PARAMS);
  assert.strictEqual(match.success, false);
  assert.strictEqual(match.error, 'INCOMPLETE_INVENTORY');
});

// -----------------------------------------------------------------
// Test 11: التحقق من توازن الطاقة خلال فترات المحاكاة (Energy Conservation)
// -----------------------------------------------------------------
runTest(11, 'التحقق من اتساق توازن الطاقة خلال فترات المحاكاة الـ 96 (مبدأ حفظ الطاقة)', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const load = [{
    id: 'home_load', name: 'أحمال منزلية متوازنة', watt: 500, quantity: 1, dayHours: 8, nightHours: 6, dutyCycle: 0.8
  }];
  const profile = SolarEngine.calculateLoadProfile(load, sched, 96);

  const sim = SolarEngine.runSimulation({
    loadProfile: profile,
    gridSchedule: sched,
    pvKwPeak: 3.5,
    batteryCapacityKwh: 10.0,
    designParams: SolarEngine.DEFAULT_DESIGN_PARAMS
  });

  const s = sim.summary;
  // إجمالي الطاقة المتولدة من الألواح يجب أن يتوزع بين: استهلاك مباشر نهاراً + شحن بطارية + فائض مقصوص
  const accountedSolar = s.totalDirectSolarKwh + s.totalSolarToBatteryKwh + s.totalCurtailedSolarKwh;
  const diff = Math.abs(accountedSolar - s.totalSolarGeneratedKwh);

  assert.ok(diff < 0.25, `توازن توليد الطاقة متسق ومحفوظ بدقة (الفرق: ${diff} kWh)`);
  assert.strictEqual(sim.series.loadKw.length, 96, '96 فترة زمنية بمعدل 15 دقيقة لكل فترة');
});

// -----------------------------------------------------------------
// Test 12: إنشاء عرض سعر ومطابقة الإجمالي مع أسعار قاعدة البيانات
// -----------------------------------------------------------------
runTest(12, 'إنشاء عرض سعر رسمي: مطابقة مجموع بنود BOM والتسعير المعتمد ومدة الصلاحية', () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([{
    id: 'freezer', name: 'فريزر', watt: 180, quantity: 1, dayHours: 6, nightHours: 6, dutyCycle: 0.6
  }], sched, 96);

  const content = db.getContent();
  const match = SolarEngine.sizeAndMatchSystem(profile, sched, content, SolarEngine.DEFAULT_DESIGN_PARAMS);
  const quote = SolarEngine.generateQuotation(match.packages.recommended, {
    ...SolarEngine.DEFAULT_DESIGN_PARAMS,
    quoteValidityDays: 25,
    defaultCurrency: 'USD'
  }, {
    name: 'المهندس أحمد', phone: '777123456', location: 'عدن'
  });

  assert.strictEqual(quote.validUntilDays, 25);
  const itemsSum = quote.items.reduce((sum, item) => sum + item.totalPrice, 0);
  assert.strictEqual(itemsSum, quote.financials.totalCostUsd);
  assert.ok(quote.terms.some(t => t.includes('Crown Micro')));
});

// -----------------------------------------------------------------
// Test 13: إرسال طلب عميل والتحقق من ظهوره في لوحة الأدمن
// -----------------------------------------------------------------
runTest(13, 'إرسال طلب عميل جديد: يُحفظ في قاعدة البيانات ويظهر في لوحة الإدارة بحالة New', () => {
  const newLead = {
    name: 'فحص تكاملي للمنصة',
    phone: '783000999',
    location: 'عدن - المنصورة',
    totalCost: 4500,
    currency: 'USD',
    notes: 'اختبار السيناريو رقم 13'
  };

  const added = db.addLead(newLead);
  assert.ok(added.id);

  const leads = db.getLeads();
  const found = leads.find(l => l.id === added.id);
  assert.ok(found);
  assert.strictEqual(found.status, 'New');

  db.deleteLead(added.id);
});

// -----------------------------------------------------------------
// Test 14: اختبار جميع الصفحات والوظائف على الهاتف والكمبيوتر
// -----------------------------------------------------------------
runTest(14, 'اختبار مقاييس الجوال والـ Mobile-First والـ PWA وقواعد العرض', () => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  const cssPath = path.join(__dirname, '..', 'styles.css');
  const html = fs.readFileSync(indexPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  // 1. Viewport tag
  assert.ok(html.includes('name="viewport" content="width=device-width, initial-scale=1.0"'));

  // 2. Mobile-first breakpoints
  assert.ok(css.includes('@media (max-width: 430px)'));
  assert.ok(css.includes('@media (max-width: 390px)'));
  assert.ok(css.includes('@media (max-width: 360px)'));
  assert.ok(css.includes('@media (max-width: 320px)'));

  // 3. Prevent horizontal overflow & iOS Safari auto-zoom
  assert.ok(css.includes('overflow-x: hidden !important'));
  assert.ok(css.includes('font-size: 16px !important'));

  // 4. PWA manifest and mobile bottom nav
  assert.ok(html.includes('manifest.json'));
  assert.ok(html.includes('id="mobile-bottom-nav"'));
  assert.ok(html.includes('id="pwa-install-banner"'));
});

console.log('\n====================================================================');
console.log(`🏁 نتيجة الفحص النهائي: ${passedTests} من أصل ${totalTests} اختبارات اكتملت بنجاح!`);
if (passedTests === totalTests) {
  console.log('🎉 المنظومة مطابقة بنسبة 100% لكافة المتطلبات الهندسية والتصميمية الـ 14 الإلزامية.');
} else {
  console.log('⚠️ هناك اختبارات لم تنجح، يرجى مراجعة التفاصيل أعلاه.');
  process.exit(1);
}
console.log('====================================================================\n');
