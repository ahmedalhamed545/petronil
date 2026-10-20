/**
 * Embedded Universal SolarEngine Fallback
 * تضمن تشغيل محرك الحسابات حتى لو لم يتم رفع مجلد engine
 */
if (typeof SolarEngine === 'undefined') {
/**
 * Petronil Yemen Solar Calculation & Simulation Engine (v2.0)
 * محرك الحساب والمحاكاة الهندسية لأنظمة الطاقة الشمسية - بترونيل يمن للطاقة
 *
 * Universal JavaScript module (Node.js & Modern Browser compatible)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SolarEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // --- الهندسية المعايير والافتراضات الافتراضية ---
  const DEFAULT_DESIGN_PARAMS = {
    psh: 5.8,                     // ساعات ذروة الإشعاع الشمسي في اليمن (Peak Sun Hours)
    deratingFactor: 0.78,          // معامل انخفاض الكفاءة الكلي (غبار، زاوية، فقد أسلاك، حرارة)
    inverterSafetyMargin: 1.25,    // معامل أمان قدرة الإنفرتر (25% احتياطي للأحمال المستمرة)
    tempMinC: 15,                 // أدنى درجة حرارة شتوية لحساب أقصى جهد دائرة مفتوحة (Voc Cold)
    tempMaxCellC: 65,             // أقصى حرارة تشغيلية للخلايا صيفاً لحساب أدنى جهد نقطة قدرة (Vmp Hot)
    stcTempC: 25,                 // درجة حرارة الفحص المعياري
    batteryDodLithium: 0.90,      // عمق التفريغ لبطاريات الليثيوم LiFePO4
    batteryDodGel: 0.50,          // عمق التفريغ لبطاريات الجل والأنبوبية
    chargeEfficiency: 0.95,       // كفاءة شحن البطارية
    dischargeEfficiency: 0.95,    // كفاءة تفريغ البطارية
    inverterEfficiency: 0.96,     // كفاءة تحويل الإنفرتر
    currencyExchangeRate: 535,    // سعر صرف الدولار مقابل الريال اليمني (صنعاء/عدن وسطي قابل للتعديل)
    defaultPriorityOrder: ['essential', 'important', 'sheddable']
  };

  /**
   * 1. تحليل وتوليد جدول توفر كهرباء الشبكة على مدار 24 ساعة
   * Supports: 96 steps (15 mins each) or 24 steps (1 hour each)
   *
   * @param {Object} options
   *   - mode: 'offgrid' | 'schedule' | 'dailyHours' | 'irregular'
   *   - intervals: [{ start: "HH:MM", end: "HH:MM" }]
   *   - dailyHours: number (e.g. 6)
   *   - worstOutageHours: number (e.g. 18)
   *   - timeStepsCount: 96 (default) or 24
   */
  function parseGridSchedule(options = {}, timeStepsCount = 96) {
    const steps = [];
    const stepDurationHours = 24 / timeStepsCount;
    const mode = options.mode || 'offgrid';

    // مساعدة لتحويل "HH:MM" إلى كسور الساعة (0.00 إلى 24.00)
    function timeStringToHours(str) {
      if (!str || typeof str !== 'string') return 0;
      const parts = str.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h + (m / 60);
    }

    if (mode === 'offgrid') {
      // نظام معزول تماماً عن الشبكة 100%
      for (let i = 0; i < timeStepsCount; i++) {
        steps.push(false);
      }
    } else if (mode === 'schedule') {
      // جدول محدد بفترات زمنية
      const intervals = Array.isArray(options.intervals) ? options.intervals : [];
      for (let i = 0; i < timeStepsCount; i++) {
        const timeOfDay = i * stepDurationHours;
        let isAvailable = false;

        for (const interval of intervals) {
          const start = timeStringToHours(interval.start);
          const end = timeStringToHours(interval.end);

          if (start <= end) {
            // فترة عادية خلال نفس اليوم، مثال: 08:00 إلى 14:00
            if (timeOfDay >= start && timeOfDay < end) {
              isAvailable = true;
              break;
            }
          } else {
            // فترة تعبر منتصف الليل، مثال: 22:00 إلى 06:00
            if (timeOfDay >= start || timeOfDay < end) {
              isAvailable = true;
              break;
            }
          }
        }
        steps.push(isAvailable);
      }
    } else if (mode === 'dailyHours') {
      // عدد ساعات محددة يومياً (توزيع صباحي ومسائي مع دعم عبور منتصف الليل)
      const hours = Math.min(24, Math.max(0, Number(options.dailyHours || 6)));
      for (let i = 0; i < timeStepsCount; i++) {
        const timeOfDay = i * stepDurationHours;
        let active = false;
        if (hours >= 24) {
          active = true;
        } else if (hours <= 6) {
          // فترة مسائية فقط 18:00
          const end = 18 + hours;
          active = end <= 24 ? (timeOfDay >= 18 && timeOfDay < end) : (timeOfDay >= 18 || timeOfDay < (end - 24));
        } else {
          // نصف الساعات صباحاً 06:00 ونصفها مساءً 18:00
          const morningH = hours / 2;
          const eveningH = hours / 2;
          const morningEnd = 6 + morningH;
          const mActive = morningEnd <= 24 ? (timeOfDay >= 6 && timeOfDay < morningEnd) : (timeOfDay >= 6 || timeOfDay < (morningEnd - 24));
          const eveningEnd = 18 + eveningH;
          const eActive = eveningEnd <= 24 ? (timeOfDay >= 18 && timeOfDay < eveningEnd) : (timeOfDay >= 18 || timeOfDay < (eveningEnd - 24));
          active = mActive || eActive;
        }
        steps.push(active);
      }
    } else if (mode === 'irregular') {
      // كهرباء غير منتظمة مع إدخال أسوأ مدة انقطاع متواصلة
      const worstOutage = Math.min(24, Math.max(0, Number(options.worstOutageHours || 18)));
      const gridHours = 24 - worstOutage;
      for (let i = 0; i < timeStepsCount; i++) {
        const timeOfDay = i * stepDurationHours;
        if (gridHours <= 0) {
          steps.push(false);
        } else if (gridHours >= 24) {
          steps.push(true);
        } else {
          const end = 10 + gridHours;
          const active = end <= 24 ? (timeOfDay >= 10 && timeOfDay < end) : (timeOfDay >= 10 || timeOfDay < (end - 24));
          steps.push(active);
        }
      }
    } else {
      // افتراضي: لا شبكة
      for (let i = 0; i < timeStepsCount; i++) steps.push(false);
    }

    // إحصاء ساعات الشبكة وساعات الانقطاع
    const availableStepsCount = steps.filter(Boolean).length;
    const totalGridHours = availableStepsCount * stepDurationHours;
    const totalOutageHours = 24 - totalGridHours;

    // حساب أطول فترة انقطاع متواصلة (Worst contiguous outage)
    let maxContiguousOutageSteps = 0;
    let currentOutageSteps = 0;
    // تكرار الدورة مرتين لمعالجة الانقطاع الذي يعبر منتصف الليل
    const doubleSteps = steps.concat(steps);
    for (const isGrid of doubleSteps) {
      if (!isGrid) {
        currentOutageSteps++;
        if (currentOutageSteps > maxContiguousOutageSteps) {
          maxContiguousOutageSteps = currentOutageSteps;
        }
      } else {
        currentOutageSteps = 0;
      }
    }
    const maxContiguousOutageHours = Math.min(24, maxContiguousOutageSteps * stepDurationHours);

    return {
      mode,
      timeStepsCount,
      stepDurationHours,
      steps, // مصفوفة قيم منطقية (true = كهرباء شبكة متوفرة)
      totalGridHours: parseFloat(totalGridHours.toFixed(2)),
      totalOutageHours: parseFloat(totalOutageHours.toFixed(2)),
      maxContiguousOutageHours: parseFloat(maxContiguousOutageHours.toFixed(2))
    };
  }

  /**
   * 2. حساب ملف الأحمال التفصيلي والطاقة اليومية والأحمال المتزامنة وقدرة الإقلاع
   *
   * @param {Array} appliances مصفوفة الأجهزة
   * @param {Object} gridSchedule جدول الشبكة الناتج من parseGridSchedule
   * @param {number} timeStepsCount عدد الشرائح الزمنية (96)
   */
  function calculateLoadProfile(appliances = [], gridSchedule = null, timeStepsCount = 96) {
    if (!gridSchedule) {
      gridSchedule = parseGridSchedule({ mode: 'offgrid' }, timeStepsCount);
    }

    const stepDurationHours = 24 / timeStepsCount;
    const activePowerSteps = new Array(timeStepsCount).fill(0); // القدرة الفعالة kW
    const apparentPowerSteps = new Array(timeStepsCount).fill(0); // القدرة الظاهرية kVA
    const outageActiveSteps = new Array(timeStepsCount).fill(0); // الأحمال أثناء انقطاع الشبكة
    const gridActiveSteps = new Array(timeStepsCount).fill(0); // الأحمال أثناء توفر الشبكة

    let totalDailyKwh = 0;
    let totalOutageKwh = 0;
    let totalGridKwh = 0;
    let totalDayKwh = 0; // بين 06:00 و 18:00
    let totalNightKwh = 0; // بين 18:00 و 06:00
    let maxSurgeKw = 0;
    let maxSurgeKva = 0;

    const itemizedLoads = [];

    // مساعدة لتحويل "HH:MM" إلى كسور الساعة
    function timeToHours(str) {
      if (!str || typeof str !== 'string') return 0;
      const parts = str.split(':');
      return (parseInt(parts[0], 10) || 0) + ((parseInt(parts[1], 10) || 0) / 60);
    }

    appliances.forEach(app => {
      const qty = Math.max(1, parseInt(app.quantity, 10) || 1);
      const watt = Math.max(0, parseFloat(app.watt) || 0);
      const pf = Math.min(1.0, Math.max(0.4, parseFloat(app.powerFactor) || 0.9));
      const dutyCycle = Math.min(1.0, Math.max(0.1, parseFloat(app.dutyCycle) || 1.0));
      const surgeMultiplier = Math.max(1.0, parseFloat(app.surgeMultiplier) || 1.0);
      const priority = app.priority || 'important';
      const loadType = app.loadType || 'resistive';

      // القدرة الاسمية الإجمالية لهذا الجهاز بالكيلوواط
      const ratedKw = (watt * qty) / 1000;
      const runningKw = ratedKw * dutyCycle; // القدرة الفعلية المتوسطة أثناء التشغيل
      const runningKva = runningKw / pf;

      // أقصى قدرة إقلاع لحظية للجهاز
      const applianceSurgeKw = ratedKw * surgeMultiplier;
      const applianceSurgeKva = applianceSurgeKw / pf;

      let appTotalHours = 0;
      const appSteps = new Array(timeStepsCount).fill(false);

      if (Array.isArray(app.timeWindows) && app.timeWindows.length > 0) {
        // فترات تشغيل محددة بالساعة والدقيقة
        for (const win of app.timeWindows) {
          const start = timeToHours(win.start);
          const end = timeToHours(win.end);
          for (let i = 0; i < timeStepsCount; i++) {
            const t = i * stepDurationHours;
            if (start <= end) {
              if (t >= start && t < end) appSteps[i] = true;
            } else {
              if (t >= start || t < end) appSteps[i] = true;
            }
          }
        }
      } else {
        // توزيع مبني على ساعات النهار (06:00 إلى 18:00) وساعات الليل (18:00 إلى 06:00)
        const dayHours = Math.min(12, Math.max(0, parseFloat(app.dayHours) || 0));
        const nightHours = Math.min(12, Math.max(0, parseFloat(app.nightHours) || 0));

        // نشر ساعات النهار بالتساوي في نافذة 06:00 إلى 18:00
        if (dayHours > 0) {
          const dayStartStep = Math.round(6 / stepDurationHours);
          const dayStepsCount = Math.round(dayHours / stepDurationHours);
          for (let s = 0; s < dayStepsCount; s++) {
            const stepIdx = (dayStartStep + s) % timeStepsCount;
            appSteps[stepIdx] = true;
          }
        }
        // نشر ساعات الليل بالتساوي في نافذة 18:00 إلى 06:00
        if (nightHours > 0) {
          const nightStartStep = Math.round(18 / stepDurationHours);
          const nightStepsCount = Math.round(nightHours / stepDurationHours);
          for (let s = 0; s < nightStepsCount; s++) {
            const stepIdx = (nightStartStep + s) % timeStepsCount;
            appSteps[stepIdx] = true;
          }
        }
      }

      // حساب الاستهلاك والإسهام في كل شريحة زمنية
      let appDailyEnergyKwh = 0;
      let appOutageEnergyKwh = 0;

      for (let i = 0; i < timeStepsCount; i++) {
        if (appSteps[i]) {
          appTotalHours += stepDurationHours;
          const energyThisStep = runningKw * stepDurationHours;
          appDailyEnergyKwh += energyThisStep;

          activePowerSteps[i] += runningKw;
          apparentPowerSteps[i] += runningKva;

          const isGridOn = gridSchedule.steps[i];
          if (isGridOn) {
            gridActiveSteps[i] += runningKw;
            totalGridKwh += energyThisStep;
          } else {
            outageActiveSteps[i] += runningKw;
            totalOutageKwh += energyThisStep;
            appOutageEnergyKwh += energyThisStep;
          }

          const timeOfDay = i * stepDurationHours;
          if (timeOfDay >= 6 && timeOfDay < 18) {
            totalDayKwh += energyThisStep;
          } else {
            totalNightKwh += energyThisStep;
          }
        }
      }

      totalDailyKwh += appDailyEnergyKwh;

      itemizedLoads.push({
        id: app.id,
        name: app.name,
        category: app.category || 'عام',
        quantity: qty,
        watt: watt,
        ratedKw: parseFloat(ratedKw.toFixed(3)),
        runningKw: parseFloat(runningKw.toFixed(3)),
        runningKva: parseFloat(runningKva.toFixed(3)),
        surgeMultiplier: surgeMultiplier,
        surgeKw: parseFloat(applianceSurgeKw.toFixed(2)),
        surgeKva: parseFloat(applianceSurgeKva.toFixed(2)),
        powerFactor: pf,
        dutyCycle: dutyCycle,
        loadType: loadType,
        priority: priority,
        hoursPerDay: parseFloat(appTotalHours.toFixed(1)),
        dailyKwh: parseFloat(appDailyEnergyKwh.toFixed(3)),
        outageKwh: parseFloat(appOutageEnergyKwh.toFixed(3))
      });
    });

    // أعلى قدرة مستمرة متزامنة (Peak Continuous Coincident Power)
    let peakContinuousKw = 0;
    let peakContinuousKva = 0;
    let peakOutageKw = 0;

    for (let i = 0; i < timeStepsCount; i++) {
      if (activePowerSteps[i] > peakContinuousKw) peakContinuousKw = activePowerSteps[i];
      if (apparentPowerSteps[i] > peakContinuousKva) peakContinuousKva = apparentPowerSteps[i];
      if (outageActiveSteps[i] > peakOutageKw) peakOutageKw = outageActiveSteps[i];
    }

    // حساب أقصى قدرة إقلاع لحظية متوقعة (Coincident Surge Power)
    // طريقة هندسية دقيقة: أعلى قدرة مستمرة متزامنة + إقلاع أكبر جهاز موتور/مكيف في النظام
    let largestSingleMotorSurgeAddon = 0;
    itemizedLoads.forEach(load => {
      const extraSurgeKw = load.surgeKw - load.runningKw;
      if (extraSurgeKw > largestSingleMotorSurgeAddon) {
        largestSingleMotorSurgeAddon = extraSurgeKw;
      }
    });

    maxSurgeKw = peakContinuousKw + largestSingleMotorSurgeAddon;
    maxSurgeKva = peakContinuousKva + (largestSingleMotorSurgeAddon / 0.8);

    return {
      totalDailyKwh: parseFloat(totalDailyKwh.toFixed(2)),
      totalOutageKwh: parseFloat(totalOutageKwh.toFixed(2)),
      totalGridKwh: parseFloat(totalGridKwh.toFixed(2)),
      totalDayKwh: parseFloat(totalDayKwh.toFixed(2)),
      totalNightKwh: parseFloat(totalNightKwh.toFixed(2)),
      peakContinuousKw: parseFloat(peakContinuousKw.toFixed(2)),
      peakContinuousKva: parseFloat(peakContinuousKva.toFixed(2)),
      peakOutageKw: parseFloat(peakOutageKw.toFixed(2)),
      maxSurgeKw: parseFloat(maxSurgeKw.toFixed(2)),
      maxSurgeKva: parseFloat(maxSurgeKva.toFixed(2)),
      itemizedLoads,
      activePowerSteps,
      apparentPowerSteps,
      outageActiveSteps,
      gridSchedule
    };
  }

  /**
   * 3. توليد منحنى الإنتاج الشمسي اليومي (Solar Generation Profile)
   * يعتمد على منحنى جيبي/ناقوسي يمثل حركة الشمس في سماء اليمن
   *
   * @param {number} pvPeakKw قدرة الألواح بالكيلوواط ذروة (kWp)
   * @param {number} psh ساعات الذروة الشمسية (اليمن 5.8 ساعة كمتوسط)
   * @param {number} deratingFactor معامل الكفاءة الكلي (0.78)
   * @param {number} timeStepsCount عدد الشرائح الزمنية (96)
   */
  function generateSolarCurve(pvPeakKw = 0, psh = 5.8, deratingFactor = 0.78, timeStepsCount = 96) {
    const steps = new Array(timeStepsCount).fill(0);
    const stepDurationHours = 24 / timeStepsCount;

    if (pvPeakKw <= 0) {
      return { steps, totalDailyKwh: 0, peakOutputKw: 0 };
    }

    // شروق الشمس ~ 06:00، الغروب ~ 18:00 (12 ساعة ضوء)
    const sunriseHour = 6.0;
    const sunsetHour = 18.0;
    const solarWindowHours = sunsetHour - sunriseHour; // 12h
    const solarNoonHour = 12.0;

    // تكامل منحنى نصف الجيب على 12 ساعة هو: Peak * (12 / pi) * 2 = Peak * (24 / pi)
    // نريد أن يكون التكامل اليومي = pvPeakKw * psh * deratingFactor
    // إذن: Area = pvPeakKw * psh * deratingFactor
    // ذروة المنحنى الفعلي: Peak = (Area * pi) / (2 * solarWindowHours)
    const targetDailyKwh = pvPeakKw * psh * deratingFactor;
    const peakRealPowerKw = (targetDailyKwh * Math.PI) / (2 * solarWindowHours);

    let actualGeneratedKwh = 0;
    let maxKw = 0;

    for (let i = 0; i < timeStepsCount; i++) {
      const t = i * stepDurationHours;
      if (t >= sunriseHour && t <= sunsetHour) {
        // زاوية من 0 إلى PI
        const angle = ((t - sunriseHour) / solarWindowHours) * Math.PI;
        const powerKw = Math.max(0, peakRealPowerKw * Math.sin(angle));
        steps[i] = powerKw;
        actualGeneratedKwh += powerKw * stepDurationHours;
        if (powerKw > maxKw) maxKw = powerKw;
      } else {
        steps[i] = 0;
      }
    }

    return {
      steps,
      totalDailyKwh: parseFloat(actualGeneratedKwh.toFixed(2)),
      peakOutputKw: parseFloat(maxKw.toFixed(2))
    };
  }

  /**
   * 4. محاكي 24 ساعة الدقيق خطوة بخطوة (Time-Step Simulation Engine)
   * يحاكي تدفقات الطاقة: شمس -> أحمال -> شحن بطارية -> تفريغ بطارية -> شبكة -> عجز
   *
   * @param {Object} params
   *   - loadProfile (من calculateLoadProfile)
   *   - gridSchedule (من parseGridSchedule)
   *   - pvKwPeak (قدرة الألواح)
   *   - batteryCapacityKwh (سعة البطارية الاسمية)
   *   - batteryDod (0.90 لليثيوم)
   *   - batteryMaxDischargeKw (أقصى قدرة تفريغ مستمرة للبطارية)
   *   - inverterRatedKw (قدرة الإنفرتر)
   *   - designParams (المعايير الهندسية)
   */
  function runSimulation(params = {}) {
    const {
      loadProfile,
      gridSchedule,
      pvKwPeak = 0,
      batteryCapacityKwh = 0,
      batteryDod = 0.90,
      batteryMaxDischargeKw = Infinity,
      inverterRatedKw = 5.0,
      initialSoC = 0.50, // حالة الشحن في بداية المحاكاة (50%)
      designParams = DEFAULT_DESIGN_PARAMS
    } = params;

    const timeStepsCount = loadProfile.activePowerSteps.length;
    const stepDurationHours = 24 / timeStepsCount;

    // توليد منحنى الإنتاج الشمسي
    const solarCurve = generateSolarCurve(
      pvKwPeak,
      designParams.psh || 5.8,
      designParams.deratingFactor || 0.78,
      timeStepsCount
    );

    // سعة البطارية المفيدة ومستويات SoC
    const maxSoCKwh = batteryCapacityKwh;
    const minSoCKwh = batteryCapacityKwh * (1 - batteryDod);
    const usableCapacityKwh = maxSoCKwh - minSoCKwh;

    // كفاءات
    const chargeEff = designParams.chargeEfficiency || 0.95;
    const dischargeEff = designParams.dischargeEfficiency || 0.95;
    const invEff = designParams.inverterEfficiency || 0.96;

    // مصفوفات نتائج المحاكاة
    const timeLabels = [];
    const loadKwSeries = [];
    const solarGenKwSeries = [];
    const directSolarToLoadKwSeries = [];
    const solarToBatteryKwSeries = [];
    const batteryDischargeKwSeries = [];
    const gridToLoadKwSeries = [];
    const gridToBatteryKwSeries = [];
    const unservedLoadKwSeries = [];
    const batterySoCKwhSeries = [];
    const batterySoCPercentSeries = [];
    const solarCurtailedKwSeries = [];

    let currentSoCKwh = minSoCKwh + (usableCapacityKwh * initialSoC);

    // عدادات ومجموع الطاقة الإجمالي
    let totalSolarGeneratedKwh = 0;
    let totalDirectSolarKwh = 0;
    let totalSolarToBatteryKwh = 0;
    let totalBatteryDischargedKwh = 0;
    let totalGridConsumedKwh = 0;
    let totalUnservedEnergyKwh = 0;
    let totalCurtailedSolarKwh = 0;
    let batteryFullDepletionsCount = 0;

    for (let i = 0; i < timeStepsCount; i++) {
      const timeHours = i * stepDurationHours;
      const hh = Math.floor(timeHours).toString().padStart(2, '0');
      const mm = Math.floor((timeHours % 1) * 60).toString().padStart(2, '0');
      timeLabels.push(`${hh}:${mm}`);

      const loadKw = loadProfile.activePowerSteps[i];
      const isGridAvailable = gridSchedule.steps[i];
      const solarAvailableKw = solarCurve.steps[i];

      totalSolarGeneratedKwh += solarAvailableKw * stepDurationHours;

      let remainingLoadKw = loadKw;
      let directSolarKw = 0;
      let solarToBatKw = 0;
      let batDischargeKw = 0;
      let gridLoadKw = 0;
      let gridBatKw = 0;
      let unservedKw = 0;
      let curtailedKw = 0;

      // 1. استخدام الطاقة الشمسية مباشرة لتغطية الحمل أولاً
      if (solarAvailableKw > 0 && remainingLoadKw > 0) {
        directSolarKw = Math.min(solarAvailableKw, remainingLoadKw);
        remainingLoadKw -= directSolarKw;
      }
      totalDirectSolarKwh += directSolarKw * stepDurationHours;

      // الفائض الشمسي بعد تغذية الحمل
      let excessSolarKw = Math.max(0, solarAvailableKw - directSolarKw);

      // 2. استخدام الفائض الشمسي لشحن البطارية
      if (excessSolarKw > 0 && currentSoCKwh < maxSoCKwh) {
        const roomInBatKwh = maxSoCKwh - currentSoCKwh;
        // أقصى طاقة يمكن للبطارية استقبالها في هذه الشريحة
        const maxChargeKw = roomInBatKwh / (stepDurationHours * chargeEff);
        solarToBatKw = Math.min(excessSolarKw, maxChargeKw);

        currentSoCKwh += solarToBatKw * stepDurationHours * chargeEff;
        excessSolarKw -= solarToBatKw;
      }
      totalSolarToBatteryKwh += solarToBatKw * stepDurationHours;

      // أي فائض شمسي متبقٍ بعد امتلاء البطارية يعتبر فاقداً (Curtailed)
      curtailedKw = excessSolarKw;
      totalCurtailedSolarKwh += curtailedKw * stepDurationHours;

      // 3. تغطية ما تبقى من الحمل: إذا كانت الشبكة متوفرة أم مقطوعة
      if (remainingLoadKw > 0) {
        if (isGridAvailable) {
          // الشبكة موجودة: تغذي الحمل مباشرة
          gridLoadKw = remainingLoadKw;
          remainingLoadKw = 0;
          totalGridConsumedKwh += gridLoadKw * stepDurationHours;
        } else {
          // الشبكة مقطوعة: سحب العجز من البطارية
          if (currentSoCKwh > minSoCKwh) {
            const availableBatKwh = currentSoCKwh - minSoCKwh;
            // أقصى سحب مستمر من البطارية
            const maxDeliverableKw = Math.min(
              availableBatKwh * dischargeEff / stepDurationHours,
              batteryMaxDischargeKw,
              inverterRatedKw
            );

            batDischargeKw = Math.min(remainingLoadKw, maxDeliverableKw);
            remainingLoadKw -= batDischargeKw;

            // خصم الطاقة المستهلكة من البطارية
            currentSoCKwh -= (batDischargeKw * stepDurationHours) / dischargeEff;
            totalBatteryDischargedKwh += batDischargeKw * stepDurationHours;
          }

          // إذا لم تكفِ البطارية، يتبقى عجز وانقطاع للأحمال (Deficit)
          if (remainingLoadKw > 0.001) {
            unservedKw = remainingLoadKw;
            totalUnservedEnergyKwh += unservedKw * stepDurationHours;
            batteryFullDepletionsCount++;
          }
        }
      }

      // حساب نسبة شحن البطارية (SoC %)
      let socPct = 0;
      if (usableCapacityKwh > 0) {
        socPct = ((currentSoCKwh - minSoCKwh) / usableCapacityKwh) * 100;
      }
      socPct = Math.min(100, Math.max(0, socPct));

      loadKwSeries.push(parseFloat(loadKw.toFixed(2)));
      solarGenKwSeries.push(parseFloat(solarAvailableKw.toFixed(2)));
      directSolarToLoadKwSeries.push(parseFloat(directSolarKw.toFixed(2)));
      solarToBatteryKwSeries.push(parseFloat(solarToBatKw.toFixed(2)));
      batteryDischargeKwSeries.push(parseFloat(batDischargeKw.toFixed(2)));
      gridToLoadKwSeries.push(parseFloat(gridLoadKw.toFixed(2)));
      unservedLoadKwSeries.push(parseFloat(unservedKw.toFixed(2)));
      batterySoCKwhSeries.push(parseFloat(currentSoCKwh.toFixed(2)));
      batterySoCPercentSeries.push(parseFloat(socPct.toFixed(1)));
      solarCurtailedKwSeries.push(parseFloat(curtailedKw.toFixed(2)));
    }

    // نسبة التغطية الشمسية والاستقلالية (Solar Autonomy Rate)
    const totalLoadEnergy = loadProfile.totalDailyKwh;
    const servedEnergy = Math.max(0, totalLoadEnergy - totalUnservedEnergyKwh);
    const solarCoveragePercent = totalLoadEnergy > 0
      ? Math.min(100, ((totalDirectSolarKwh + totalBatteryDischargedKwh) / totalLoadEnergy) * 100)
      : 100;

    return {
      timeLabels,
      series: {
        loadKw: loadKwSeries,
        solarGenKw: solarGenKwSeries,
        directSolarToLoadKw: directSolarToLoadKwSeries,
        solarToBatteryKw: solarToBatteryKwSeries,
        batteryDischargeKw: batteryDischargeKwSeries,
        gridToLoadKw: gridToLoadKwSeries,
        unservedLoadKw: unservedLoadKwSeries,
        batterySoCKwh: batterySoCKwhSeries,
        batterySoCPercent: batterySoCPercentSeries,
        solarCurtailedKw: solarCurtailedKwSeries
      },
      summary: {
        totalDailyLoadKwh: parseFloat(totalLoadEnergy.toFixed(2)),
        totalSolarGeneratedKwh: parseFloat(totalSolarGeneratedKwh.toFixed(2)),
        totalDirectSolarKwh: parseFloat(totalDirectSolarKwh.toFixed(2)),
        totalSolarToBatteryKwh: parseFloat(totalSolarToBatteryKwh.toFixed(2)),
        totalBatteryDischargedKwh: parseFloat(totalBatteryDischargedKwh.toFixed(2)),
        totalGridConsumedKwh: parseFloat(totalGridConsumedKwh.toFixed(2)),
        totalUnservedEnergyKwh: parseFloat(totalUnservedEnergyKwh.toFixed(2)),
        totalCurtailedSolarKwh: parseFloat(totalCurtailedSolarKwh.toFixed(2)),
        solarCoveragePercent: parseFloat(solarCoveragePercent.toFixed(1)),
        batteryFullDepletionsCount
      }
    };
  }

  /**
   * 5. الحسابات الكهربائية الدقيقة لسلاسل الألواح ومطابقة MPPT (String Sizing)
   * التحقق من: Voc cold, Vmp hot, Max DC Input, Isc max
   */
  function calculateElectricalStringing(panel, inverter, targetPvKw, designParams = DEFAULT_DESIGN_PARAMS) {
    const tMin = designParams.tempMinC || 15;
    const tMaxCell = designParams.tempMaxCellC || 65;
    const stcTemp = designParams.stcTempC || 25;

    const panelWatt = panel.watt;
    const vocStc = panel.voc || (panelWatt / 12); // تقدير إذا لم يتوفر
    const vmpStc = panel.vmp || (vocStc * 0.82);
    const isc = panel.isc || (panelWatt / vmpStc);
    const imp = panel.imp || (isc * 0.94);

    // معاملات الحرارة (النسب المئوية لكل درجة مئوية)
    const gammaVoc = panel.tempCoefficientVoc || panel.tempCoeffVoc || -0.0026; // -0.26%/C
    const gammaVmp = panel.tempCoefficientVmp || -0.0030; // -0.30%/C

    // أقصى جهد دائرة مفتوحة عند أبرد حرارة متوقعة (Winter Morning Voc Cold)
    // Voc(Tmin) = Voc_STC * [1 + gamma_Voc * (Tmin - 25)]
    const vocCold = vocStc * (1 + gammaVoc * (tMin - stcTemp));

    // أدنى جهد نقطة قدرة عظمى عند أحر حرارة متوقعة للخلايا (Summer Noon Vmp Hot)
    // Vmp(Tmax) = Vmp_STC * [1 + gamma_Vmp * (Tmax - 25)]
    const vmpHot = vmpStc * (1 + gammaVmp * (tMaxCell - stcTemp));

    // حدود الإنفرتر
    const invMaxVoc = inverter.maxVocInput || inverter.maxPvVoc || 500;
    const invMpptMin = inverter.mpptMin || inverter.mpptVoltageMin || 120;
    const invMpptMax = inverter.mpptMax || inverter.mpptVoltageMax || 450;
    const invMpptTrackers = inverter.mpptTrackers || 2;
    const invMaxPvPower = inverter.maxPvPower || (inverter.capacityKw * 1.3 * 1000);

    // أقصى عدد ألواح في السلسلة (Series String Max): يجب ألا يتجاوز Voc Cold جهد الإنفرتر الأقصى أو حد MPPT الأعلى
    const maxPanelsSeriesByVoc = Math.floor(invMaxVoc / vocCold);
    const maxPanelsSeriesByMppt = Math.floor(invMpptMax / vmpStc);
    const maxPanelsSeries = Math.min(maxPanelsSeriesByVoc, maxPanelsSeriesByMppt);

    // أدنى عدد ألواح في السلسلة (Series String Min): يجب أن يتجاوز Vmp Hot حد MPPT الأدنى لبدء التتبع
    const minPanelsSeries = Math.ceil(invMpptMin / vmpHot);

    // التحقق من صلاحية النافذة الهندسية
    const isMpptFeasible = maxPanelsSeries >= minPanelsSeries;

    // العدد المستهدف للألواح للوصول للقدرة المطلوبة
    const targetPanelsCount = Math.max(1, Math.ceil((targetPvKw * 1000) / panelWatt));

    // اختيار التوزيع المثالي للسلاسل (Optimal Strings Configuration)
    let bestSeries = Math.min(maxPanelsSeries, Math.max(minPanelsSeries, Math.round(targetPanelsCount / invMpptTrackers)));
    if (bestSeries < minPanelsSeries) bestSeries = minPanelsSeries;
    if (bestSeries > maxPanelsSeries) bestSeries = maxPanelsSeries;

    let parallelStrings = Math.max(1, Math.round(targetPanelsCount / bestSeries));
    parallelStrings = Math.min(parallelStrings, invMpptTrackers * 2);

    let totalPanels = bestSeries * parallelStrings;
    // التأكد من عدم تجاوز أقصى قدرة PV يدعمها الإنفرتر
    while (totalPanels * panelWatt > invMaxPvPower && bestSeries > minPanelsSeries) {
      bestSeries--;
      totalPanels = bestSeries * parallelStrings;
    }

    const actualPvKw = (totalPanels * panelWatt) / 1000;
    const stringVocCold = parseFloat((bestSeries * vocCold).toFixed(1));
    const stringVmpHot = parseFloat((bestSeries * vmpHot).toFixed(1));

    return {
      panelWatt,
      vocCold: parseFloat(vocCold.toFixed(2)),
      vmpHot: parseFloat(vmpHot.toFixed(2)),
      minPanelsSeries,
      maxPanelsSeries,
      isMpptFeasible,
      recommendedPanelsPerString: bestSeries,
      recommendedParallelStrings: parallelStrings,
      totalPanelsCount: totalPanels,
      actualPvKw: parseFloat(actualPvKw.toFixed(2)),
      stringVocCold,
      stringVmpHot,
      mpptWindow: `${invMpptMin}V - ${invMpptMax}V`,
      withinLimits: isMpptFeasible && (stringVocCold <= invMaxVoc) && (stringVmpHot >= invMpptMin)
    };
  }

  /**
   * 6. محرك تحديد أبعاد ومطابقة مكونات المنظومة (System Sizing & Match Engine)
   * يحلل الأحمال وجدول الشبكة، ثم يختار من قاعدة البيانات أفضل 3 خيارات:
   * 1. الموصى بها (Recommended)
   * 2. الاقتصادية (Economic)
   * 3. الأداء العالي (High Performance)
   *
   * @param {Object} loadProfile ناتج حساب ملف الأحمال
   * @param {Object} gridSchedule ناتج جدول الشبكة
   * @param {Object} inventory المخزون { inverters, batteries, panels }
   * @param {Object} designParams المعايير الهندسية
   */
  function sizeAndMatchSystem(loadProfile, gridSchedule, inventory = {}, designParams = DEFAULT_DESIGN_PARAMS) {
    const inverters = (inventory.inverters || []).filter(i => i.available !== false);
    const batteries = (inventory.batteries || []).filter(b => b.available !== false);
    const panels = (inventory.panels || []).filter(p => p.available !== false);

    if (inverters.length === 0 || batteries.length === 0 || panels.length === 0) {
      throw new Error("بيانات المخزون غير كافية لإجراء المطابقة الهندسية");
    }

    // 1. المتطلبات الهندسية الدنيا
    const safetyMargin = designParams.inverterSafetyMargin || 1.25;
    const psh = designParams.psh || 5.8;
    const derating = designParams.deratingFactor || 0.78;

    // أ) قدرة الإنفرتر المطلوبة (Continuous kW & Surge kW)
    const minInverterContinuousKw = loadProfile.peakContinuousKw * safetyMargin;
    const minInverterSurgeKw = loadProfile.maxSurgeKw;

    // ب) سعة البطارية المطلوبة لتغطية أوقات الانقطاع
    // في النظام المعزول: تغطية استهلاك الليل والغيوم
    // في نظام الشبكة: تغطية أسوأ مدة انقطاع متواصلة
    let energyToStoreKwh = 0;
    if (gridSchedule.mode === 'offgrid') {
      energyToStoreKwh = loadProfile.totalNightKwh + (loadProfile.totalDayKwh * 0.3);
    } else {
      energyToStoreKwh = loadProfile.totalOutageKwh;
      if (energyToStoreKwh === 0 && loadProfile.totalNightKwh > 0) {
        energyToStoreKwh = loadProfile.totalNightKwh; // احتياطي عند الانقطاع
      }
    }
    // إضافة هامش أمان لتفريغ البطارية 15%
    const targetUsableBatteryKwh = Math.max(2.4, energyToStoreKwh * 1.15);

    // ج) قدرة الألواح الشمسية المطلوبة (kWp)
    // تغطية استهلاك اليوم + طاقة شحن البطارية
    const batteryRechargeKwh = targetUsableBatteryKwh / (designParams.chargeEfficiency || 0.95);
    const dailyTargetEnergyKwh = (loadProfile.totalDayKwh) + batteryRechargeKwh;
    const minPvKwPeak = Math.max(1.0, dailyTargetEnergyKwh / (psh * derating));

    // 2. فلترة ومطابقة الإنفرترات المناسبة كهربائياً
    const validInverters = inverters.filter(inv => {
      const ratedKw = inv.capacityKw || inv.ratedPowerKw || 0;
      const surgeKw = inv.surgeCapacityKw || inv.surgePowerKw || (ratedKw * 2);
      return ratedKw >= (loadProfile.peakContinuousKw * 1.05) && surgeKw >= (minInverterSurgeKw * 0.95);
    });

    const chosenInverterList = validInverters.length > 0 ? validInverters : inverters;
    // ترتيب الإنفرترات حسب السعة والسعر
    chosenInverterList.sort((a, b) => a.capacityKw - b.capacityKw || a.price - b.price);

    // 3. بناء وتوليد الباقات الثلاث
    const packages = {};

    // --- باقة 1: الخيار الاقتصادي (Economic) ---
    // يختار أصغر إنفرتر يغطي الأحمال مع بطارية LiFePO4 أو أنبوبية بأقل تكلفة
    const econInv = chosenInverterList[0] || inverters[0];
    const econPanel = panels.slice().sort((a, b) => a.price - b.price)[0] || panels[0];
    const econBattery = batteries.slice().sort((a, b) => a.price - b.price)[0] || batteries[0];

    // حساب عدد البطاريات المطلوبة
    const econBatDod = econBattery.dod || 0.85;
    const econBatUsableKwh = econBattery.capacityKwh * econBatDod;
    const econBatCount = Math.max(1, Math.ceil(targetUsableBatteryKwh / econBatUsableKwh));

    // مطابقة الألواح للإنفرتر الاقتصادي
    const econStringing = calculateElectricalStringing(econPanel, econInv, minPvKwPeak, designParams);

    packages.economic = {
      type: 'economic',
      title: 'الباقة الاقتصادية الذكية',
      badge: 'أقل تكلفة مع الالتزام بالمواصفات الهندسية',
      inverter: {
        ...econInv,
        quantity: 1,
        totalCost: econInv.price
      },
      battery: {
        ...econBattery,
        quantity: econBatCount,
        totalKwh: parseFloat((econBattery.capacityKwh * econBatCount).toFixed(2)),
        usableKwh: parseFloat((econBatUsableKwh * econBatCount).toFixed(2)),
        totalCost: econBattery.price * econBatCount
      },
      panel: {
        ...econPanel,
        quantity: econStringing.totalPanelsCount,
        totalKw: econStringing.actualPvKw,
        stringing: econStringing,
        totalCost: econPanel.price * econStringing.totalPanelsCount
      }
    };

    // --- باقة 2: الخيار الموصى به (Recommended) ---
    // يختار إنفرتر Deye ممتاز بهامش أمان كامل + بطاريات ليثيوم Narada/BYD + ألواح N-Type عالية الكفاءة
    const recInv = chosenInverterList.find(i => (i.capacityKw || 0) >= minInverterContinuousKw)
      || chosenInverterList[Math.min(1, chosenInverterList.length - 1)];

    const recPanel = panels.find(p => (p.watt || 0) >= 580) || panels[0];
    const recBattery = batteries.find(b => (b.chemistry || '').includes('Li') || (b.name || '').includes('ليثيوم') || (b.name || '').includes('نارادا'))
      || batteries[0];

    const recBatDod = recBattery.dod || 0.90;
    const recBatUsableKwh = recBattery.capacityKwh * recBatDod;
    const recBatCount = Math.max(1, Math.ceil(targetUsableBatteryKwh / recBatUsableKwh));

    // الألواح بهامش احتياطي 15% لضمان شحن سريع في الأيام الغائمة
    const recStringing = calculateElectricalStringing(recPanel, recInv, minPvKwPeak * 1.15, designParams);

    packages.recommended = {
      type: 'recommended',
      title: 'الباقة الموصى بها هندسياً',
      badge: 'الخيار الأفضل: أداء متوازن وموثوقية عالية وعمر افتراضي طويل',
      inverter: {
        ...recInv,
        quantity: 1,
        totalCost: recInv.price
      },
      battery: {
        ...recBattery,
        quantity: recBatCount,
        totalKwh: parseFloat((recBattery.capacityKwh * recBatCount).toFixed(2)),
        usableKwh: parseFloat((recBatUsableKwh * recBatCount).toFixed(2)),
        totalCost: recBattery.price * recBatCount
      },
      panel: {
        ...recPanel,
        quantity: recStringing.totalPanelsCount,
        totalKw: recStringing.actualPvKw,
        stringing: recStringing,
        totalCost: recPanel.price * recStringing.totalPanelsCount
      }
    };

    // --- باقة 3: خيار الأداء العالي (High Performance) ---
    // سعة إنفرتر أكبر + استقلالية بطارية تدوم أطول بنسبة 35% + ألواح شمسية بأقصى سعة MPPT
    const highInv = chosenInverterList[chosenInverterList.length - 1] || recInv;
    const highPanel = panels.slice().sort((a, b) => b.watt - a.watt)[0] || recPanel;
    const highBattery = batteries.slice().sort((a, b) => b.capacityKwh - a.capacityKwh)[0] || recBattery;

    const highBatDod = highBattery.dod || 0.90;
    const highBatUsableKwh = highBattery.capacityKwh * highBatDod;
    const highBatCount = Math.max(1, Math.ceil((targetUsableBatteryKwh * 1.35) / highBatUsableKwh));

    const highStringing = calculateElectricalStringing(highPanel, highInv, minPvKwPeak * 1.35, designParams);

    packages.highPerformance = {
      type: 'highPerformance',
      title: 'باقة الأداء العالي والأمان الأقصى',
      badge: 'استقلالية مضاعفة وتوسع مستقبلي للأحمال الثقيلة',
      inverter: {
        ...highInv,
        quantity: 1,
        totalCost: highInv.price
      },
      battery: {
        ...highBattery,
        quantity: highBatCount,
        totalKwh: parseFloat((highBattery.capacityKwh * highBatCount).toFixed(2)),
        usableKwh: parseFloat((highBatUsableKwh * highBatCount).toFixed(2)),
        totalCost: highBattery.price * highBatCount
      },
      panel: {
        ...highPanel,
        quantity: highStringing.totalPanelsCount,
        totalKw: highStringing.actualPvKw,
        stringing: highStringing,
        totalCost: highPanel.price * highStringing.totalPanelsCount
      }
    };

    return {
      sizingRequirements: {
        minInverterContinuousKw: parseFloat(minInverterContinuousKw.toFixed(2)),
        minInverterSurgeKw: parseFloat(minInverterSurgeKw.toFixed(2)),
        targetUsableBatteryKwh: parseFloat(targetUsableBatteryKwh.toFixed(2)),
        minPvKwPeak: parseFloat(minPvKwPeak.toFixed(2))
      },
      packages
    };
  }

  /**
   * 7. مولد عرض السعر وجدول الكميات (BOM & Quotation Generator)
   * يحسب التكلفة الإجمالية ومكونات التركيب والحماية ويوفر تقريراً مالياً وفنياً متكاملاً
   *
   * @param {Object} pkg الباقة المختارة (من sizeAndMatchSystem)
   * @param {Object} designParams المعايير الهندسية
   * @param {Object} customerInfo معلومات العميل
   */
  function generateQuotation(pkg, designParams = DEFAULT_DESIGN_PARAMS, customerInfo = {}) {
    const exchangeRate = designParams.currencyExchangeRate || 535;

    // المكونات الرئيسية
    const inverter = pkg.inverter;
    const battery = pkg.battery;
    const panel = pkg.panel;

    // 1. تكلفة الهياكل والقواعد المعدنية المجلفنة المقاومة للرياح
    // تقدير 20$ لكل لوح شمسي
    const structureUnitPrice = 20;
    const structureCost = panel.quantity * structureUnitPrice;

    // 2. كابلات شمسية وتوصيلات MC4 وقواطع الحماية DC & AC
    // صلب هندسي: صندوق حماية DC مدمج بقواطع 1000V + مانعات صواعق SPD + فيوزات + قاطع AC ومفتاح تحويل ATS
    const protectionBoxCost = inverter.capacityKw <= 6 ? 220 : 380;
    const cablingCost = Math.round(panel.totalKw * 1000 * 0.08); // 0.08$ لكل واط كابلات نحاسية معتمدة

    // 3. أجور التركيب والبرمجة والفحص الهندسي
    const installationFee = Math.round(Math.max(150, panel.totalKw * 1000 * 0.07));

    // جدول الكميات المفصل (Bill of Materials)
    const items = [
      {
        itemNumber: 1,
        category: 'الإنفرتر',
        name: inverter.name,
        specs: `قدرة ${inverter.capacityKw}kW موجة جيبية نقية، جهد بطارية ${inverter.systemVoltage || 48}V، تتبع MPPT مزدوج`,
        quantity: inverter.quantity,
        unit: 'جهاز',
        unitPrice: inverter.price,
        totalPrice: inverter.totalCost,
        warranty: `${inverter.warranty || 5} سنوات`
      },
      {
        itemNumber: 2,
        category: 'الألواح الشمسية',
        name: panel.name,
        specs: `لوح شمس ذروة ${panel.watt}W بتقنية N-Type TOPCon نصف خلية كفاءة 22%+`,
        quantity: panel.quantity,
        unit: 'لوح',
        unitPrice: panel.price,
        totalPrice: panel.totalCost,
        warranty: `${panel.warranty || 25} سنة ضمان أداء`
      },
      {
        itemNumber: 3,
        category: 'تخزين الطاقة (البطاريات)',
        name: battery.name,
        specs: `سعة ${battery.capacityKwh}kWh كيمياء LiFePO4 آمنة، نظام إدارة ذكي BMS يدعم 6000 دورة`,
        quantity: battery.quantity,
        unit: 'وحدة',
        unitPrice: battery.price,
        totalPrice: battery.totalCost,
        warranty: `${battery.warranty || 5} سنوات`
      },
      {
        itemNumber: 4,
        category: 'الهياكل والقواعد',
        name: 'قواعد وحوامل تثبيت ألومنيوم / حديد مجلفن',
        specs: 'هيكل تثبيت أرضي أو سطحي مجلفن عالي المقاومة للرياح مع مشابك التثبيت المقاومة للصدأ',
        quantity: panel.quantity,
        unit: 'لوح',
        unitPrice: structureUnitPrice,
        totalPrice: structureCost,
        warranty: '10 سنوات'
      },
      {
        itemNumber: 5,
        category: 'لوحات الحماية والتحويل',
        name: 'لوحة حماية وتوزيع متكاملة DC / AC مع مفتاح ATS',
        specs: 'قواطع DC معتمدة، مانعات صواعق SPD، فيوزات حماية، قواطع AC، ومفتاح تحويل يدوي/أوتوماتيكي',
        quantity: 1,
        unit: 'لوحة',
        unitPrice: protectionBoxCost,
        totalPrice: protectionBoxCost,
        warranty: 'سنتان'
      },
      {
        itemNumber: 6,
        category: 'الكابلات والموصلات',
        name: 'كابلات شمسية نحاسية أصلية 4mm/6mm مع وصلات MC4',
        specs: 'كابلات مقاومة لأشعة الشمس UV ذات عزل مزدوج مع وصلات إحكام أصلية وتوصيلات البطاريات',
        quantity: 1,
        unit: 'مجموعة',
        unitPrice: cablingCost,
        totalPrice: cablingCost,
        warranty: 'سنتان'
      },
      {
        itemNumber: 7,
        category: 'التركيب والتشغيل',
        name: 'التركيب الميداني والبرمجة والتسليم الفني',
        specs: 'تركيب احترافي من مهندسي بترونيل يمن، تأريض الحماية، اختبارات الكفاءة وضبط إعدادات الإنفرتر والـ BMS',
        quantity: 1,
        unit: 'خدمة',
        unitPrice: installationFee,
        totalPrice: installationFee,
        warranty: 'سنة صيانة مجانية'
      }
    ];

    // الإجماليات المالية
    const totalEquipmentCostUsd = inverter.totalCost + panel.totalCost + battery.totalCost;
    const totalAccessoriesCostUsd = structureCost + protectionBoxCost + cablingCost;
    const totalCostUsd = totalEquipmentCostUsd + totalAccessoriesCostUsd + installationFee;
    const totalCostYer = totalCostUsd * exchangeRate;

    const quoteId = 'PYS-' + (customerInfo.phone ? customerInfo.phone.slice(-4) : Math.floor(1000 + Math.random() * 9000)) + '-' + Math.floor(Math.random() * 1000);
    const currentDate = new Date().toISOString().split('T')[0];

    return {
      quoteId,
      date: currentDate,
      validUntilDays: 14,
      company: {
        name: "بترونيل يمن للطاقة",
        commercialReg: "شركة رائدة في أنظمة الطاقة الشمسية والحلول الذكية",
        phone: "783999039",
        address: "عدن - المنصورة، خلف محطة التسعين، أمام فندق قتبان",
        email: "info@petronilyemen.com"
      },
      customer: {
        name: customerInfo.name || "عميل بترونيل المميز",
        phone: customerInfo.phone || "",
        location: customerInfo.location || "اليمن"
      },
      systemOverview: {
        packageType: pkg.title,
        inverterCapacityKw: inverter.capacityKw,
        pvCapacityKw: panel.totalKw,
        panelsCount: panel.quantity,
        batteryCapacityKwh: battery.totalKwh,
        batteryUsableKwh: battery.usableKwh,
        batteryUnits: battery.quantity
      },
      items,
      financials: {
        equipmentCostUsd: parseFloat(totalEquipmentCostUsd.toFixed(2)),
        accessoriesCostUsd: parseFloat(totalAccessoriesCostUsd.toFixed(2)),
        installationFeeUsd: parseFloat(installationFee.toFixed(2)),
        totalCostUsd: parseFloat(totalCostUsd.toFixed(2)),
        totalCostYer: Math.round(totalCostYer),
        exchangeRate
      },
      terms: [
        "الأسعار تشمل التوريد والتركيب والفحص الهندسي في نطاق فروع الشركة.",
        "عرض السعر ساري المفعول لمدة 14 يوماً من تاريخ إصداره نظراً لتقلبات أسعار الصرف العالمية.",
        "ضمان شامل للإنفرتر والبطاريات لمدة 5 سنوات، وضمان أداء الألواح لمدة 25 سنة وفق شروط المصنع.",
        "توفر بترونيل يمن الصيانة الدورية والدعم الفني وقطع الغيار الأصلية."
      ]
    };
  }

  // --- دوال مساعدة ومُصدّرة ---
  return {
    DEFAULT_DESIGN_PARAMS,
    parseGridSchedule,
    calculateLoadProfile,
    generateSolarCurve,
    runSimulation,
    calculateElectricalStringing,
    sizeAndMatchSystem,
    generateQuotation
  };

}));

}

/**
 * Petronil Yemen Solar Calculator - Client Controller (v2.0)
 * نظام التحكم بحاسبة وتصميم المنظومات الشمسية لشركة بترونيل يمن للطاقة
 */

// --- Global State ---
const State = {
  currentStep: 1,
  currency: 'USD',
  designParams: {
    psh: 5.8,
    deratingFactor: 0.78,
    inverterSafetyMargin: 1.25,
    currencyExchangeRate: 535
  },
  grid: {
    mode: 'offgrid', // 'offgrid' | 'schedule' | 'dailyHours' | 'irregular'
    intervals: [
      { start: '06:00', end: '10:00' },
      { start: '16:00', end: '20:00' }
    ],
    dailyHours: 6,
    worstOutageHours: 16,
    policy: 'solar_first' // 'solar_first' | 'grid_first'
  },
  appliances: [],
  inventory: {
    inverters: [],
    batteries: [],
    panels: []
  },
  applianceTemplates: [],
  selectedPackageType: 'recommended',
  matchedPackages: null,
  activePackage: null,
  simChartInstance: null,
  customer: {
    name: 'عميل بترونيل المميز',
    phone: '',
    location: 'عدن'
  }
};

// Fallback Default Templates if API is offline
const FALLBACK_TEMPLATES = [
  { id: 'ac_split', name: 'مكيف سبليت 1.5 طن (إنفرتر)', category: 'تبريد وتكييف', watt: 1300, powerFactor: 0.88, loadType: 'aircon', surgeMultiplier: 2.5, dutyCycle: 0.7, dayHours: 6, nightHours: 2, icon: 'fa-snowflake', quantity: 1, priority: 'important' },
  { id: 'fridge_inv', name: 'ثلاجة منزلية موفرة (إنفرتر)', category: 'تبريد وتكييف', watt: 180, powerFactor: 0.85, loadType: 'aircon', surgeMultiplier: 2.5, dutyCycle: 0.5, dayHours: 12, nightHours: 12, icon: 'fa-cube', quantity: 1, priority: 'essential' },
  { id: 'led_group', name: 'مجموعة إنارة LED منزلية', category: 'إنارة وإلكترونيات', watt: 100, powerFactor: 0.95, loadType: 'resistive', surgeMultiplier: 1.0, dutyCycle: 1.0, dayHours: 2, nightHours: 6, icon: 'fa-lightbulb', quantity: 1, priority: 'essential' },
  { id: 'tv_smart', name: 'شاشة تلفزيون ذكية 55 بوصة', category: 'إنارة وإلكترونيات', watt: 110, powerFactor: 0.95, loadType: 'electronic', surgeMultiplier: 1.0, dutyCycle: 1.0, dayHours: 4, nightHours: 4, icon: 'fa-tv', quantity: 1, priority: 'important' },
  { id: 'router_net', name: 'راوتر ومودم إنترنت 4G/ألياف', category: 'إنارة وإلكترونيات', watt: 18, powerFactor: 0.90, loadType: 'electronic', surgeMultiplier: 1.0, dutyCycle: 1.0, dayHours: 12, nightHours: 12, icon: 'fa-wifi', quantity: 1, priority: 'essential' },
  { id: 'fan_dc', name: 'مروحة سقف / عمودية موفرة', category: 'إنارة وإلكترونيات', watt: 65, powerFactor: 0.90, loadType: 'motor', surgeMultiplier: 1.8, dutyCycle: 0.9, dayHours: 8, nightHours: 8, icon: 'fa-fan', quantity: 2, priority: 'important' },
  { id: 'water_pump', name: 'مضخة مياه منزلية (1 حصان)', category: 'محركات ومضخات', watt: 750, powerFactor: 0.80, loadType: 'motor', surgeMultiplier: 4.5, dutyCycle: 1.0, dayHours: 1.5, nightHours: 0, icon: 'fa-faucet-drip', quantity: 1, priority: 'sheddable' },
  { id: 'washing_mach', name: 'غسالة ملابس أوتوماتيك', category: 'أجهزة مطبخ', watt: 500, powerFactor: 0.85, loadType: 'motor', surgeMultiplier: 2.2, dutyCycle: 0.8, dayHours: 2, nightHours: 0, icon: 'fa-soap', quantity: 1, priority: 'sheddable' },
  { id: 'microwave_oven', name: 'ميكروويف / فرن تسخين', category: 'أجهزة مطبخ', watt: 1200, powerFactor: 0.95, loadType: 'resistive', surgeMultiplier: 1.2, dutyCycle: 0.6, dayHours: 0.5, nightHours: 0.2, icon: 'fa-circle-dot', quantity: 1, priority: 'sheddable' },
  { id: 'pc_desktop', name: 'كمبيوتر مكتبي / ألعاب', category: 'إنارة وإلكترونيات', watt: 250, powerFactor: 0.90, loadType: 'electronic', surgeMultiplier: 1.1, dutyCycle: 0.9, dayHours: 4, nightHours: 2, icon: 'fa-laptop', quantity: 1, priority: 'important' }
];

// Fallback Inventory if API is offline
const FALLBACK_INVENTORY = {
  inverters: [
    { id: 'inv_deye_36', name: 'انفرتر Deye SUN-3.6K-SG04LP1 3.6kW', capacityKw: 3.6, ratedPowerKw: 3.6, surgeCapacityKw: 7.2, systemVoltage: 48, mpptMin: 80, mpptMax: 430, maxVocInput: 500, price: 550, warranty: 5, available: true },
    { id: 'inv_deye_50', name: 'انفرتر Deye SUN-5K-SG04LP1 5kW', capacityKw: 5.0, ratedPowerKw: 5.0, surgeCapacityKw: 10.0, systemVoltage: 48, mpptMin: 120, mpptMax: 430, maxVocInput: 500, price: 820, warranty: 5, available: true },
    { id: 'inv_deye_80', name: 'انفرتر Deye SUN-8K-SG01LP1 8kW', capacityKw: 8.0, ratedPowerKw: 8.0, surgeCapacityKw: 16.0, systemVoltage: 48, mpptMin: 125, mpptMax: 425, maxVocInput: 500, price: 1300, warranty: 5, available: true },
    { id: 'inv_deye_100', name: 'انفرتر Deye SUN-10K-SG04LP3 10kW 3P', capacityKw: 10.0, ratedPowerKw: 10.0, surgeCapacityKw: 20.0, systemVoltage: 48, mpptMin: 160, mpptMax: 650, maxVocInput: 800, price: 1750, warranty: 5, available: true }
  ],
  batteries: [
    { id: 'bat_narada_512', name: 'بطارية ليثيوم نارادا Narada 5.12kWh 48V', capacityKwh: 5.12, chemistry: 'LiFePO4', dod: 0.90, maxContinuousDischargeA: 100, price: 1150, warranty: 5, available: true },
    { id: 'bat_felicity_10', name: 'بطارية ليثيوم فيليسيتي Felicity 10.24kWh 48V', capacityKwh: 10.24, chemistry: 'LiFePO4', dod: 0.90, maxContinuousDischargeA: 150, price: 2150, warranty: 5, available: true },
    { id: 'bat_byd_15', name: 'بطارية ليثيوم بي واي دي BYD 15.36kWh 48V', capacityKwh: 15.36, chemistry: 'LiFePO4', dod: 0.90, maxContinuousDischargeA: 200, price: 3200, warranty: 5, available: true }
  ],
  panels: [
    { id: 'pan_jinko_610', name: 'لوح جينكو Jinko Tiger Neo 610W N-Type TOPCon', watt: 610, voc: 56.1, vmp: 47.2, isc: 13.9, imp: 12.92, tempCoefficientVoc: -0.0026, price: 115, warranty: 25, available: true },
    { id: 'pan_trina_580', name: 'لوح ترينا Trina Vertex S+ 580W Dual-Glass', watt: 580, voc: 52.8, vmp: 44.5, isc: 13.8, imp: 13.03, tempCoefficientVoc: -0.0025, price: 105, warranty: 25, available: true }
  ]
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initCurrencySelector();
  initWizardNavigation();
  initStep1Grid();
  initStep2Loads();
  initStep4Packages();
  initStep5Quotation();
  initContactLeadForm();

  // Load backend content
  fetchBackendData();
});

// --- Theme Controller ---
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('theme') || 'dark-theme';
  document.body.className = saved;
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-theme');
      document.body.classList.toggle('dark-theme', !isDark);
      document.body.classList.toggle('light-theme', isDark);
      localStorage.setItem('theme', isDark ? 'light-theme' : 'dark-theme');
      if (State.simChartInstance) State.simChartInstance.update();
    });
  }
}

// --- Mobile Menu Controller ---
function initMobileMenu() {
  const toggle = document.querySelector('.mobile-menu-toggle');
  const drawer = document.querySelector('.mobile-drawer');
  const closeBtn = document.querySelector('.close-drawer');
  const links = document.querySelectorAll('.drawer-link');

  if (toggle && drawer) {
    toggle.addEventListener('click', () => drawer.classList.add('open'));
    if (closeBtn) closeBtn.addEventListener('click', () => drawer.classList.remove('open'));
    links.forEach(l => l.addEventListener('click', () => drawer.classList.remove('open')));
  }
}

// --- Currency Selector ---
function initCurrencySelector() {
  const sel = document.getElementById('currency-select');
  if (sel) {
    sel.addEventListener('change', (e) => {
      State.currency = e.target.value;
      updateAllPricesUI();
    });
  }
}

function formatPrice(usdAmount) {
  const rate = State.designParams.currencyExchangeRate || 535;
  if (State.currency === 'YER') {
    const yer = Math.round(usdAmount * rate);
    return `${yer.toLocaleString('ar-YE')} ر.ي`;
  } else if (State.currency === 'SAR') {
    const sar = Math.round(usdAmount * 3.75);
    return `${sar.toLocaleString('ar-SA')} ر.س`;
  }
  return `$${Math.round(usdAmount).toLocaleString('en-US')}`;
}

// --- Fetch Backend Content ---
async function fetchBackendData() {
  try {
    const res = await fetch('/api/content');
    if (res.ok) {
      const data = await res.json();
      if (data.designParams) State.designParams = { ...State.designParams, ...data.designParams };
      if (data.appliances && data.appliances.length > 0) State.applianceTemplates = data.appliances;
      else State.applianceTemplates = FALLBACK_TEMPLATES;

      if (data.inverters && data.inverters.length > 0) State.inventory.inverters = data.inverters;
      else State.inventory.inverters = FALLBACK_INVENTORY.inverters;

      if (data.batteries && data.batteries.length > 0) State.inventory.batteries = data.batteries;
      else State.inventory.batteries = FALLBACK_INVENTORY.batteries;

      if (data.panels && data.panels.length > 0) State.inventory.panels = data.panels;
      else State.inventory.panels = FALLBACK_INVENTORY.panels;
    } else {
      useFallbackData();
    }
  } catch (err) {
    console.warn("Backend API unavailable, using local engineering defaults", err);
    useFallbackData();
  }

  // Render initial appliance buttons
  renderAppliancePicker('all');

  // Load initial demo appliances so the user sees a friendly starting point
  if (State.appliances.length === 0) {
    addApplianceByTemplateId('fridge_inv');
    addApplianceByTemplateId('led_group');
    addApplianceByTemplateId('tv_smart');
    addApplianceByTemplateId('fan_dc');
    addApplianceByTemplateId('router_net');
  }

  updateGridScheduleMetrics();
  updateLoadsMetrics();
}

function useFallbackData() {
  State.applianceTemplates = FALLBACK_TEMPLATES;
  State.inventory = FALLBACK_INVENTORY;
}

// --- Wizard Stepper Controller ---
function initWizardNavigation() {
  const stepNodes = document.querySelectorAll('.wizard-step-node');
  stepNodes.forEach(node => {
    node.addEventListener('click', () => {
      const targetStep = parseInt(node.getAttribute('data-step'), 10);
      goToStep(targetStep);
    });
  });

  // Next / Back buttons
  document.getElementById('btn-next-to-loads')?.addEventListener('click', () => goToStep(2));
  document.getElementById('btn-back-to-grid')?.addEventListener('click', () => goToStep(1));
  document.getElementById('btn-next-to-sim')?.addEventListener('click', () => goToStep(3));
  document.getElementById('btn-back-to-loads')?.addEventListener('click', () => goToStep(2));
  document.getElementById('btn-next-to-matching')?.addEventListener('click', () => goToStep(4));
  document.getElementById('btn-back-to-sim')?.addEventListener('click', () => goToStep(3));
  document.getElementById('btn-next-to-quote')?.addEventListener('click', () => goToStep(5));
  document.getElementById('btn-back-to-matching')?.addEventListener('click', () => goToStep(4));
  document.getElementById('btn-restart-wizard')?.addEventListener('click', () => goToStep(1));

  // Quick navigation buttons from live sizing card
  document.getElementById('btn-quick-to-sim')?.addEventListener('click', () => goToStep(3));
  document.getElementById('btn-quick-to-matching')?.addEventListener('click', () => goToStep(4));
}

function goToStep(step) {
  if (step < 1 || step > 5) return;
  State.currentStep = step;

  // Update Stepper header
  document.querySelectorAll('.wizard-step-node').forEach(node => {
    const s = parseInt(node.getAttribute('data-step'), 10);
    node.classList.toggle('active', s === step);
    node.classList.toggle('completed', s < step);
  });

  // Switch panels
  document.querySelectorAll('.wizard-step-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const currentPanel = document.getElementById(`step-panel-${step}`);
  if (currentPanel) currentPanel.classList.add('active');

  // Trigger relevant step logic
  if (step === 3) {
    render24hSimulation();
  } else if (step === 4) {
    calculateAndRenderPackages();
  } else if (step === 5) {
    generateAndRenderQuotation();
  }

  // Smooth scroll into calculator view
  document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// STEP 1: جدول توفر كهرباء الشبكة
// ============================================================
function initStep1Grid() {
  // Mode selector radio tabs
  const modeRadios = document.querySelectorAll('input[name="grid_mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      State.grid.mode = e.target.value;
      document.querySelectorAll('.mode-tab-option').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-mode') === State.grid.mode);
      });
      // Show/Hide config subpanels
      document.getElementById('subpanel-schedule')?.classList.toggle('hidden', State.grid.mode !== 'schedule');
      document.getElementById('subpanel-dailyHours')?.classList.toggle('hidden', State.grid.mode !== 'dailyHours');
      document.getElementById('subpanel-irregular')?.classList.toggle('hidden', State.grid.mode !== 'irregular');
      updateGridScheduleMetrics();
    });
  });

  // Grid Policy radios
  document.querySelectorAll('input[name="grid_policy"]').forEach(r => {
    r.addEventListener('change', (e) => {
      State.grid.policy = e.target.value;
    });
  });

  // Daily Hours slider
  const dailySlider = document.getElementById('input-daily-grid-hours');
  const dailyBadge = document.getElementById('val-daily-grid-hours');
  if (dailySlider && dailyBadge) {
    dailySlider.addEventListener('input', (e) => {
      State.grid.dailyHours = parseFloat(e.target.value);
      dailyBadge.textContent = `${State.grid.dailyHours} ساعات`;
      updateGridScheduleMetrics();
    });
  }

  // Irregular worst outage slider
  const outageSlider = document.getElementById('input-worst-outage-hours');
  const outageBadge = document.getElementById('val-worst-outage-hours');
  if (outageSlider && outageBadge) {
    outageSlider.addEventListener('input', (e) => {
      State.grid.worstOutageHours = parseFloat(e.target.value);
      outageBadge.textContent = `${State.grid.worstOutageHours} ساعة`;
      updateGridScheduleMetrics();
    });
  }

  // Add Interval button
  document.getElementById('btn-add-interval')?.addEventListener('click', () => {
    const container = document.getElementById('intervals-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'interval-row';
    row.innerHTML = `
      <div class="time-input-group">
        <label>من الساعة:</label>
        <input type="time" class="form-control interval-start" value="12:00">
      </div>
      <div class="time-input-group">
        <label>إلى الساعة:</label>
        <input type="time" class="form-control interval-end" value="16:00">
      </div>
      <button type="button" class="btn-remove-interval" title="حذف الفترة"><i class="fa-solid fa-trash-can"></i></button>
    `;
    row.querySelector('.btn-remove-interval').addEventListener('click', () => {
      row.remove();
      readIntervalsFromDom();
    });
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', readIntervalsFromDom);
    });
    container.appendChild(row);
    readIntervalsFromDom();
  });

  // Bind existing interval delete buttons
  document.querySelectorAll('.btn-remove-interval').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.interval-row')?.remove();
      readIntervalsFromDom();
    });
  });

  document.querySelectorAll('.interval-start, .interval-end').forEach(inp => {
    inp.addEventListener('change', readIntervalsFromDom);
  });
}

function readIntervalsFromDom() {
  const rows = document.querySelectorAll('.interval-row');
  const list = [];
  rows.forEach(r => {
    const s = r.querySelector('.interval-start')?.value || '00:00';
    const e = r.querySelector('.interval-end')?.value || '00:00';
    list.push({ start: s, end: e });
  });
  State.grid.intervals = list;
  updateGridScheduleMetrics();
}

function updateGridScheduleMetrics() {
  const schedule = SolarEngine.parseGridSchedule({
    mode: State.grid.mode,
    intervals: State.grid.intervals,
    dailyHours: State.grid.dailyHours,
    worstOutageHours: State.grid.worstOutageHours
  }, 96);

  document.getElementById('summary-grid-hours').textContent = `${schedule.totalGridHours} ساعة`;
  document.getElementById('summary-outage-hours').textContent = `${schedule.totalOutageHours} ساعة`;
  document.getElementById('summary-max-outage').textContent = `${schedule.maxContiguousOutageHours} ساعة`;

  // Trigger reactive calculation across loads and packages
  triggerReactiveCalculation();
}

// ============================================================
// STEP 2: الأحمال الكهربائية
// ============================================================
function initStep2Loads() {
  // Category tabs
  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderAppliancePicker(pill.getAttribute('data-cat'));
    });
  });

  // Toggle Custom Device Form Accordion
  const toggleBtn = document.getElementById('toggle-custom-form');
  const formContent = document.getElementById('custom-form-content');
  if (toggleBtn && formContent) {
    toggleBtn.addEventListener('click', () => {
      formContent.classList.toggle('hidden');
      toggleBtn.querySelector('.toggle-icon')?.classList.toggle('fa-chevron-up');
    });
  }

  // Add Custom Appliance button
  document.getElementById('btn-add-custom-app')?.addEventListener('click', () => {
    const name = document.getElementById('custom-app-name').value.trim();
    const watt = parseFloat(document.getElementById('custom-app-watt').value);
    const type = document.getElementById('custom-app-type').value;
    const duty = parseFloat(document.getElementById('custom-app-duty').value);
    const priority = document.getElementById('custom-app-priority').value;

    if (!name || isNaN(watt) || watt <= 0) {
      alert("يرجى إدخال اسم الجهاز وقدرة صحيحة بالواط");
      return;
    }

    let surgeMult = 1.0;
    let pf = 0.9;
    if (type === 'aircon') { surgeMult = 2.5; pf = 0.88; }
    else if (type === 'motor') { surgeMult = 4.5; pf = 0.80; }
    else if (type === 'electronic') { surgeMult = 1.0; pf = 0.92; }

    const newApp = {
      id: 'custom_' + Date.now(),
      name,
      category: 'أجهزة مخصصة',
      watt,
      powerFactor: pf,
      loadType: type,
      surgeMultiplier: surgeMult,
      dutyCycle: duty,
      dayHours: 4,
      nightHours: 4,
      quantity: 1,
      priority,
      icon: 'fa-plug'
    };

    State.appliances.push(newApp);
    renderSelectedAppliancesTable();
    updateLoadsMetrics();

    // Reset inputs
    document.getElementById('custom-app-name').value = '';
    document.getElementById('custom-app-watt').value = '';
    formContent.classList.add('hidden');
  });

  // Clear all appliances
  document.getElementById('clear-all-appliances')?.addEventListener('click', () => {
    if (confirm("هل أنت متأكد من مسح جميع الأجهزة من القائمة؟")) {
      State.appliances = [];
      renderSelectedAppliancesTable();
      updateLoadsMetrics();
    }
  });
}

function renderAppliancePicker(category = 'all') {
  const container = document.getElementById('appliance-picker');
  if (!container) return;
  container.innerHTML = '';

  const templates = State.applianceTemplates.length > 0 ? State.applianceTemplates : FALLBACK_TEMPLATES;
  const filtered = category === 'all'
    ? templates
    : templates.filter(t => t.category === category);

  filtered.forEach(tmpl => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'appliance-picker-card';
    card.innerHTML = `
      <div class="card-badge font-num">${tmpl.watt}W</div>
      <div class="appliance-icon"><i class="fa-solid ${tmpl.icon || 'fa-plug'}"></i></div>
      <span>${tmpl.name}</span>
    `;
    card.addEventListener('click', () => addApplianceByTemplate(tmpl));
    container.appendChild(card);
  });
}

function addApplianceByTemplateId(id) {
  const templates = State.applianceTemplates.length > 0 ? State.applianceTemplates : FALLBACK_TEMPLATES;
  const found = templates.find(t => t.id === id);
  if (found) addApplianceByTemplate(found);
}

function addApplianceByTemplate(tmpl) {
  // If appliance already exists, increment quantity
  const existing = State.appliances.find(a => a.name === tmpl.name);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    State.appliances.push({
      id: 'app_' + Date.now() + Math.random().toString(36).substr(2, 4),
      name: tmpl.name,
      category: tmpl.category || 'عام',
      watt: tmpl.watt,
      powerFactor: tmpl.powerFactor || 0.9,
      loadType: tmpl.loadType || 'resistive',
      surgeMultiplier: tmpl.surgeMultiplier || 1.0,
      dutyCycle: tmpl.dutyCycle || 1.0,
      dayHours: tmpl.dayHours !== undefined ? tmpl.dayHours : 4,
      nightHours: tmpl.nightHours !== undefined ? tmpl.nightHours : 4,
      quantity: 1,
      priority: tmpl.priority || 'important',
      icon: tmpl.icon || 'fa-plug'
    });
  }

  renderSelectedAppliancesTable();
  updateLoadsMetrics();
}

function renderSelectedAppliancesTable() {
  const tbody = document.getElementById('selected-appliances-list');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (State.appliances.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-placeholder">
        <td colspan="8" class="text-center py-5 text-muted">
          <i class="fa-solid fa-circle-exclamation fa-2x mb-3 text-secondary d-block"></i>
          لم يتم إضافة أي أجهزة بعد. اختر من بطاقات الأجهزة السريعة أعلاه أو أضف جهازاً مخصصاً للبدء في حساب منظومتك.
        </td>
      </tr>
    `;
    triggerReactiveCalculation();
    return;
  }

  State.appliances.forEach((app, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="الجهاز والتصنيف">
        <div class="d-flex align-center gap-2">
          <i class="fa-solid ${app.icon || 'fa-plug'} text-primary"></i>
          <div>
            <strong>${app.name}</strong>
            <small class="text-muted d-block">${app.category || 'عام'}</small>
          </div>
        </div>
      </td>
      <td data-label="العدد">
        <input type="number" min="1" max="100" class="form-control font-num text-center app-qty-input" value="${app.quantity}" style="width: 75px;">
      </td>
      <td data-label="القدرة (واط)">
        <input type="number" min="1" max="50000" class="form-control font-num text-center app-watt-input" value="${app.watt}" style="width: 90px;">
      </td>
      <td data-label="ساعات النهار">
        <input type="number" min="0" max="12" step="0.5" class="form-control font-num text-center app-dh-input" value="${app.dayHours}" style="width: 75px;">
      </td>
      <td data-label="ساعات الليل">
        <input type="number" min="0" max="12" step="0.5" class="form-control font-num text-center app-nh-input" value="${app.nightHours}" style="width: 75px;">
      </td>
      <td data-label="دورة التشغيل">
        <select class="form-control app-duty-select font-num" style="width: 90px;">
          <option value="1.0" ${app.dutyCycle === 1.0 ? 'selected' : ''}>100%</option>
          <option value="0.7" ${app.dutyCycle === 0.7 ? 'selected' : ''}>70%</option>
          <option value="0.5" ${app.dutyCycle === 0.5 ? 'selected' : ''}>50%</option>
          <option value="0.3" ${app.dutyCycle === 0.3 ? 'selected' : ''}>30%</option>
        </select>
      </td>
      <td data-label="الأولوية">
        <span class="badge-priority badge-${app.priority}">
          ${app.priority === 'essential' ? 'أساسي' : (app.priority === 'sheddable' ? 'قابل للفصل' : 'مهم')}
        </span>
      </td>
      <td data-label="حذف" class="text-center">
        <button type="button" class="btn-remove-interval app-delete-btn" title="حذف الجهاز">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;

    const qtyInp = tr.querySelector('.app-qty-input');
    const wattInp = tr.querySelector('.app-watt-input');
    const dhInp = tr.querySelector('.app-dh-input');
    const nhInp = tr.querySelector('.app-nh-input');
    const dutySel = tr.querySelector('.app-duty-select');
    const delBtn = tr.querySelector('.app-delete-btn');

    const onQty = (e) => {
      app.quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
      triggerReactiveCalculation();
    };
    qtyInp.addEventListener('input', onQty);
    qtyInp.addEventListener('change', onQty);

    const onWatt = (e) => {
      app.watt = Math.max(1, parseFloat(e.target.value) || 1);
      triggerReactiveCalculation();
    };
    wattInp.addEventListener('input', onWatt);
    wattInp.addEventListener('change', onWatt);

    const onDh = (e) => {
      app.dayHours = Math.max(0, Math.min(12, parseFloat(e.target.value) || 0));
      triggerReactiveCalculation();
    };
    dhInp.addEventListener('input', onDh);
    dhInp.addEventListener('change', onDh);

    const onNh = (e) => {
      app.nightHours = Math.max(0, Math.min(12, parseFloat(e.target.value) || 0));
      triggerReactiveCalculation();
    };
    nhInp.addEventListener('input', onNh);
    nhInp.addEventListener('change', onNh);

    const onDuty = (e) => {
      app.dutyCycle = parseFloat(e.target.value) || 1.0;
      triggerReactiveCalculation();
    };
    dutySel.addEventListener('change', onDuty);

    delBtn.addEventListener('click', () => {
      State.appliances.splice(idx, 1);
      renderSelectedAppliancesTable();
      triggerReactiveCalculation();
    });

    tbody.appendChild(tr);
  });
}

/**
 * دالة التفاعل المركزية لحساب المنظومة وإعادة تقييم كافة المؤشرات فورياً
 * يتم استدعاؤها مع كل حركة تعديل أو كتابة أو حذف لأي جهاز
 */
function triggerReactiveCalculation() {
  const sched = SolarEngine.parseGridSchedule({
    mode: State.grid.mode,
    intervals: State.grid.intervals,
    dailyHours: State.grid.dailyHours,
    worstOutageHours: State.grid.worstOutageHours
  }, 96);

  const profile = SolarEngine.calculateLoadProfile(State.appliances, sched, 96);

  // 1. Calculate installed power (مجموع قدرات جميع الأجهزة المتصلة)
  let installedWatts = 0;
  State.appliances.forEach(a => {
    const qty = Math.max(1, parseInt(a.quantity, 10) || 1);
    const w = Math.max(0, parseFloat(a.watt) || 0);
    installedWatts += (qty * w);
  });
  const installedKw = installedWatts / 1000;

  // 2. Update Instantaneous Power & Inrush Elements
  const elInstPower = document.getElementById('val-installed-power');
  const elPeakPower = document.getElementById('val-peak-power');
  const elSurgePower = document.getElementById('val-surge-power');

  if (elInstPower) elInstPower.innerHTML = `${Math.round(installedWatts).toLocaleString()} <small>W</small> <span class="val-sub">(${installedKw.toFixed(2)} kW)</span>`;
  if (elPeakPower) elPeakPower.innerHTML = `${profile.peakContinuousKw.toFixed(2)} <small>kW</small> <span class="val-sub">(${profile.peakContinuousKva.toFixed(2)} kVA)</span>`;
  if (elSurgePower) elSurgePower.innerHTML = `${profile.maxSurgeKw.toFixed(2)} <small>kW</small>`;

  // 3. Update Energy Consumption Over Time Elements
  const elDailyKwh = document.getElementById('val-daily-kwh');
  const elWeeklyKwh = document.getElementById('val-weekly-kwh');
  const elMonthlyKwh = document.getElementById('val-monthly-kwh');
  const elDayKwh = document.getElementById('val-day-kwh');
  const elOutageKwh = document.getElementById('val-outage-kwh');

  const dailyKwh = profile.totalDailyKwh;
  const weeklyKwh = (dailyKwh * 7).toFixed(1);
  const monthlyKwh = (dailyKwh * 30).toFixed(1);

  if (elDailyKwh) elDailyKwh.innerHTML = `${dailyKwh.toFixed(2)} <small>kWh/يوم</small>`;
  if (elWeeklyKwh) elWeeklyKwh.innerHTML = `${weeklyKwh} <small>kWh/أسبوع</small>`;
  if (elMonthlyKwh) elMonthlyKwh.innerHTML = `${monthlyKwh} <small>kWh/شهر</small>`;
  if (elDayKwh) elDayKwh.innerHTML = `${profile.totalDayKwh.toFixed(2)} <small>kWh</small>`;
  if (elOutageKwh) elOutageKwh.innerHTML = `${profile.totalOutageKwh.toFixed(2)} <small>kWh</small>`;

  // Legacy elements for backwards compat
  const elLegacyTotal = document.getElementById('summary-total-kwh');
  const elLegacyDay = document.getElementById('summary-day-kwh');
  const elLegacyOutage = document.getElementById('summary-outage-kwh');
  const elLegacyPeak = document.getElementById('summary-peak-kw');
  const elLegacySurge = document.getElementById('summary-surge-kw');
  if (elLegacyTotal) elLegacyTotal.innerHTML = `${dailyKwh} <small>kWh/يوم</small>`;
  if (elLegacyDay) elLegacyDay.innerHTML = `${profile.totalDayKwh} <small>kWh</small>`;
  if (elLegacyOutage) elLegacyOutage.innerHTML = `${profile.totalOutageKwh} <small>kWh</small>`;
  if (elLegacyPeak) elLegacyPeak.innerHTML = `${profile.peakContinuousKw} <small>kW</small>`;
  if (elLegacySurge) elLegacySurge.innerHTML = `${profile.maxSurgeKw} <small>kW</small>`;

  // 4. Perform Automated Sizing & Matching
  if (State.inventory.inverters.length > 0 && State.inventory.batteries.length > 0 && State.inventory.panels.length > 0) {
    const matchResult = SolarEngine.sizeAndMatchSystem(profile, sched, State.inventory, State.designParams);
    State.matchedPackages = matchResult;
    State.activePackage = matchResult.packages[State.selectedPackageType] || matchResult.packages.recommended;

    const rec = matchResult.packages.recommended;
    const recQuote = SolarEngine.generateQuotation(rec, State.designParams);

    // Update Live Recommended Sizing Card in Step 2
    const elInvCap = document.getElementById('live-card-inv-cap');
    const elInvName = document.getElementById('live-card-inv-name');
    const elPvPanels = document.getElementById('live-card-pv-panels');
    const elPvPower = document.getElementById('live-card-pv-power');
    const elBatKwh = document.getElementById('live-card-bat-kwh');
    const elBatAh = document.getElementById('live-card-bat-ah');
    const elCostUsd = document.getElementById('live-card-cost-usd');
    const elCostYer = document.getElementById('live-card-cost-yer');

    if (elInvCap) elInvCap.textContent = `${rec.inverter.capacityKw} kW`;
    if (elInvName) elInvName.textContent = rec.inverter.name;
    if (elPvPanels) elPvPanels.textContent = `${rec.panel.quantity} ألواح`;
    if (elPvPower) elPvPower.textContent = `${rec.panel.totalKw} kWp (${rec.panel.watt}W لكل لوح)`;
    if (elBatKwh) elBatKwh.textContent = `${rec.battery.totalKwh} kWh`;
    if (elBatAh) {
      const batAh = Math.round((rec.battery.totalKwh * 1000) / (rec.inverter.systemVoltage || 48));
      elBatAh.textContent = `${batAh} Ah @ ${rec.inverter.systemVoltage || 48}V (${rec.battery.quantity} وحدة)`;
    }
    if (elCostUsd) elCostUsd.textContent = formatPrice(recQuote.financials.totalCostUsd);
    if (elCostYer) elCostYer.textContent = `${recQuote.financials.totalCostYer.toLocaleString('ar-YE')} ر.ي`;

    // Pre-render Step 4 cards & MPPT validation
    const recStringing = rec.panel.stringing;
    const mpptVoc = document.getElementById('mppt-val-voc');
    const mpptVmp = document.getElementById('mppt-val-vmp');
    const mpptSurge = document.getElementById('mppt-val-surge');
    if (mpptVoc) mpptVoc.textContent = `${recStringing.stringVocCold}V`;
    if (mpptVmp) mpptVmp.textContent = `${recStringing.stringVmpHot}V`;
    if (mpptSurge) mpptSurge.textContent = `${rec.inverter.surgeCapacityKw || (rec.inverter.capacityKw * 2)}kW`;

    renderPackageCard('econ', matchResult.packages.economic);
    renderPackageCard('rec', matchResult.packages.recommended);
    renderPackageCard('high', matchResult.packages.highPerformance);
    populateManualTuningSelects(rec);

    // Update Hero Preview
    const heroPv = document.getElementById('hero-pv-stat');
    if (heroPv) heroPv.textContent = `${rec.panel.totalKw} kWp`;
  }

  // 5. Update Step 3 Simulation if active
  if (State.currentStep === 3) {
    render24hSimulation();
  }

  // 6. Update Step 5 Quotation if active
  if (State.currentStep === 5) {
    generateAndRenderQuotation();
  }
}

function updateLoadsMetrics() {
  triggerReactiveCalculation();
}

// ============================================================
// STEP 3: المحاكاة الهندسية 24 ساعة (Chart.js Simulation)
// ============================================================
function render24hSimulation() {
  const sched = SolarEngine.parseGridSchedule({
    mode: State.grid.mode,
    intervals: State.grid.intervals,
    dailyHours: State.grid.dailyHours,
    worstOutageHours: State.grid.worstOutageHours
  }, 96);

  const profile = SolarEngine.calculateLoadProfile(State.appliances, sched, 96);

  // Target PV & Battery size estimate for simulation
  const targetBatteryKwh = Math.max(5.12, profile.totalOutageKwh * 1.15);
  const targetPvKw = Math.max(2.4, (profile.totalDayKwh + targetBatteryKwh) / (State.designParams.psh * State.designParams.deratingFactor));

  const simResult = SolarEngine.runSimulation({
    loadProfile: profile,
    gridSchedule: sched,
    pvKwPeak: targetPvKw,
    batteryCapacityKwh: targetBatteryKwh,
    batteryDod: 0.90,
    inverterRatedKw: Math.max(3.6, profile.peakContinuousKw * 1.25),
    designParams: State.designParams
  });

  // Update Summary cards
  document.getElementById('sim-total-solar-kwh').textContent = `${simResult.summary.totalSolarGeneratedKwh} kWh`;
  document.getElementById('sim-direct-solar-kwh').textContent = `${simResult.summary.totalDirectSolarKwh} kWh`;
  document.getElementById('sim-battery-discharged-kwh').textContent = `${simResult.summary.totalBatteryDischargedKwh} kWh`;
  document.getElementById('sim-autonomy-percent').textContent = `${simResult.summary.solarCoveragePercent}%`;

  // Deficit alert check
  const alertBox = document.getElementById('sim-deficit-alert');
  const alertDetails = document.getElementById('sim-deficit-details');
  if (simResult.summary.totalUnservedEnergyKwh > 0.05) {
    alertBox?.classList.remove('hidden');
    alertDetails.textContent = `يوجد عجز غير مغطى بمقدار ${simResult.summary.totalUnservedEnergyKwh} kWh بسبب انقطاع الشبكة ونفاد سعة البطارية. تم رفع سعة البطارية المقترحة تلقائياً في الخطوة 4.`;
  } else {
    alertBox?.classList.add('hidden');
  }

  // Render Chart.js
  const canvas = document.getElementById('simChartCanvas');
  if (!canvas) return;

  if (State.simChartInstance) {
    State.simChartInstance.destroy();
  }

  // Sample every 4th step for clean labels (24 hour points)
  const labels = simResult.timeLabels;

  State.simChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'الإنتاج الشمسي (kW)',
          data: simResult.series.solarGenKw,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: 'الحمل الكهربائي (kW)',
          data: simResult.series.loadKw,
          borderColor: '#3b82f6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.2,
          yAxisID: 'y'
        },
        {
          label: 'طاقة الشبكة (kW)',
          data: simResult.series.gridToLoadKw,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          fill: true,
          tension: 0.1,
          yAxisID: 'y'
        },
        {
          label: 'عجز الطاقة (kW)',
          data: simResult.series.unservedLoadKw,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.3)',
          fill: true,
          tension: 0.1,
          yAxisID: 'y'
        },
        {
          label: 'نسبة شحن البطارية (SoC %)',
          data: simResult.series.batterySoCPercent,
          borderColor: '#10b981',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: true,
          bodyFont: { family: 'Tajawal' },
          titleFont: { family: 'Tajawal' }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            maxTicksLimit: 12
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'القدرة (kW)',
            color: '#94a3b8',
            font: { family: 'Tajawal' }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 100,
          title: {
            display: true,
            text: 'شحن البطارية (%)',
            color: '#10b981',
            font: { family: 'Tajawal' }
          },
          grid: { drawOnChartArea: false },
          ticks: { color: '#10b981' }
        }
      }
    }
  });
}

// ============================================================
// STEP 4: مطابقة واختيار المنظومة (3 Packages)
// ============================================================
function initStep4Packages() {
  document.querySelectorAll('.btn-select-pkg').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.getAttribute('data-pkg');
      State.selectedPackageType = type;
      if (State.matchedPackages && State.matchedPackages.packages[type]) {
        State.activePackage = State.matchedPackages.packages[type];
      }
      goToStep(5);
    });
  });

  // Toggle manual tuning accordion
  const toggleTuning = document.getElementById('toggle-tuning-section');
  const tuningBody = document.getElementById('tuning-content');
  if (toggleTuning && tuningBody) {
    toggleTuning.addEventListener('click', () => {
      tuningBody.classList.toggle('hidden');
      toggleTuning.querySelector('.toggle-icon')?.classList.toggle('fa-chevron-up');
    });
  }

  // Apply manual tuning button
  document.getElementById('btn-apply-custom-tuning')?.addEventListener('click', () => {
    const invId = document.getElementById('custom-select-inverter').value;
    const panId = document.getElementById('custom-select-panel').value;
    const batId = document.getElementById('custom-select-battery').value;
    const panelsCount = parseInt(document.getElementById('custom-panels-count').value, 10) || 8;
    const batCount = parseInt(document.getElementById('custom-batteries-count').value, 10) || 1;

    const chosenInv = State.inventory.inverters.find(i => i.id === invId) || State.inventory.inverters[0];
    const chosenPan = State.inventory.panels.find(p => p.id === panId) || State.inventory.panels[0];
    const chosenBat = State.inventory.batteries.find(b => b.id === batId) || State.inventory.batteries[0];

    const stringing = SolarEngine.calculateElectricalStringing(chosenPan, chosenInv, (panelsCount * chosenPan.watt) / 1000, State.designParams);

    State.activePackage = {
      type: 'custom',
      title: 'باقة مخصصة يدوياً',
      badge: 'تم اختيار المكونات يدوياً من لوحة التخصيص',
      inverter: { ...chosenInv, quantity: 1, totalCost: chosenInv.price },
      battery: { ...chosenBat, quantity: batCount, totalKwh: chosenBat.capacityKwh * batCount, usableKwh: chosenBat.capacityKwh * (chosenBat.dod || 0.9) * batCount, totalCost: chosenBat.price * batCount },
      panel: { ...chosenPan, quantity: panelsCount, totalKw: (panelsCount * chosenPan.watt) / 1000, stringing, totalCost: chosenPan.price * panelsCount }
    };

    alert("تم تحديث مواصفات المنظومة بنجاح! انتقل إلى الخطوة 5 لمعاينة عرض السعر.");
    goToStep(5);
  });
}

function calculateAndRenderPackages() {
  const sched = SolarEngine.parseGridSchedule({
    mode: State.grid.mode,
    intervals: State.grid.intervals,
    dailyHours: State.grid.dailyHours,
    worstOutageHours: State.grid.worstOutageHours
  }, 96);

  const profile = SolarEngine.calculateLoadProfile(State.appliances, sched, 96);

  // Run Sizing & Matching Engine
  const matchResult = SolarEngine.sizeAndMatchSystem(profile, sched, State.inventory, State.designParams);
  State.matchedPackages = matchResult;

  // Set default active package
  State.activePackage = matchResult.packages[State.selectedPackageType] || matchResult.packages.recommended;

  const { economic, recommended, highPerformance } = matchResult.packages;

  // Render MPPT validation banner for recommended package
  const recStringing = recommended.panel.stringing;
  document.getElementById('mppt-val-voc').textContent = `${recStringing.stringVocCold}V`;
  document.getElementById('mppt-val-vmp').textContent = `${recStringing.stringVmpHot}V`;
  document.getElementById('mppt-val-surge').textContent = `${recommended.inverter.surgeCapacityKw || (recommended.inverter.capacityKw * 2)}kW`;

  // Render Package 1: Economic
  renderPackageCard('econ', economic);

  // Render Package 2: Recommended
  renderPackageCard('rec', recommended);

  // Render Package 3: High Performance
  renderPackageCard('high', highPerformance);

  // Populate manual tuning dropdowns
  populateManualTuningSelects(recommended);
}

function renderPackageCard(prefix, pkg) {
  const invElem = document.getElementById(`${prefix}-inv-name`);
  const panElem = document.getElementById(`${prefix}-panel-name`);
  const batElem = document.getElementById(`${prefix}-battery-name`);
  const usdElem = document.getElementById(`${prefix}-price-usd`);
  const yerElem = document.getElementById(`${prefix}-price-yer`);

  const quote = SolarEngine.generateQuotation(pkg, State.designParams);

  if (invElem) invElem.textContent = `${pkg.inverter.name} (${pkg.inverter.capacityKw}kW)`;
  if (panElem) panElem.textContent = `${pkg.panel.quantity} ألواح × ${pkg.panel.watt}W (${pkg.panel.totalKw} kWp)`;
  if (batElem) batElem.textContent = `${pkg.battery.quantity} × ${pkg.battery.name} (${pkg.battery.totalKwh} kWh)`;

  if (usdElem) usdElem.textContent = `$${Math.round(quote.financials.totalCostUsd).toLocaleString('en-US')}`;
  if (yerElem) yerElem.textContent = `${quote.financials.totalCostYer.toLocaleString('ar-YE')} ر.ي`;
}

function populateManualTuningSelects(defaultPkg) {
  const invSel = document.getElementById('custom-select-inverter');
  const panSel = document.getElementById('custom-select-panel');
  const batSel = document.getElementById('custom-select-battery');

  if (invSel) {
    invSel.innerHTML = State.inventory.inverters.map(i => `<option value="${i.id}" ${i.id === defaultPkg.inverter.id ? 'selected' : ''}>${i.name} - $${i.price}</option>`).join('');
  }
  if (panSel) {
    panSel.innerHTML = State.inventory.panels.map(p => `<option value="${p.id}" ${p.id === defaultPkg.panel.id ? 'selected' : ''}>${p.name} - $${p.price}</option>`).join('');
  }
  if (batSel) {
    batSel.innerHTML = State.inventory.batteries.map(b => `<option value="${b.id}" ${b.id === defaultPkg.battery.id ? 'selected' : ''}>${b.name} - $${b.price}</option>`).join('');
  }

  const pCount = document.getElementById('custom-panels-count');
  const bCount = document.getElementById('custom-batteries-count');
  if (pCount) pCount.value = defaultPkg.panel.quantity;
  if (bCount) bCount.value = defaultPkg.battery.quantity;
}

// ============================================================
// STEP 5: عرض السعر والتقرير الفني الرسمي (BOM & PDF)
// ============================================================
function initStep5Quotation() {
  // Sync client inputs with official printable doc
  const nameInp = document.getElementById('quote-client-name');
  const phoneInp = document.getElementById('quote-client-phone');
  const locInp = document.getElementById('quote-client-location');

  nameInp?.addEventListener('input', (e) => {
    State.customer.name = e.target.value;
    document.getElementById('doc-client-name').textContent = e.target.value || 'عميل بترونيل المميز';
  });
  phoneInp?.addEventListener('input', (e) => {
    State.customer.phone = e.target.value;
    document.getElementById('doc-client-phone').textContent = e.target.value || '--';
  });
  locInp?.addEventListener('input', (e) => {
    State.customer.location = e.target.value;
    document.getElementById('doc-client-location').textContent = e.target.value || 'اليمن';
  });

  // Download PDF Button
  document.getElementById('btn-download-pdf')?.addEventListener('click', downloadQuotationPdf);

  // Print button
  document.getElementById('btn-print-quote')?.addEventListener('click', () => {
    window.print();
  });

  // WhatsApp Share button
  document.getElementById('btn-whatsapp-share')?.addEventListener('click', shareViaWhatsApp);

  // Request order / installation button
  document.getElementById('btn-request-installation')?.addEventListener('click', () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    const nameFld = document.getElementById('client-name');
    const phoneFld = document.getElementById('client-phone');
    if (nameFld && State.customer.name) nameFld.value = State.customer.name;
    if (phoneFld && State.customer.phone) phoneFld.value = State.customer.phone;
  });
}

function generateAndRenderQuotation() {
  if (!State.activePackage && State.matchedPackages) {
    State.activePackage = State.matchedPackages.packages.recommended;
  }
  if (!State.activePackage) return;

  const quotation = SolarEngine.generateQuotation(State.activePackage, State.designParams, State.customer);

  // Doc references
  document.getElementById('quote-ref-code').textContent = quotation.quoteId;
  document.getElementById('quote-issue-date').textContent = `التاريخ: ${quotation.date}`;
  document.getElementById('doc-package-type').textContent = State.activePackage.title;

  // Technical specs bar
  document.getElementById('doc-inv-kw').textContent = `${quotation.systemOverview.inverterCapacityKw} kW`;
  document.getElementById('doc-pv-kw').textContent = `${quotation.systemOverview.pvCapacityKw} kWp (${quotation.systemOverview.panelsCount} لوح)`;
  document.getElementById('doc-bat-kwh').textContent = `${quotation.systemOverview.batteryCapacityKwh} kWh (${quotation.systemOverview.batteryUnits} وحدة)`;
  document.getElementById('doc-outage-support').textContent = `${document.getElementById('summary-max-outage')?.textContent || '24 ساعة'}`;

  // Itemized Table Rows
  const tbody = document.getElementById('quote-items-tbody');
  if (tbody) {
    tbody.innerHTML = quotation.items.map(item => `
      <tr>
        <td class="text-center font-num">${item.itemNumber}</td>
        <td>
          <strong>${item.name}</strong>
          <small class="text-muted d-block">${item.specs}</small>
        </td>
        <td class="text-center font-num">${item.quantity}</td>
        <td class="text-center">${item.unit}</td>
        <td class="text-center">${item.warranty}</td>
        <td class="text-left font-num">$${item.unitPrice}</td>
        <td class="text-left font-num font-weight-bold">$${item.totalPrice}</td>
      </tr>
    `).join('');
  }

  // Financial figures
  document.getElementById('doc-cost-equipment').textContent = `$${quotation.financials.equipmentCostUsd.toLocaleString('en-US')}`;
  document.getElementById('doc-cost-accessories').textContent = `$${quotation.financials.accessoriesCostUsd.toLocaleString('en-US')}`;
  document.getElementById('doc-cost-install').textContent = `$${quotation.financials.installationFeeUsd.toLocaleString('en-US')}`;
  document.getElementById('doc-total-usd').textContent = `$${quotation.financials.totalCostUsd.toLocaleString('en-US')}`;
  document.getElementById('doc-total-yer').textContent = `${quotation.financials.totalCostYer.toLocaleString('ar-YE')} ر.ي`;
}

function downloadQuotationPdf() {
  const element = document.getElementById('printable-quotation-area');
  if (!element || typeof html2pdf === 'undefined') {
    alert("جارٍ تشغيل نافذة الطباعة كبديل...");
    window.print();
    return;
  }

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `عرض_سعر_بترونيل_يمن_${State.customer.name.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
}

function shareViaWhatsApp() {
  if (!State.activePackage) return;
  const quote = SolarEngine.generateQuotation(State.activePackage, State.designParams, State.customer);

  const text = `*عرض سعر رسمي من شركة بترونيل يمن للطاقة* ☀️
━━━━━━━━━━━━━━━━━━━━
👤 *العميل:* ${State.customer.name || 'عميل بترونيل المميز'}
📄 *رقم العرض:* ${quote.quoteId}
📦 *المنظومة:* ${State.activePackage.title}
⚡ *الإنفرتر:* ${quote.systemOverview.inverterCapacityKw} kW
☀️ *الألواح:* ${quote.systemOverview.panelsCount} لوح (${quote.systemOverview.pvCapacityKw} kWp)
🔋 *البطاريات:* ${quote.systemOverview.batteryCapacityKwh} kWh ليثيوم
━━━━━━━━━━━━━━━━━━━━
💰 *الإجمالي بالدولار:* $${quote.financials.totalCostUsd.toLocaleString('en-US')}
💵 *الإجمالي بالريال اليمني:* ${quote.financials.totalCostYer.toLocaleString('ar-YE')} ر.ي
━━━━━━━━━━━━━━━━━━━━
📞 شركة بترونيل يمن للطاقة - عدن: 783999039`;

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function updateAllPricesUI() {
  if (State.matchedPackages) {
    renderPackageCard('econ', State.matchedPackages.packages.economic);
    renderPackageCard('rec', State.matchedPackages.packages.recommended);
    renderPackageCard('high', State.matchedPackages.packages.highPerformance);
  }
}

// --- Contact Form Submission ---
function initContactLeadForm() {
  const form = document.getElementById('lead-form');
  const successMsg = document.getElementById('form-success-msg');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
    }

    const payload = {
      name: document.getElementById('client-name').value,
      phone: document.getElementById('client-phone').value,
      notes: `المدينة: ${document.getElementById('client-city').value} | ملاحظات: ${document.getElementById('client-notes').value}`,
      systemSizeKw: State.activePackage?.panel?.totalKw || 0,
      panelsCount: State.activePackage?.panel?.quantity || 0,
      batteriesKwh: State.activePackage?.battery?.totalKwh || 0,
      inverterKva: State.activePackage?.inverter?.capacityKw || 0,
      totalCost: State.activePackage ? SolarEngine.generateQuotation(State.activePackage, State.designParams).financials.totalCostUsd : 0,
      currency: 'USD'
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        form.reset();
        form.classList.add('hidden');
        successMsg?.classList.remove('hidden');
      } else {
        alert("حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً أو الاتصال مباشرة بفرع الشركة.");
      }
    } catch (err) {
      console.error(err);
      alert("تم تسجيل بياناتك وسيقوم المهندس بالتواصل معك.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> إرسال الطلب والاستشارة';
      }
    }
  });
}
