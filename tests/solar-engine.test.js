/**
 * Automated Test Suite for Petronil Yemen Solar Engine
 * يتحقق من كافة الحالات الهندسية وحالات الحافة
 */

const assert = require('assert');
const path = require('path');
const SolarEngine = require('../engine/solar-engine');

console.log("=================================================");
console.log("🚀 تشغيل الاختبارات الآلية لمحرك الحسابات الشمسية");
console.log("=================================================\n");

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ نجح: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ فشل: ${name}`);
    console.error(err);
  }
}

// ----------------------------------------------------
// 1. اختبار جدول توفر كهرباء الشبكة
// ----------------------------------------------------
test("1.1 جدول الشبكة - الوضع المعزول تماماً (Off-grid)", () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  assert.strictEqual(sched.steps.length, 96);
  assert.strictEqual(sched.totalGridHours, 0);
  assert.strictEqual(sched.totalOutageHours, 24);
  assert.strictEqual(sched.steps.every(s => s === false), true);
});

test("1.2 جدول الشبكة - فترة زمنية عادية (08:00 إلى 12:00)", () => {
  const sched = SolarEngine.parseGridSchedule({
    mode: 'schedule',
    intervals: [{ start: "08:00", end: "12:00" }]
  }, 96);
  assert.strictEqual(sched.totalGridHours, 4);
  assert.strictEqual(sched.totalOutageHours, 20);
  // الخطوة عند الساعة 10:00 (10 / 0.25 = 40) يجب أن تكون متوفرة
  assert.strictEqual(sched.steps[40], true);
  // الخطوة عند الساعة 14:00 (14 / 0.25 = 56) يجب أن تكون مقطوعة
  assert.strictEqual(sched.steps[56], false);
});

test("1.3 جدول الشبكة - فترة تعبر منتصف الليل (22:00 إلى 04:00)", () => {
  const sched = SolarEngine.parseGridSchedule({
    mode: 'schedule',
    intervals: [{ start: "22:00", end: "04:00" }]
  }, 96);
  assert.strictEqual(sched.totalGridHours, 6);
  // الساعة 23:00 (23 / 0.25 = 92) متوفرة
  assert.strictEqual(sched.steps[92], true);
  // الساعة 02:00 (2 / 0.25 = 8) متوفرة
  assert.strictEqual(sched.steps[8], true);
  // الساعة 12:00 (12 / 0.25 = 48) مقطوعة
  assert.strictEqual(sched.steps[48], false);
});

test("1.4 جدول الشبكة - أسوأ مدة انقطاع متواصلة (Irregular Worst Outage)", () => {
  const sched = SolarEngine.parseGridSchedule({
    mode: 'irregular',
    worstOutageHours: 16
  }, 96);
  assert.strictEqual(sched.totalOutageHours, 16);
  assert.strictEqual(sched.totalGridHours, 8);
  assert.strictEqual(sched.maxContiguousOutageHours >= 16, true);
});

// ----------------------------------------------------
// 2. اختبار ملف الأحمال ومعاملات القدرة والإقلاع
// ----------------------------------------------------
test("2.1 حساب استهلاك حمل مقاومي وإلكتروني", () => {
  const appliances = [
    { id: "tv", name: "شاشة", watt: 100, quantity: 1, dayHours: 4, nightHours: 4, powerFactor: 0.95, dutyCycle: 1.0, surgeMultiplier: 1.0 }
  ];
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile(appliances, sched, 96);

  // 100W * 8h = 0.8 kWh
  assert.strictEqual(profile.totalDailyKwh, 0.8);
  assert.strictEqual(profile.peakContinuousKw, 0.1);
  assert.strictEqual(profile.maxSurgeKw, 0.1);
});

test("2.2 حساب إقلاع محرك (مكيف / مضخة) ومعدل التشغيل الدوري Duty Cycle", () => {
  const appliances = [
    { id: "ac", name: "مكيف سبليت", watt: 1500, quantity: 1, dayHours: 6, nightHours: 0, powerFactor: 0.85, dutyCycle: 0.7, surgeMultiplier: 3.5 }
  ];
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile(appliances, sched, 96);

  // الطاقة = 1.5kW * 0.7 * 6h = 6.3 kWh
  assert.strictEqual(profile.totalDailyKwh, 6.3);
  // القدرة المستمرة = 1.5kW * 0.7 = 1.05 kW
  assert.strictEqual(profile.peakContinuousKw, 1.05);
  // قدرة الإقلاع = 1.05kW مستمرة + (1.5 * 3.5 - 1.05) = 5.25 kW
  assert.strictEqual(profile.maxSurgeKw, 5.25);
  // القدرة الظاهرية kVA = 1.05 / 0.85 = 1.24 kVA
  assert.strictEqual(profile.peakContinuousKva, 1.24);
});

// ----------------------------------------------------
// 3. اختبار منحنى التوليد الشمسي
// ----------------------------------------------------
test("3.1 منحنى التوليد الشمسي يحقق ساعات الذروة PSH ويصفر ليلاً", () => {
  const pvKw = 5.0;
  const psh = 5.8;
  const derating = 0.78;
  const curve = SolarEngine.generateSolarCurve(pvKw, psh, derating, 96);

  // الطاقة المتوقعة = 5.0 * 5.8 * 0.78 = 22.62 kWh
  const expectedKwh = pvKw * psh * derating;
  assert.strictEqual(Math.abs(curve.totalDailyKwh - expectedKwh) < 0.2, true);

  // التأكد أن الإنتاج صفر قبل 06:00 (step 0..23) وبعد 18:00 (step 72..95)
  assert.strictEqual(curve.steps[0], 0);
  assert.strictEqual(curve.steps[10], 0);
  assert.strictEqual(curve.steps[80], 0);
  // ذروة التوليد عند الظهيرة (step 48 = 12:00)
  assert.strictEqual(curve.steps[48] > 0, true);
});

// ----------------------------------------------------
// 4. اختبار محاكاة 24 ساعة (Time-Step Simulation)
// ----------------------------------------------------
test("4.1 محاكاة انقطاع وتفريغ البطارية مع العجز عند النفاد", () => {
  const appliances = [
    { id: "load", name: "حمل مستمر", watt: 1000, quantity: 1, dayHours: 12, nightHours: 12, dutyCycle: 1.0, powerFactor: 1.0 }
  ];
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile(appliances, sched, 96);

  // بطارية صغيرة 2.4kWh مع حمولة 1000W مستمرة وبدون شمس (pv = 0)
  const sim = SolarEngine.runSimulation({
    loadProfile: profile,
    gridSchedule: sched,
    pvKwPeak: 0,
    batteryCapacityKwh: 2.4,
    batteryDod: 0.8,
    initialSoC: 1.0, // بطارية ممتلئة في البداية
    inverterRatedKw: 3.0
  });

  // يجب أن تفرغ البطارية ويحدث عجز غير مغطى Unserved Energy
  assert.strictEqual(sim.summary.totalBatteryDischargedKwh > 0, true);
  assert.strictEqual(sim.summary.totalUnservedEnergyKwh > 0, true);
  assert.strictEqual(sim.summary.batteryFullDepletionsCount > 0, true);
});

test("4.2 محاكاة فائض شمسي وشحن كامل للبطارية وفوائض مهدرة", () => {
  const appliances = [
    { id: "load", name: "حمل خفيف", watt: 200, quantity: 1, dayHours: 12, nightHours: 0, dutyCycle: 1.0, powerFactor: 1.0 }
  ];
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile(appliances, sched, 96);

  // شمس قوية 10kWp مع بطارية 5kWh
  const sim = SolarEngine.runSimulation({
    loadProfile: profile,
    gridSchedule: sched,
    pvKwPeak: 10.0,
    batteryCapacityKwh: 5.0,
    batteryDod: 0.9,
    initialSoC: 0.2,
    inverterRatedKw: 5.0
  });

  assert.strictEqual(sim.summary.totalSolarToBatteryKwh > 0, true);
  assert.strictEqual(sim.summary.totalCurtailedSolarKwh > 0, true);
  assert.strictEqual(sim.summary.totalUnservedEnergyKwh, 0);
  assert.strictEqual(sim.summary.solarCoveragePercent, 100);
});

// ----------------------------------------------------
// 5. اختبار الحسابات الكهربائية وسلاسل الألواح MPPT
// ----------------------------------------------------
test("5.1 حساب Voc Cold و Vmp Hot وقيود سلاسل الألواح", () => {
  const panel = {
    name: "Jinko 610W",
    watt: 610,
    voc: 56.0,
    vmp: 47.0,
    tempCoefficientVoc: -0.0026
  };
  const inverter = {
    capacityKw: 6.0,
    mpptMin: 120,
    mpptMax: 450,
    maxVocInput: 500,
    mpptTrackers: 2
  };

  const stringing = SolarEngine.calculateElectricalStringing(panel, inverter, 6.0);

  // Voc Cold عند 15C (فارق -10 درجات عن 25C)
  // Voc(15) = 56 * (1 + (-0.0026 * -10)) = 56 * 1.026 = 57.45V
  assert.strictEqual(stringing.vocCold > 56.0, true);
  // أقصى عدد ألواح في السلسلة = floor(500 / 57.45) = 8 ألواح
  assert.strictEqual(stringing.maxPanelsSeries <= 8, true);
  assert.strictEqual(stringing.isMpptFeasible, true);
  assert.strictEqual(stringing.withinLimits, true);
});

// ----------------------------------------------------
// 6. اختبار مطابقة المنظومة وتوليد الباقات الثلاث
// ----------------------------------------------------
test("6.1 مطابقة المنظومة وتوليد الباقات (Recommended, Economic, HighPerformance)", () => {
  const sampleInventory = {
    inverters: [
      { id: "inv_35", name: "Deye 3.6kW", capacityKw: 3.6, price: 550, available: true },
      { id: "inv_50", name: "Deye 5kW", capacityKw: 5.0, price: 800, available: true },
      { id: "inv_80", name: "Deye 8kW", capacityKw: 8.0, price: 1250, available: true }
    ],
    batteries: [
      { id: "bat_5", name: "Narada 5.12kWh", capacityKwh: 5.12, dod: 0.90, price: 1150, available: true, chemistry: "LiFePO4" },
      { id: "bat_10", name: "BYD 10.24kWh", capacityKwh: 10.24, dod: 0.90, price: 2100, available: true, chemistry: "LiFePO4" }
    ],
    panels: [
      { id: "pan_610", name: "Jinko 610W", watt: 610, voc: 56.0, vmp: 47.0, price: 110, available: true }
    ]
  };

  const appliances = [
    { id: "ac", name: "مكيف", watt: 1500, quantity: 1, dayHours: 5, nightHours: 2, powerFactor: 0.9, dutyCycle: 0.7, surgeMultiplier: 3.0 },
    { id: "fridge", name: "ثلاجة", watt: 200, quantity: 1, dayHours: 12, nightHours: 12, powerFactor: 0.85, dutyCycle: 0.5, surgeMultiplier: 4.0 },
    { id: "lighting", name: "إنارة", watt: 100, quantity: 1, dayHours: 2, nightHours: 6, powerFactor: 0.95, dutyCycle: 1.0, surgeMultiplier: 1.0 }
  ];

  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile(appliances, sched, 96);
  const matchResult = SolarEngine.sizeAndMatchSystem(profile, sched, sampleInventory);

  assert.strictEqual(matchResult.packages.recommended !== undefined, true);
  assert.strictEqual(matchResult.packages.economic !== undefined, true);
  assert.strictEqual(matchResult.packages.highPerformance !== undefined, true);

  // التحقق من أن إنفرتر الباقة الموصى بها يغطي أمان الحمل المستمر
  const recPkg = matchResult.packages.recommended;
  assert.strictEqual(recPkg.inverter.capacityKw >= profile.peakContinuousKw, true);
  assert.strictEqual(recPkg.battery.usableKwh > 0, true);
  assert.strictEqual(recPkg.panel.totalKw > 0, true);
});

// ----------------------------------------------------
// 7. اختبار مولد عرض السعر وجدول الكميات BOM
// ----------------------------------------------------
test("7.1 إنشاء عرض السعر مع الحماية والهياكل والضمانات", () => {
  const pkg = {
    title: "الباقة الموصى بها",
    inverter: { name: "Deye 5kW", capacityKw: 5.0, price: 800, totalCost: 800, quantity: 1 },
    battery: { name: "Narada 5.12kWh", capacityKwh: 5.12, usableKwh: 4.6, price: 1150, totalCost: 1150, totalKwh: 5.12, quantity: 1 },
    panel: { name: "Jinko 610W", watt: 610, price: 110, totalCost: 880, totalKw: 4.88, quantity: 8 }
  };

  const quotation = SolarEngine.generateQuotation(pkg, SolarEngine.DEFAULT_DESIGN_PARAMS, {
    name: "م. محمد اليمني",
    phone: "777123456"
  });

  assert.strictEqual(quotation.items.length >= 6, true);
  assert.strictEqual(quotation.financials.totalCostUsd > (800 + 1150 + 880), true); // يشمل الملحقات والتركيب
  assert.strictEqual(quotation.financials.totalCostYer, quotation.financials.totalCostUsd * 535);
  assert.strictEqual(quotation.company.name, "بترونيل يمن للطاقة");
  assert.strictEqual(quotation.customer.name, "م. محمد اليمني");
});

// ----------------------------------------------------
// 8. اختبارات الحالات الحدية والفصل بين الاستطاعة والطاقة (Edge Cases)
// ----------------------------------------------------
test("8.1 الحسابات الحدية: قائمة أجهزة فارغة (0 أجهزة) لا تنهار وتعيد قيماً صفرية سليمة", () => {
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile([], sched, 96);
  assert.strictEqual(profile.totalDailyKwh, 0);
  assert.strictEqual(profile.peakContinuousKw, 0);
  assert.strictEqual(profile.maxSurgeKw, 0);

  const inventory = {
    inverters: [{ id: "i1", capacityKw: 3.6, price: 500, available: true }],
    batteries: [{ id: "b1", capacityKwh: 5.12, dod: 0.9, price: 1000, available: true }],
    panels: [{ id: "p1", watt: 580, price: 100, voc: 52, vmp: 44, available: true }]
  };
  const matched = SolarEngine.sizeAndMatchSystem(profile, sched, inventory);
  assert.strictEqual(matched.success, false);
  assert.strictEqual(matched.error, 'NO_LOADS');
  assert.strictEqual(matched.packages, null);
});

test("8.2 الدقة الحسابية: الفصل التام بين الاستطاعة (W/kW) والطاقة اليومية والأسبوعية والشهرية", () => {
  const appliances = [
    { id: "heater", name: "سخان مياه", watt: 2000, quantity: 2, dayHours: 3, nightHours: 0, dutyCycle: 1.0, powerFactor: 1.0, surgeMultiplier: 1.0 }
  ];
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile(appliances, sched, 96);

  // إجمالي الاستطاعة المركبة = 2 * 2000W = 4000W (4.0 kW)
  let installedWatts = 0;
  appliances.forEach(a => installedWatts += a.watt * a.quantity);
  assert.strictEqual(installedWatts, 4000);
  assert.strictEqual(installedWatts / 1000, 4.0);

  // الطاقة اليومية = 4.0 kW * 3h = 12.0 kWh/يوم
  assert.strictEqual(profile.totalDailyKwh, 12.0);

  // الطاقة الأسبوعية = 12.0 * 7 = 84.0 kWh/أسبوع
  const weeklyKwh = profile.totalDailyKwh * 7;
  assert.strictEqual(weeklyKwh, 84.0);

  // الطاقة الشهرية = 12.0 * 30 = 360.0 kWh/شهر
  const monthlyKwh = profile.totalDailyKwh * 30;
  assert.strictEqual(monthlyKwh, 360.0);
});

test("8.3 الأحمال الحثية وتيار الإقلاع (Surge Inrush) مع معامل القدرة kVA vs kW", () => {
  const appliances = [
    { id: "heavy_pump", name: "مضخة غاطسة 3 حصان", watt: 2200, quantity: 1, dayHours: 2, nightHours: 0, dutyCycle: 1.0, powerFactor: 0.75, surgeMultiplier: 5.0 }
  ];
  const sched = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profile = SolarEngine.calculateLoadProfile(appliances, sched, 96);

  // الاستطاعة الفعلية = 2.2 kW
  assert.strictEqual(profile.peakContinuousKw, 2.2);
  // الاستطاعة الظاهرية kVA = 2.2 / 0.75 = 2.93 kVA
  assert.strictEqual(profile.peakContinuousKva, 2.93);
  // أقصى تيار وقدرة إقلاع لحظية = 2.2 * 5.0 = 11.0 kW
  assert.strictEqual(profile.maxSurgeKw, 11.0);
});

test("8.4 حساسية جدول انقطاع الشبكة وتأثيره على سعة البطارية", () => {
  const appliances = [
    { id: "load", name: "حمل مستمر", watt: 500, quantity: 1, dayHours: 12, nightHours: 12, dutyCycle: 1.0, powerFactor: 1.0 }
  ];
  // سيناريو أ: شبكة متوفرة 18 ساعة (انقطاع 6 ساعات)
  const schedLight = SolarEngine.parseGridSchedule({ mode: 'dailyHours', dailyHours: 18 }, 96);
  const profileLight = SolarEngine.calculateLoadProfile(appliances, schedLight, 96);

  // سيناريو ب: نظام معزول تماماً (انقطاع 24 ساعة)
  const schedOffgrid = SolarEngine.parseGridSchedule({ mode: 'offgrid' }, 96);
  const profileOffgrid = SolarEngine.calculateLoadProfile(appliances, schedOffgrid, 96);

  assert.strictEqual(profileLight.totalOutageKwh < profileOffgrid.totalOutageKwh, true);
  // الطاقة أثناء الانقطاع لـ 6 ساعات = 0.5kW * 6h = 3.0 kWh
  assert.strictEqual(profileLight.totalOutageKwh, 3.0);
  // الطاقة أثناء الانقطاع في النظام المعزول = 12.0 kWh
  assert.strictEqual(profileOffgrid.totalOutageKwh, 12.0);
});

console.log("\n=================================================");
console.log(`📊 النتيجة النهائية: ${passedTests} من أصل ${totalTests} اختبارات ناجحة`);
console.log("=================================================");

if (passedTests === totalTests) {
  console.log("🎉 جميع الاختبارات اجتازت بنجاح 100%!");
  process.exit(0);
} else {
  console.error("⚠️ فشل في بعض الاختبارات، يرجى المراجعة.");
  process.exit(1);
}
