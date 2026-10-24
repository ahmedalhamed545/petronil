/**
 * Embedded Universal SolarEngine Fallback
 * تضمن تشغيل محرك الحسابات حتى لو تم رفع الملفات بدون مجلد engine
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
    quoteValidityDays: 15,        // مدة صلاحية عرض السعر بالأيام (قابلة للتعديل من لوحة الإدارة)
    defaultCurrency: 'USD',       // العملة الافتراضية
    enableYerDisplay: false,      // إظهار الريال اليمني فقط عند التفعيل
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
      const qty = Math.max(1, parseInt(app.quantity !== undefined ? app.quantity : (app.qty !== undefined ? app.qty : 1), 10) || 1);
      const watt = Math.max(0, parseFloat(app.watt) || 0);
      const pf = Math.min(1.0, Math.max(0.4, parseFloat(app.powerFactor) || 0.9));
      const dutyCycle = Math.min(1.0, Math.max(0.01, parseFloat(app.dutyCycle) || 1.0));
      const surgeMultiplier = Math.max(1.0, parseFloat(app.surgeMultiplier !== undefined ? app.surgeMultiplier : (app.surgeFactor !== undefined ? app.surgeFactor : 1.0)) || 1.0);
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
    const hasLoads = totalLoadEnergy > 0;
    const hasDeficit = totalUnservedEnergyKwh > 0.05;
    let solarCoveragePercent = 0;

    if (!hasLoads) {
      solarCoveragePercent = 0; // لا توجد أحمال مضافة: لا تعرض 100%!
    } else if (hasDeficit) {
      // عند وجود عجز فعلي، استقلالية الطاقة لا يمكن أن تكون 100%
      const cleanEnergyServed = Math.max(0, totalDirectSolarKwh + totalBatteryDischargedKwh);
      solarCoveragePercent = Math.max(0, Math.min(99.0, (cleanEnergyServed / totalLoadEnergy) * 100));
    } else {
      const cleanEnergyServed = totalDirectSolarKwh + totalBatteryDischargedKwh;
      solarCoveragePercent = Math.min(100, Math.max(0, (cleanEnergyServed / totalLoadEnergy) * 100));
    }

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
        hasLoads,
        hasDeficit,
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

    // معاملات الحرارة (النسب المئوية لكل درجة مئوية - دعم التنسيق المئوي أو العشري)
    let gammaVoc = panel.tempCoefficientVoc || panel.tempCoeffVoc || -0.0026; // -0.26%/C
    if (Math.abs(gammaVoc) > 0.05) gammaVoc = gammaVoc / 100;

    let gammaVmp = panel.tempCoefficientVmp || panel.tempCoeffVmp || -0.0030; // -0.30%/C
    if (Math.abs(gammaVmp) > 0.05) gammaVmp = gammaVmp / 100;

    // أقصى جهد دائرة مفتوحة عند أبرد حرارة متوقعة (Winter Morning Voc Cold)
    // Voc(Tmin) = Voc_STC * [1 + gamma_Voc * (Tmin - 25)]
    const vocCold = vocStc * (1 + gammaVoc * (tMin - stcTemp));

    // أدنى جهد نقطة قدرة عظمى عند أحر حرارة متوقعة للخلايا (Summer Noon Vmp Hot)
    // Vmp(Tmax) = Vmp_STC * [1 + gamma_Vmp * (Tmax - 25)]
    const vmpHot = vmpStc * (1 + gammaVmp * (tMaxCell - stcTemp));

    // حدود الإنفرتر
    const invMaxVoc = inverter.maxVocInput || inverter.maxPvVoc || inverter.maxPvVoltage || 500;
    const invMpptMin = inverter.mpptMin || inverter.mpptVoltageMin || 120;
    const invMpptMax = inverter.mpptMax || inverter.mpptVoltageMax || 450;
    const invMpptTrackers = inverter.mpptTrackers || 2;
    const invMaxPvPower = inverter.maxPvPower || (inverter.maxPvInputKw ? inverter.maxPvInputKw * 1000 : (inverter.capacityKw * 1.3 * 1000));

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
    // 0. التحقق من وجود أحمال فعلية
    if (!loadProfile || !loadProfile.totalDailyKwh || loadProfile.totalDailyKwh <= 0 || loadProfile.peakContinuousKw <= 0) {
      return {
        success: false,
        error: 'NO_LOADS',
        message: 'لم يتم إضافة أحمال كهربائية بعد. يرجى إضافة أجهزتك الكهربائية في الخطوة الأولى لحساب الباقة المناسبة بدقة.',
        sizingRequirements: {
          minInverterContinuousKw: 0,
          minInverterSurgeKw: 0,
          targetUsableBatteryKwh: 0,
          minPvKwPeak: 0
        },
        packages: null
      };
    }

    // فلترة المنتجات المكتملة هندسياً ومالياً واستبعاد أي منتج سعره صفر أو اسمه فارغ
    function isValidItem(item, type) {
      if (!item || typeof item !== 'object') return false;
      if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') return false;
      if (typeof item.price !== 'number' || isNaN(item.price) || item.price <= 0) return false;
      if (item.available === false) return false;

      if (type === 'inverter') {
        const cap = item.capacityKw || item.ratedPowerKw || 0;
        return cap > 0;
      }
      if (type === 'battery') {
        const cap = item.capacityKwh || 0;
        return cap > 0;
      }
      if (type === 'panel') {
        const w = item.watt || 0;
        return w > 0;
      }
      return true;
    }

    const inverters = (inventory.inverters || []).filter(i => isValidItem(i, 'inverter'));
    const batteries = (inventory.batteries || []).filter(b => isValidItem(b, 'battery'));
    const panels = (inventory.panels || []).filter(p => isValidItem(p, 'panel'));

    if (inverters.length === 0 || batteries.length === 0 || panels.length === 0) {
      return {
        success: false,
        error: 'INCOMPLETE_INVENTORY',
        message: 'بيانات المخزون غير مكتملة أو تحتوي على منتجات بدون أسعار محددة. يرجى مراجعة وتحديث أسعار المنتجات في لوحة الإدارة.',
        sizingRequirements: null,
        packages: null
      };
    }

    // 1. المتطلبات الهندسية الدنيا
    const safetyMargin = designParams.inverterSafetyMargin || 1.25;
    const psh = designParams.psh || 5.8;
    const derating = designParams.deratingFactor || 0.78;

    // أ) قدرة الإنفرتر المطلوبة (Continuous kW & Surge kW)
    const minInverterContinuousKw = loadProfile.peakContinuousKw * safetyMargin;
    const minInverterSurgeKw = loadProfile.maxSurgeKw;

    // ب) سعة البطارية المطلوبة لتغطية أوقات الانقطاع
    let energyToStoreKwh = 0;
    if (gridSchedule.mode === 'offgrid') {
      energyToStoreKwh = loadProfile.totalNightKwh + (loadProfile.totalDayKwh * 0.3);
    } else {
      energyToStoreKwh = loadProfile.totalOutageKwh;
      if (energyToStoreKwh === 0 && loadProfile.totalNightKwh > 0) {
        energyToStoreKwh = loadProfile.totalNightKwh;
      }
    }
    const targetUsableBatteryKwh = Math.max(2.4, energyToStoreKwh * 1.15);

    // ج) قدرة الألواح الشمسية المطلوبة (kWp)
    const batteryRechargeKwh = targetUsableBatteryKwh / (designParams.chargeEfficiency || 0.95);
    const dailyTargetEnergyKwh = (loadProfile.totalDayKwh) + batteryRechargeKwh;
    const minPvKwPeak = Math.max(1.0, dailyTargetEnergyKwh / (psh * derating));

    // 2. فلترة ومطابقة الإنفرترات المناسبة كهربائياً
    const validInverters = inverters.filter(inv => {
      const ratedKw = inv.capacityKw || inv.ratedPowerKw || 0;
      const surgeKw = inv.surgeCapacityKw || inv.surgePowerKw || (ratedKw * 2);
      return ratedKw >= (loadProfile.peakContinuousKw * 1.0) && surgeKw >= (minInverterSurgeKw * 0.9);
    });

    const chosenInverterList = validInverters.length > 0 ? validInverters : inverters;
    chosenInverterList.sort((a, b) => (a.capacityKw - b.capacityKw) || (a.price - b.price));

    // 3. بناء وتوليد الباقات الثلاث
    const packages = {};

    // --- باقة 1: الخيار الاقتصادي (Economic) - يبرز إنفرترات Crown Micro أو الخيار الأقل تكلفة ---
    const crownEcoInv = chosenInverterList.find(i => (i.brand || '').includes('Crown') && (i.capacityKw || 0) >= loadProfile.peakContinuousKw);
    const econInv = crownEcoInv || chosenInverterList[0] || inverters[0];
    const econPanel = panels.slice().sort((a, b) => a.price - b.price)[0] || panels[0];
    const econBattery = batteries.slice().sort((a, b) => a.price - b.price)[0] || batteries[0];

    const econBatDod = econBattery.dod || 0.85;
    const econBatUsableKwh = econBattery.capacityKwh * econBatDod;
    const econBatCount = Math.max(1, Math.ceil(targetUsableBatteryKwh / econBatUsableKwh));
    const econStringing = calculateElectricalStringing(econPanel, econInv, minPvKwPeak, designParams);

    packages.economic = {
      type: 'economic',
      title: 'الباقة الاقتصادية الذكية',
      badge: (econInv.brand || '').includes('Crown') ? 'وكالة Crown Micro الرسمية - اقتصادية وعملية' : 'أقل تكلفة مع الالتزام بالمواصفات الهندسية',
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
    const recInv = chosenInverterList.find(i => (i.capacityKw || 0) >= minInverterContinuousKw)
      || chosenInverterList[Math.min(1, chosenInverterList.length - 1)];

    const recPanel = panels.find(p => (p.watt || 0) >= 580) || panels[0];
    const recBattery = batteries.find(b => (b.chemistry || '').includes('Li') || (b.name || '').includes('ليثيوم') || (b.name || '').includes('نارادا'))
      || batteries[0];

    const recBatDod = recBattery.dod || 0.90;
    const recBatUsableKwh = recBattery.capacityKwh * recBatDod;
    const recBatCount = Math.max(1, Math.ceil(targetUsableBatteryKwh / recBatUsableKwh));
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

    const optimalRecommendation = packages.recommended || packages.economic || packages.highPerformance;

    const customerNeed = {
      dailyEnergyKwh: parseFloat(loadProfile.totalDailyKwh.toFixed(2)),
      peakContinuousKw: parseFloat(loadProfile.peakContinuousKw.toFixed(2)),
      minInverterContinuousKw: parseFloat(minInverterContinuousKw.toFixed(2)),
      maxSurgeKw: parseFloat(minInverterSurgeKw.toFixed(2)),
      dayEnergyKwh: parseFloat(loadProfile.totalDayKwh.toFixed(2)),
      nightEnergyKwh: parseFloat(loadProfile.totalNightKwh.toFixed(2)),
      outageHours: gridSchedule.totalOutageHours,
      targetUsableBatteryKwh: parseFloat(targetUsableBatteryKwh.toFixed(2)),
      minPvKwPeak: parseFloat(minPvKwPeak.toFixed(2)),
      recommendedPanelsCount: optimalRecommendation ? optimalRecommendation.panel.quantity : Math.ceil((minPvKwPeak * 1000) / (panels[0] ? panels[0].watt : 610))
    };

    return {
      success: true,
      sizingRequirements: {
        minInverterContinuousKw: parseFloat(minInverterContinuousKw.toFixed(2)),
        minInverterSurgeKw: parseFloat(minInverterSurgeKw.toFixed(2)),
        targetUsableBatteryKwh: parseFloat(targetUsableBatteryKwh.toFixed(2)),
        minPvKwPeak: parseFloat(minPvKwPeak.toFixed(2))
      },
      customerNeed,
      optimalRecommendation,
      packages
    };
  }

  function generateQuotation(pkg, designParams = DEFAULT_DESIGN_PARAMS, customerInfo = {}) {
    if (!pkg || !pkg.inverter || !pkg.battery || !pkg.panel) {
      return null;
    }
    const exchangeRate = designParams.currencyExchangeRate || 1;
    const validityDays = parseInt(designParams.quoteValidityDays, 10) || 7;
    const defaultCurr = designParams.defaultCurrency || 'SAR';
    const showYer = Boolean(designParams.enableYerDisplay);

    // المكونات الرئيسية
    const inverter = pkg.inverter;
    const battery = pkg.battery;
    const panel = pkg.panel;

    // 1. تكلفة الهياكل والقواعد المعدنية المجلفنة المقاومة للرياح (بالريال السعودي)
    const structureUnitPrice = 75;
    const structureCost = panel.quantity * structureUnitPrice;

    // 2. كابلات شمسية وتوصيلات MC4 وقواطع الحماية DC & AC (بالريال السعودي)
    const protectionBoxCost = inverter.capacityKw <= 6 ? 800 : 1400;
    const cablingCost = Math.round(panel.totalKw * 1000 * 0.35);

    // 3. أجور التركيب والبرمجة والفحص الهندسي المعتمد (بالريال السعودي)
    const installationFee = Math.round(Math.max(500, panel.totalKw * 1000 * 0.25));

    // جدول الكميات المفصل (Bill of Materials) مطابق لنموذج عرض السعر الرسمي لبترونيل
    const items = [
      {
        itemNumber: 1,
        category: 'الإنفرتر',
        name: inverter.name,
        specs: `قدرة مستمرة ${inverter.capacityKw}kW، تيار إقلاع ${inverter.surgeKw || inverter.surgeCapacityKw || inverter.capacityKw * 2}kW، جهد بطارية ${inverter.batteryVoltage || inverter.systemVoltage || 48}V تتبع MPPT`,
        quantity: inverter.quantity || 1,
        unit: 'جهاز',
        unitPrice: inverter.price,
        totalPrice: inverter.totalCost || inverter.price,
        warranty: `${inverter.warranty || inverter.warrantyYears || 2} سنوات`
      },
      {
        itemNumber: 2,
        category: 'تخزين الطاقة (البطاريات)',
        name: battery.name,
        specs: `سعة ${battery.capacityKwh}kWh كيمياء ${battery.chemistry || 'LiFePO4'}، جهد ${battery.voltage || battery.nominalVoltage || 48}V ونظام BMS ذكي`,
        quantity: battery.quantity || 1,
        unit: 'حبة',
        unitPrice: battery.price,
        totalPrice: battery.totalCost || battery.price,
        warranty: `${battery.warranty || battery.warrantyYears || 5} سنوات`
      },
      {
        itemNumber: 3,
        category: 'الألواح الشمسية',
        name: panel.name,
        specs: `لوح شمس ذروة ${panel.watt}W بتقنية N-Type كفاءة فائقة ومقاومة لدرجات الحرارة`,
        quantity: panel.quantity || 8,
        unit: 'لوح',
        unitPrice: panel.price,
        totalPrice: panel.totalCost || (panel.price * (panel.quantity || 8)),
        warranty: `${panel.warranty || panel.warrantyYears || 12} سنة مصنعية و25 سنة كفاءة`
      },
      {
        itemNumber: 4,
        category: 'لوحة الحماية والقواطع',
        name: 'لوحة قواطع وحوافظ AC/DC وكابلات طاقة وتوصيلات معتمدة',
        specs: 'قواطع تيار مستمر DC ومتردد AC أصلية، فيوزات حماية، مانعات صواعق SPD، وكابلات نحاسية معزولة',
        quantity: 1,
        unit: 'منظومة',
        unitPrice: protectionBoxCost + cablingCost,
        totalPrice: protectionBoxCost + cablingCost,
        warranty: 'سنتان'
      },
      {
        itemNumber: 5,
        category: 'الهياكل والقواعد',
        name: 'قواعد وهيكل تثبيت الألواح مجلفن ومقاوم للرياح',
        specs: 'هيكل تثبيت حديد مجلفن ساخن مقاوم للأكسدة والرياح العاتية مع مسامير ستانلس ستيل',
        quantity: panel.quantity || 8,
        unit: 'طقم',
        unitPrice: structureUnitPrice,
        totalPrice: structureCost,
        warranty: '10 سنوات'
      },
      {
        itemNumber: 6,
        category: 'التركيب والتشغيل',
        name: 'التركيب الميداني والبرمجة والتدشين والفحص الهندسي',
        specs: 'تنفيذ احترافي بواسطة مهندسي شركة بترونيل يمن، ضبط معايير الشحن والتفريغ، وتدريب العميل',
        quantity: 1,
        unit: 'خدمة',
        unitPrice: installationFee,
        totalPrice: installationFee,
        warranty: 'سنة صيانة دورية مجانية'
      }
    ];

    // الإجماليات المالية
    const totalEquipmentCost = (inverter.totalCost || inverter.price) + (panel.totalCost || panel.price * panel.quantity) + (battery.totalCost || battery.price * battery.quantity);
    const totalAccessoriesCost = structureCost + protectionBoxCost + cablingCost;
    const totalCost = totalEquipmentCost + totalAccessoriesCost + installationFee;
    const totalCostYer = totalCost * exchangeRate;

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const quoteNo = customerInfo.quoteNo || ('PET-2026-' + randomSuffix);
    const currentDate = customerInfo.date || new Date().toISOString().split('T')[0];

    return {
      quoteId: quoteNo,
      quoteNo,
      date: currentDate,
      validUntilDays: validityDays,
      defaultCurrency: defaultCurr,
      currency: defaultCurr,
      enableYerDisplay: showYer,
      company: {
        name: "بترونيل يمن للطاقة",
        agency: "الوكيل الحصري لمنتجات Crown Micro في الجمهورية اليمنية",
        address: "اليمن - حضرموت - سيئون - شارع الجزائر - مقابل حديقة الطويلة",
        phone: "+967-779669868",
        phonesList: ["+967-779669868", "+967-770557550", "+971-557777395"],
        email: "info@petroneelyemen.com",
        website: "www.petroneelyemen.com"
      },
      customer: {
        name: customerInfo.name || customerInfo.customerName || "عميل بترونيل المحترم",
        phone: customerInfo.phone || customerInfo.customerPhone || "",
        address: customerInfo.address || customerInfo.customerAddress || customerInfo.location || "سيئون - حضرموت"
      },
      systemOverview: {
        packageType: pkg.title || 'منظومة الطاقة الشمسية المتكاملة',
        inverterCapacityKw: inverter.capacityKw,
        pvCapacityKw: panel.totalKw,
        panelsCount: panel.quantity,
        batteryCapacityKwh: battery.totalKwh || battery.capacityKwh * (battery.quantity || 1),
        batteryUsableKwh: battery.usableKwh,
        batteryUnits: battery.quantity || 1
      },
      items,
      financials: {
        equipmentCost: parseFloat(totalEquipmentCost.toFixed(2)),
        accessoriesCost: parseFloat(totalAccessoriesCost.toFixed(2)),
        installationFee: parseFloat(installationFee.toFixed(2)),
        subtotal: parseFloat(totalCost.toFixed(2)),
        discount: 0,
        totalCost: parseFloat(totalCost.toFixed(2)),
        grandTotal: parseFloat(totalCost.toFixed(2)),
        equipmentCostUsd: parseFloat(totalEquipmentCost.toFixed(2)),
        accessoriesCostUsd: parseFloat(totalAccessoriesCost.toFixed(2)),
        installationFeeUsd: parseFloat(installationFee.toFixed(2)),
        totalCostUsd: parseFloat(totalCost.toFixed(2)),
        totalCostYer: Math.round(totalCostYer),
        exchangeRate
      },
      warrantyTerms: [
        "ضمان الإنفرتر كراون مايكرو Crown Micro سنتان صيانة واستبدال حسب شروط الوكالة الرسمية.",
        "ضمان بطاريات الليثيوم كراون مايكرو Crown Micro خمس 5 سنوات كفاءة وتشغيل من تاريخ التركيب.",
        "ضمان الألواح الشمسية لونجي Longi اثنتا عشرة 12 سنة عيوب مصنعية و25 سنة كفاءة توليد.",
        "توفير الدعم الفني والمتابعة الهندسية المستمرة وفحص المنظومة."
      ],
      companyFeatures: [
        "تقديم أفضل الخدمات بعد البيع من صيانة ومتابعة خلال فترة الضمانة المحددة وبعدها",
        "توفير جميع قطع الغيار الخاصة بمكونات منظومة الطاقة الشمسية",
        "منتجاتنا مصنعة حسب المواصفات والمعايير الأوروبية"
      ],
      terms: [
        "ضمان الإنفرتر كراون مايكرو Crown Micro سنتان صيانة واستبدال حسب شروط الوكالة الرسمية.",
        "ضمان بطاريات الليثيوم كراون مايكرو Crown Micro خمس 5 سنوات كفاءة وتشغيل من تاريخ التركيب.",
        "ضمان الألواح الشمسية لونجي Longi اثنتا عشرة 12 سنة عيوب مصنعية و25 سنة كفاءة توليد.",
        "توفير الدعم الفني والمتابعة الهندسية المستمرة وفحص المنظومة."
      ],
      note: "صلاحية عرض السعر لمدة أسبوع من تاريخه."
    };
  }

  /**
   * 8. فحص وتدقيق التوافق الهندسي بين الإنفرتر وبنك البطاريات (Inverter-Battery Matrix)
   * يفحص:
   * 1. توافق جهد النظام (System Voltage) بين الإنفرتر والبطاريات (12V/24V/48V)
   * 2. قدرة الشحن المتاحة للإنفرتر (Charging Power kW)
   * 3. زمن إعادة الشحن الشمسي بالساعات ومقارنته بساعات ذروة الشمس في اليمن (PSH)
   * 4. قدرة تفريغ البطارية القصوى مقارنة بالقدرة المستمرة المطلوبة للإنفرتر
   * 5. توافق كيمياء البطارية ودعم بروتوكول الاتصال الذكي BMS
   */
  function validateInverterBatteryCompatibility(inverter, battery, batteryCount = 1, psh = 5.8) {
    if (!inverter || !battery) {
      return {
        isCompatible: false,
        status: 'CRITICAL',
        badge: 'بيانات ناقصة',
        warnings: ['بيانات الإنفرتر أو البطارية غير مكتملة'],
        recommendations: []
      };
    }

    const warnings = [];
    const recommendations = [];
    let isCompatible = true;
    let status = 'OPTIMAL'; // 'OPTIMAL' | 'WARNING' | 'CRITICAL'

    // 1. فحص الجهد الاسمي للمنظومة (System Voltage Check)
    const invVoltage = inverter.batteryVoltage || inverter.systemVoltage || 48;
    let batNominalVoltage = battery.voltage || battery.systemVoltage || battery.nominalVoltage || 48;
    if (batNominalVoltage >= 44 && batNominalVoltage <= 58) batNominalVoltage = 48;
    else if (batNominalVoltage >= 22 && batNominalVoltage <= 29) batNominalVoltage = 24;
    else if (batNominalVoltage >= 11 && batNominalVoltage <= 15) batNominalVoltage = 12;
    const qty = Math.max(1, parseInt(batteryCount, 10) || 1);

    let effectiveBatteryVoltage = batNominalVoltage;
    let seriesCount = 1;
    let parallelCount = qty;

    if (batNominalVoltage === 12 && invVoltage === 48) {
      seriesCount = 4;
      if (qty % 4 !== 0) {
        warnings.push(`البطارية بجهد 12V وتتطلب التوصيل على التوالي بمضاعفات 4 وحدات (4، 8، 12) للوصول لجهد الإنفرتر 48V. العدد الحالي: ${qty}.`);
        isCompatible = false;
        status = 'CRITICAL';
      }
      parallelCount = Math.floor(qty / 4);
      effectiveBatteryVoltage = 48;
    } else if (batNominalVoltage === 12 && invVoltage === 24) {
      seriesCount = 2;
      if (qty % 2 !== 0) {
        warnings.push(`البطارية بجهد 12V وتتطلب التوصيل على التوالي بمضاعفات بطاريتين (2، 4، 6) للوصول لجهد الإنفرتر 24V. العدد الحالي: ${qty}.`);
        isCompatible = false;
        status = 'CRITICAL';
      }
      parallelCount = Math.floor(qty / 2);
      effectiveBatteryVoltage = 24;
    } else if (batNominalVoltage === 24 && invVoltage === 48) {
      seriesCount = 2;
      if (qty % 2 !== 0) {
        warnings.push(`البطارية بجهد 24V وتتطلب زوج بطاريات على التوالي لتطابق جهد الإنفرتر 48V.`);
        isCompatible = false;
        status = 'CRITICAL';
      }
      parallelCount = Math.floor(qty / 2);
      effectiveBatteryVoltage = 48;
    } else if (batNominalVoltage !== invVoltage) {
      warnings.push(`جهد البطارية (${batNominalVoltage}V) غير متوافق مع جهد دخل بطاريات الإنفرتر (${invVoltage}V).`);
      isCompatible = false;
      status = 'CRITICAL';
    }

    // 2. حساب الطاقة الإجمالية والقابلة للاستخدام (kWh)
    const totalCapacityKwh = parseFloat(((battery.capacityKwh || 0) * qty).toFixed(2));
    const dod = battery.dod || battery.recommendedDoD || 0.90;
    const usableCapacityKwh = parseFloat((totalCapacityKwh * dod).toFixed(2));

    // 3. قدرة الشحن القصوى للإنفرتر (Inverter Max Charging Power)
    const maxChargeCurrentA = inverter.maxChargeCurrent || (inverter.capacityKw * 1000 / invVoltage) * 0.8;
    const maxChargePowerKw = parseFloat(((invVoltage * maxChargeCurrentA) / 1000).toFixed(2));

    // 4. زمن إعادة الشحن الشمسي الكامل بالساعات (Recharge Time Hours)
    const chargeEfficiency = 0.95;
    const effectiveRechargePowerKw = Math.max(0.5, Math.min(maxChargePowerKw, (inverter.capacityKw || 5) * 1.2));
    const rechargeTimeHours = parseFloat((usableCapacityKwh / (effectiveRechargePowerKw * chargeEfficiency)).toFixed(1));

    const maxAllowedRechargeHours = psh * 1.25;
    if (usableCapacityKwh > 0 && rechargeTimeHours > maxAllowedRechargeHours) {
      status = status === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
      warnings.push(
        `قدرة شحن الإنفرتر (${maxChargePowerKw} kW عبر ${maxChargeCurrentA}A) محدودة مقارنة بسعة البطارية الكبيرة (${totalCapacityKwh} kWh). ستستغرق إعادة الشحن الكاملة حوالي ${rechargeTimeHours} ساعات، مما يتجاوز ساعات ذروة الشمس اليومية (${psh}h).`
      );
      recommendations.push(
        `يُوصى باختيار إنفرتر بقدرة شحن أعلى (مثل Crown Elego Pro 6kW أو Deye 8kW/10kW) لضمان الشحن السريع في فترات السطوع الشمسي المحدودة.`
      );
    }

    // 5. قدرة التفريغ القصوى للبطارية مقارنة بالقدرة المستمرة للإنفرتر
    const batteryMaxDischargeA = battery.maxContinuousDischargeA || (battery.capacityAh ? battery.capacityAh : (battery.capacityKwh * 1000 / batNominalVoltage));
    const totalMaxDischargeKw = parseFloat(((invVoltage * batteryMaxDischargeA * Math.max(1, parallelCount)) / 1000).toFixed(2));
    const inverterRatedKw = inverter.capacityKw || inverter.ratedPowerKw || 0;

    if (totalMaxDischargeKw < inverterRatedKw * 0.85) {
      status = status === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
      warnings.push(
        `أقصى تيار تفريغ مستمر للبطارية (${totalMaxDischargeKw} kW) أقل من استطاعة الإنفرتر (${inverterRatedKw} kW)، وقد تفصل حماية الـ BMS عند تشغيل الأحمال الكاملة.`
      );
      recommendations.push(`إضافة وحدة بطارية إضافية بالتوازي لزيادة قدرة تفريغ التيار.`);
    }

    return {
      isCompatible: isCompatible && status !== 'CRITICAL',
      status,
      badge: status === 'OPTIMAL' ? 'مطابقة مثالية' : (status === 'WARNING' ? 'متوافق مع قيود فنية' : 'غير متوافق كهربائياً'),
      invVoltage,
      batNominalVoltage,
      seriesCount,
      parallelCount,
      totalCapacityKwh,
      usableCapacityKwh,
      maxChargeCurrentA,
      maxChargePowerKw,
      rechargeTimeHours,
      totalMaxDischargeKw,
      inverterRatedKw,
      warnings,
      recommendations
    };
  }

  /**
   * 9. الفحص الهندسي الشامل للمنظومة متضمنة تخصيص وتبديل المكونات يدوياً
   */
  function validateFullSystemConfiguration(params = {}) {
    const {
      inverter,
      battery,
      batteryCount = 1,
      panel,
      panelsCount = 1,
      loadProfile,
      designParams = DEFAULT_DESIGN_PARAMS
    } = params;

    const checks = {
      inverterPower: { ok: true, status: 'pass', label: 'قدرة الإنفرتر المستمرة', message: '' },
      motorSurge: { ok: true, status: 'pass', label: 'تيار إقلاع المحركات (Surge)', message: '' },
      batteryCharging: { ok: true, status: 'pass', label: 'توافق وقدرة شحن البطارية', message: '' },
      batteryAutonomy: { ok: true, status: 'pass', label: 'تغطية فترة انقطاع الشبكة', message: '' },
      mpptLimits: { ok: true, status: 'pass', label: 'مطابقة جهد الألواح والـ MPPT', message: '' }
    };

    const warnings = [];
    const errors = [];
    const recommendations = [];

    // 1. Inverter continuous power
    const invContinuousKw = inverter ? (inverter.capacityKw || inverter.ratedPowerKw || 0) : 0;
    const peakLoadKw = loadProfile ? loadProfile.peakContinuousKw : 0;
    const safetyMargin = designParams.inverterSafetyMargin || 1.25;

    if (invContinuousKw < peakLoadKw) {
      checks.inverterPower.ok = false;
      checks.inverterPower.status = 'fail';
      checks.inverterPower.message = `قدرة الإنفرتر (${invContinuousKw} kW) أقل من ذروة الأحمال المستمرة (${peakLoadKw} kW).`;
      errors.push(checks.inverterPower.message);
    } else if (invContinuousKw < peakLoadKw * safetyMargin) {
      checks.inverterPower.ok = true;
      checks.inverterPower.status = 'warn';
      checks.inverterPower.message = `قدرة الإنفرتر (${invContinuousKw} kW) تغطي الأحمال ولكن دون هامش الأمان الموصى به (${parseFloat((peakLoadKw * safetyMargin).toFixed(1))} kW).`;
      warnings.push(checks.inverterPower.message);
    } else {
      checks.inverterPower.message = `القدرة كافية ومحمية بهامش أمان ${(safetyMargin * 100 - 100).toFixed(0)}%.`;
    }

    // 2. Inverter Surge vs Motors
    const invSurgeKw = inverter ? (inverter.surgeCapacityKw || inverter.surgeKw || invContinuousKw * 2) : 0;
    const maxSurgeKw = loadProfile ? loadProfile.maxSurgeKw : 0;

    if (invSurgeKw < maxSurgeKw) {
      checks.motorSurge.ok = false;
      checks.motorSurge.status = 'fail';
      checks.motorSurge.message = `أقصى قدرة إقلاع للإنفرتر (${invSurgeKw} kW) لا تكفي لبدء تشغيل المحركات والمكيفات (${maxSurgeKw} kW).`;
      errors.push(checks.motorSurge.message);
    } else {
      checks.motorSurge.message = `الإنفرتر يستوعب تيار إقلاع المحركات حتى ${invSurgeKw} kW.`;
    }

    // 3. Inverter-Battery Compatibility Matrix
    const psh = designParams.psh || 5.8;
    const batCompat = validateInverterBatteryCompatibility(inverter, battery, batteryCount, psh);
    if (!batCompat.isCompatible) {
      checks.batteryCharging.ok = false;
      checks.batteryCharging.status = 'fail';
      checks.batteryCharging.message = batCompat.warnings.join(' | ');
      errors.push(...batCompat.warnings);
    } else if (batCompat.status === 'WARNING') {
      checks.batteryCharging.ok = true;
      checks.batteryCharging.status = 'warn';
      checks.batteryCharging.message = batCompat.warnings.join(' | ');
      warnings.push(...batCompat.warnings);
      recommendations.push(...batCompat.recommendations);
    } else {
      checks.batteryCharging.message = `توافق تام في الجهد (${batCompat.invVoltage}V) وزمن شحن قياسي (${batCompat.rechargeTimeHours}h).`;
    }

    // 4. Battery Storage vs Outage
    const usableBatKwh = batCompat.usableCapacityKwh;
    const outageKwh = loadProfile ? (loadProfile.totalOutageKwh || loadProfile.totalNightKwh) : 0;

    if (usableBatKwh < outageKwh * 0.9) {
      checks.batteryAutonomy.ok = false;
      checks.batteryAutonomy.status = 'fail';
      checks.batteryAutonomy.message = `سعة البطاريات القابلة للاستخدام (${usableBatKwh} kWh) لا تكفي لتغطية فترة الانقطاع (${outageKwh} kWh).`;
      errors.push(checks.batteryAutonomy.message);
    } else if (usableBatKwh < outageKwh * 1.15) {
      checks.batteryAutonomy.ok = true;
      checks.batteryAutonomy.status = 'warn';
      checks.batteryAutonomy.message = `سعة البطاريات (${usableBatKwh} kWh) تغطي الانقطاع تماماً بهامش احتياطي محدود.`;
      warnings.push(checks.batteryAutonomy.message);
    } else {
      checks.batteryAutonomy.message = `سعة البطاريات تغطي فترة الانقطاع مع هامش أمان ممتاز.`;
    }

    // 5. MPPT and Stringing
    if (inverter && panel && panelsCount > 0) {
      const targetPvKw = (panelsCount * (panel.watt || 580)) / 1000;
      const stringing = calculateElectricalStringing(panel, inverter, targetPvKw, designParams);
      if (!stringing.withinLimits || !stringing.isMpptFeasible) {
        checks.mpptLimits.ok = false;
        checks.mpptLimits.status = 'fail';
        checks.mpptLimits.message = `تكوين الألواح خارج نطاق جهد MPPT للإنفرتر (${stringing.mpptWindow}). Voc Cold: ${stringing.stringVocCold}V.`;
        errors.push(checks.mpptLimits.message);
      } else {
        checks.mpptLimits.message = `الجهد ضمن حدود MPPT المثالية (${stringing.stringVmpHot}V - ${stringing.stringVocCold}V).`;
      }
    }

    const overallStatus = errors.length > 0 ? 'critical' : (warnings.length > 0 ? 'warning' : 'optimal');
    const badge = overallStatus === 'optimal' ? 'منظومة مثالية ومعتمدة هندسياً 100%' : (overallStatus === 'warning' ? 'متوافقة تشغيلياً مع ملاحظات هندسية' : 'غير متوافقة فنياً - تتطلب تصحيح المكونات');

    return {
      isFeasible: errors.length === 0,
      overallStatus,
      badge,
      checks,
      warnings,
      errors,
      recommendations,
      batCompat
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
    generateQuotation,
    validateInverterBatteryCompatibility,
    validateFullSystemConfiguration
  };

}));

}

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
    { id: 'inv_crown_32', name: 'انفرتر كراون مايكرو Crown Elego 3.2kW 24V', brand: 'Crown Micro', capacityKw: 3.2, ratedPowerKw: 3.2, surgeCapacityKw: 6.4, systemVoltage: 24, mpptMin: 90, mpptMax: 430, maxVocInput: 450, price: 380, warranty: 2, available: true },
    { id: 'inv_crown_60', name: 'انفرتر كراون مايكرو Crown Elego Pro 6kW 48V', brand: 'Crown Micro', capacityKw: 6.0, ratedPowerKw: 6.0, surgeCapacityKw: 12.0, systemVoltage: 48, mpptMin: 120, mpptMax: 450, maxVocInput: 500, price: 680, warranty: 2, available: true },
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

  // Apply Currency Preferences from Settings
  if (State.designParams) {
    State.currency = State.designParams.defaultCurrency || 'USD';
    const currSelect = document.getElementById('currency-select');
    if (currSelect) {
      currSelect.value = State.currency;
      const yerOption = currSelect.querySelector('option[value="YER"]');
      if (yerOption) {
        if (State.designParams.enableYerDisplay) {
          yerOption.style.display = '';
        } else {
          yerOption.style.display = 'none';
          if (currSelect.value === 'YER') {
            currSelect.value = 'USD';
            State.currency = 'USD';
          }
        }
      }
    }
  }

  // Render initial appliance buttons
  renderAppliancePicker('all');
  renderProductsCatalog('all');
  initPwaAndMobileNav();

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

// ============================================================
// PRODUCTS CATALOG & PWA CONTROLLER
// ============================================================

function renderProductsCatalog(filter = 'all') {
  const container = document.getElementById('products-catalog-container');
  if (!container) return;

  const inverters = State.inventory.inverters || [];
  const batteries = State.inventory.batteries || [];
  const panels = State.inventory.panels || [];

  let items = [];

  if (filter === 'all' || filter === 'inverters' || filter === 'crown') {
    const crownInverters = inverters.filter(i => (i.brand || '').includes('Crown') || (i.name || '').includes('كراون') || (i.brand || '').includes('Xavier') || (i.brand || '').includes('Arceus') || (i.brand || '').includes('Nova') || (i.brand || '').includes('Elego'));
    items.push(...crownInverters.map(i => ({ ...i, category: 'inverter', subCat: 'crown' })));
  }

  if (filter === 'all' || filter === 'batteries') {
    items.push(...batteries.map(b => ({ ...b, category: 'battery', subCat: 'battery' })));
  }

  if (filter === 'all' || filter === 'panels') {
    items.push(...panels.map(p => ({ ...p, category: 'panel', subCat: 'panel' })));
  }

  if (items.length === 0) {
    container.innerHTML = '<div class="text-center p-4 text-muted col-span-full">لا توجد منتجات متطابقة في المخزون حالياً.</div>';
    return;
  }

  container.innerHTML = items.map(item => {
    let brandBadge = '';
    let iconClass = 'fa-bolt';
    let specsHtml = '';

    if (item.subCat === 'crown') {
      brandBadge = '<span class="prod-brand-badge prod-brand-crown"><i class="fa-solid fa-crown"></i> وكالة Crown Micro</span>';
      iconClass = 'fa-solar-panel';
      specsHtml = `
        <div class="prod-spec-item"><span class="prod-spec-label">القدرة الاسمية:</span><span class="prod-spec-val font-num">${item.capacityKw} kW</span></div>
        <div class="prod-spec-item"><span class="prod-spec-label">جهد البطارية:</span><span class="prod-spec-val font-num">${item.batteryVoltage || item.systemVoltage || 48}V</span></div>
        <div class="prod-spec-item"><span class="prod-spec-label">أقصى تيار شحن:</span><span class="prod-spec-val font-num">${item.maxChargeCurrent || 80}A</span></div>
        <div class="prod-spec-item"><span class="prod-spec-label">نطاق MPPT:</span><span class="prod-spec-val font-num">${item.mpptMin || 90}V - ${item.mpptMax || 450}V</span></div>
      `;
    } else if (item.category === 'battery') {
      brandBadge = '<span class="prod-brand-badge prod-brand-crown"><i class="fa-solid fa-crown"></i> Crown LiFePO4</span>';
      iconClass = 'fa-battery-three-quarters';
      specsHtml = `
        <div class="prod-spec-item"><span class="prod-spec-label">السعة التخزينية:</span><span class="prod-spec-val font-num">${item.capacityKwh} kWh</span></div>
        <div class="prod-spec-item"><span class="prod-spec-label">الجهد الاسمي:</span><span class="prod-spec-val font-num">${item.voltage || item.nominalVoltage || 48}V</span></div>
        <div class="prod-spec-item"><span class="prod-spec-label">عمق التفريغ DoD:</span><span class="prod-spec-val font-num">${((item.dod || 0.9) * 100).toFixed(0)}%</span></div>
        <div class="prod-spec-item"><span class="prod-spec-label">العمر الافتراضي:</span><span class="prod-spec-val font-num">${item.cycles || 6000} دورة (+${item.warrantyYears || 5} سنوات)</span></div>
      `;
    } else if (item.category === 'panel') {
      brandBadge = '<span class="prod-brand-badge" style="background:rgba(234,179,8,0.2);color:#eab308;border:1px solid rgba(234,179,8,0.35);"><i class="fa-solid fa-sun"></i> Longi N-Type</span>';
      iconClass = 'fa-solar-panel';
      specsHtml = `
        <div class="prod-spec-item"><span class="prod-spec-label">القدرة القصوى:</span><span class="prod-spec-val font-num">${item.watt} Watt</span></div>
        <div class="prod-spec-item"><span class="prod-spec-label">جهد الدائرة Voc:</span><span class="prod-spec-val font-num">${item.voc || 53.6}V</span></div>
        <div class="prod-spec-item"><span class="prod-spec-label">كفاءة الخلية:</span><span class="prod-spec-val font-num">${item.efficiency || '22.6%'}</span></div>
        <div class="prod-spec-item"><span class="prod-spec-label">ضمان الأداء:</span><span class="prod-spec-val font-num">${item.performanceWarrantyYears || 25} سنة</span></div>
      `;
    }

    return `
      <div class="product-card glass" data-id="${item.id}" data-category="${item.category}">
        <div class="prod-card-header">
          ${brandBadge}
          <div class="prod-icon-wrap"><i class="fa-solid ${iconClass}"></i></div>
        </div>
        <h3 class="prod-title">${item.name}</h3>
        <p class="prod-model font-num">${item.model || ''}</p>
        <div class="prod-specs-grid">${specsHtml}</div>
        <div class="prod-card-footer">
          <div class="prod-pricing">
            <span class="prod-price font-num" style="color: #f59e0b; font-weight: 800; font-size: 1.25rem;">${item.price.toLocaleString('en-US')} ر.س</span>
          </div>
          <button type="button" class="btn btn-secondary-outline btn-sm btn-quick-calc" onclick="goToStep(2)">
            <i class="fa-solid fa-calculator"></i> استخدم بالحاسبة
          </button>
        </div>
      </div>
    `;
  }).join('');
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
function updateLiveCompatibilityCard() {
  const invSel = document.getElementById('custom-select-inverter');
  const panSel = document.getElementById('custom-select-panel');
  const batSel = document.getElementById('custom-select-battery');
  const pCountInp = document.getElementById('custom-panels-count');
  const bCountInp = document.getElementById('custom-batteries-count');
  const compatCard = document.getElementById('tuning-compatibility-card');

  if (!invSel || !compatCard) return;

  const invId = invSel.value;
  const panId = panSel ? panSel.value : null;
  const batId = batSel ? batSel.value : null;
  const panelsCount = parseInt(pCountInp?.value, 10) || 8;
  const batCount = parseInt(bCountInp?.value, 10) || 1;

  const chosenInv = State.inventory.inverters.find(i => i.id === invId) || State.inventory.inverters[0];
  const chosenPan = State.inventory.panels.find(p => p.id === panId) || State.inventory.panels[0];
  const chosenBat = State.inventory.batteries.find(b => b.id === batId) || State.inventory.batteries[0];

  const sched = SolarEngine.parseGridSchedule({
    mode: State.grid.mode,
    intervals: State.grid.intervals,
    dailyHours: State.grid.dailyHours,
    worstOutageHours: State.grid.worstOutageHours
  }, 96);
  const profile = SolarEngine.calculateLoadProfile(State.appliances, sched, 96);

  const evalResult = SolarEngine.validateFullSystemConfiguration({
    inverter: chosenInv,
    battery: chosenBat,
    batteryCount: batCount,
    panel: chosenPan,
    panelsCount,
    loadProfile: profile,
    designParams: State.designParams
  });

  compatCard.className = `tuning-compat-card status-${evalResult.overallStatus} mt-3`;
  compatCard.style.display = 'block';

  let statusBadgeHtml = '';
  if (evalResult.overallStatus === 'optimal') {
    statusBadgeHtml = '<span class="tcc-badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4);"><i class="fa-solid fa-circle-check"></i> مطابقة هندسية معتمدة 100%</span>';
  } else if (evalResult.overallStatus === 'warning') {
    statusBadgeHtml = '<span class="tcc-badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4);"><i class="fa-solid fa-triangle-exclamation"></i> متوافقة تشغيلياً مع قيود فنية</span>';
  } else {
    statusBadgeHtml = '<span class="tcc-badge" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);"><i class="fa-solid fa-circle-xmark"></i> غير متوافقة فنياً - تتطلب تصحيحاً</span>';
  }

  const { checks, batCompat } = evalResult;

  compatCard.innerHTML = `
    <div class="tcc-header">
      <div>
        <strong style="font-size: 0.95rem; display: block; color: var(--text-primary);"><i class="fa-solid fa-microchip text-primary"></i> تقرير التوافق والمطابقة الهندسية</strong>
        <small style="color: var(--text-secondary);">فحص مصفوفة الشحن والتفريغ وتيار الإقلاع وجهود الـ MPPT</small>
      </div>
      ${statusBadgeHtml}
    </div>

    <div class="tcc-checks-grid">
      <div class="tcc-check-item">
        <div class="tcc-check-title">
          <i class="fa-solid ${checks.inverterPower.status === 'pass' ? 'fa-check text-success' : (checks.inverterPower.status === 'warn' ? 'fa-triangle-exclamation text-warning' : 'fa-xmark text-danger')}"></i>
          <span>${checks.inverterPower.label}</span>
        </div>
        <div class="tcc-check-detail">${checks.inverterPower.message}</div>
      </div>

      <div class="tcc-check-item">
        <div class="tcc-check-title">
          <i class="fa-solid ${checks.motorSurge.status === 'pass' ? 'fa-check text-success' : 'fa-xmark text-danger'}"></i>
          <span>${checks.motorSurge.label}</span>
        </div>
        <div class="tcc-check-detail">${checks.motorSurge.message}</div>
      </div>

      <div class="tcc-check-item">
        <div class="tcc-check-title">
          <i class="fa-solid ${checks.batteryCharging.status === 'pass' ? 'fa-check text-success' : (checks.batteryCharging.status === 'warn' ? 'fa-triangle-exclamation text-warning' : 'fa-xmark text-danger')}"></i>
          <span>${checks.batteryCharging.label}</span>
        </div>
        <div class="tcc-check-detail">${checks.batteryCharging.message}</div>
      </div>

      <div class="tcc-check-item">
        <div class="tcc-check-title">
          <i class="fa-solid ${checks.batteryAutonomy.status === 'pass' ? 'fa-check text-success' : (checks.batteryAutonomy.status === 'warn' ? 'fa-triangle-exclamation text-warning' : 'fa-xmark text-danger')}"></i>
          <span>${checks.batteryAutonomy.label}</span>
        </div>
        <div class="tcc-check-detail">${checks.batteryAutonomy.message}</div>
      </div>

      <div class="tcc-check-item">
        <div class="tcc-check-title">
          <i class="fa-solid ${checks.mpptLimits.status === 'pass' ? 'fa-check text-success' : 'fa-xmark text-danger'}"></i>
          <span>${checks.mpptLimits.label}</span>
        </div>
        <div class="tcc-check-detail">${checks.mpptLimits.message}</div>
      </div>
    </div>

    ${evalResult.warnings.length > 0 ? `
      <div class="tcc-messages-box warn mb-2">
        <strong><i class="fa-solid fa-triangle-exclamation"></i> ملاحظات وتحذيرات فنية:</strong>
        <ul style="margin: 4px 0 0 16px; padding: 0;">
          ${evalResult.warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${evalResult.recommendations.length > 0 ? `
      <div class="tcc-messages-box warn" style="background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.3); color: #60a5fa;">
        <strong><i class="fa-solid fa-lightbulb"></i> البدائل والتوصيات المقترحة من المخزون:</strong>
        <ul style="margin: 4px 0 0 16px; padding: 0;">
          ${evalResult.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;

  return evalResult;
}


// --- Arabic Number to Words Helper (Tafqeet) for Official Quotation ---
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

function openCustomerQuoteModal(targetPkg = 'optimal') {
  const modal = document.getElementById('customer-quote-modal');
  if (!modal) {
    goToStep(5);
    return;
  }
  
  if (targetPkg === 'optimal') {
    if (State.matchedPackages) {
      State.activePackage = State.matchedPackages.optimalRecommendation || State.matchedPackages.packages.recommended;
    }
  }

  const nameInp = document.getElementById('modal-input-name');
  const phoneInp = document.getElementById('modal-input-phone');
  const addrInp = document.getElementById('modal-input-address');

  if (nameInp && State.customer.name && State.customer.name !== 'عميل بترونيل المميز') {
    nameInp.value = State.customer.name;
  }
  if (phoneInp && State.customer.phone) {
    phoneInp.value = State.customer.phone;
  }
  if (addrInp && State.customer.location) {
    addrInp.value = State.customer.location;
  }

  modal.classList.remove('hidden');
}

function closeCustomerQuoteModal() {
  const modal = document.getElementById('customer-quote-modal');
  if (modal) modal.classList.add('hidden');
}

function initCustomerQuoteModal() {
  const modal = document.getElementById('customer-quote-modal');
  const closeBtn = document.getElementById('btn-close-quote-modal');
  const form = document.getElementById('quote-customer-modal-form');

  closeBtn?.addEventListener('click', closeCustomerQuoteModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeCustomerQuoteModal();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('modal-input-name')?.value.trim() || 'عميل بترونيل المحترم';
    const phone = document.getElementById('modal-input-phone')?.value.trim() || '';
    const address = document.getElementById('modal-input-address')?.value.trim() || 'حضرموت - سيئون';

    State.customer.name = name;
    State.customer.phone = phone;
    State.customer.address = address;
    State.customer.location = address;

    if (!State.activePackage && State.matchedPackages) {
      State.activePackage = State.matchedPackages.optimalRecommendation || State.matchedPackages.packages.recommended;
    }

    if (!State.activePackage) {
      alert("يرجى التأكد من تحديد الأحمال لحساب المنظومة قبل إصدار عرض السعر.");
      closeCustomerQuoteModal();
      return;
    }

    const quotation = SolarEngine.generateQuotation(State.activePackage, State.designParams, State.customer);

    // Save quote to server so admin sees it
    try {
      await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          customerAddress: address,
          systemPackage: State.activePackage.title || 'منظومة كراون مايكرو المتكاملة',
          items: quotation ? quotation.items : [],
          grandTotal: quotation ? (quotation.financials.grandTotal || quotation.financials.totalCost) : 0,
          currency: 'SAR'
        })
      });
    } catch (err) {
      console.warn("Could not save quote to backend:", err);
    }

    closeCustomerQuoteModal();
    generateAndRenderQuotation();
    goToStep(5);
  });
}

function initStep4Packages() {
  // Optimal quote button
  document.getElementById('btn-order-optimal-quote')?.addEventListener('click', () => {
    openCustomerQuoteModal('optimal');
  });

  // Custom quote button
  document.getElementById('btn-order-custom-quote')?.addEventListener('click', () => {
    const evalRes = updateLiveCompatibilityCard();
    if (!evalRes) return;

    if (evalRes.overallStatus === 'critical') {
      const confirmContinue = confirm("تحذير هندسي: التركيب المختار يحتوي على تعارضات كهربائية قد تسبب فصلاً أو خطراً على الأجهزة.\n\nهل ترغب بالاستمرار رغم ذلك لمعاينة عرض السعر؟");
      if (!confirmContinue) return;
    }

    const invId = document.getElementById('custom-select-inverter').value;
    const panId = document.getElementById('custom-select-panel').value;
    const batId = document.getElementById('custom-select-battery').value;
    const panelsCount = parseInt(document.getElementById('custom-panels-count').value, 10) || 8;
    const batCount = parseInt(document.getElementById('custom-batteries-count').value, 10) || 1;

    const chosenInv = State.inventory.inverters.find(i => i.id === invId) || State.inventory.inverters[0];
    const chosenPan = State.inventory.panels.find(p => p.id === panId) || State.inventory.panels[0];
    const chosenBat = State.inventory.batteries.find(b => b.id === batId) || State.inventory.batteries[0];

    const stringing = SolarEngine.calculateElectricalStringing(chosenPan, chosenInv, (panelsCount * chosenPan.watt) / 1000, State.designParams);
    const isCrown = (chosenInv.brand || '').includes('Crown') || (chosenInv.name || '').includes('كراون');

    State.activePackage = {
      type: 'custom',
      title: 'منظومة مخصصة يدوياً',
      badge: isCrown ? 'تخصيص وكالة Crown Micro المعتمدة' : 'تم اختيار المكونات يدوياً من المخزون',
      inverter: { ...chosenInv, quantity: 1, totalCost: chosenInv.price },
      battery: { ...chosenBat, quantity: batCount, totalKwh: parseFloat((chosenBat.capacityKwh * batCount).toFixed(2)), usableKwh: parseFloat((chosenBat.usableKwh * batCount).toFixed(2)), totalCost: chosenBat.price * batCount },
      panel: { ...chosenPan, quantity: panelsCount, totalKw: parseFloat(((panelsCount * chosenPan.watt) / 1000).toFixed(2)), stringing, totalCost: chosenPan.price * panelsCount },
      compatibility: evalRes
    };

    openCustomerQuoteModal('custom');
  });

  // Any legacy select-pkg buttons
  document.querySelectorAll('.btn-select-pkg').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.getAttribute('data-pkg');
      State.selectedPackageType = type;
      if (State.matchedPackages && State.matchedPackages.packages && State.matchedPackages.packages[type]) {
        State.activePackage = State.matchedPackages.packages[type];
      }
      openCustomerQuoteModal(type);
    });
  });

  // Toggle manual tuning accordion
  const toggleTuning = document.getElementById('toggle-tuning-section');
  const tuningBody = document.getElementById('tuning-content');
  if (toggleTuning && tuningBody) {
    toggleTuning.addEventListener('click', () => {
      tuningBody.classList.toggle('hidden');
      toggleTuning.querySelector('.toggle-icon')?.classList.toggle('fa-chevron-up');
      updateLiveCompatibilityCard();
    });
  }

  // Live input & change events on tuning controls
  ['custom-select-inverter', 'custom-select-panel', 'custom-select-battery', 'custom-panels-count', 'custom-batteries-count'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateLiveCompatibilityCard);
      el.addEventListener('change', updateLiveCompatibilityCard);
    }
  });

  // Apply manual tuning button
  document.getElementById('btn-apply-custom-tuning')?.addEventListener('click', () => {
    const evalRes = updateLiveCompatibilityCard();
    if (!evalRes) return;
    alert("✅ تم تحديث وتدقيق الحسابات الهندسية للمكونات المختارة.");
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

  const mpptBanner = document.querySelector('.mppt-validation-banner');
  let errorBanner = document.getElementById('packages-error-banner');

  if (!matchResult || !matchResult.success) {
    State.activePackage = null;
    if (!errorBanner) {
      errorBanner = document.createElement('div');
      errorBanner.id = 'packages-error-banner';
      errorBanner.className = 'glass p-4 rounded-xl text-center mb-6 border border-amber-500/30 bg-amber-500/10';
      const container = document.querySelector('.tailored-design-grid');
      if (container && container.parentNode) {
        container.parentNode.insertBefore(errorBanner, container);
      }
    }
    const errMsg = (matchResult && matchResult.message) ? matchResult.message : 'يرجى إضافة الأجهزة وتحديد استهلاكك في الخطوة الأولى لحساب المنظومة المناسبة.';
    errorBanner.innerHTML = `<div style="padding: 16px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 12px; margin-bottom: 20px; text-align: center;">
      <i class="fa-solid fa-triangle-exclamation text-warning" style="font-size: 2rem; margin-bottom: 8px; display: block;"></i>
      <h4 style="font-size: 1.15rem; font-weight: bold; margin-bottom: 6px; color: #f59e0b;">تنبيه هندسي</h4>
      <p style="margin-bottom: 12px; font-size: 0.95rem; opacity: 0.9;">${errMsg}</p>
      <button type="button" class="btn btn-primary btn-sm" onclick="goToStep(2)">
        <i class="fa-solid fa-arrow-right"></i> الذهاب إلى قائمة الأجهزة
      </button>
    </div>`;
    errorBanner.style.display = 'block';

    if (mpptBanner) mpptBanner.style.opacity = '0.4';
    return;
  }

  if (errorBanner) errorBanner.style.display = 'none';
  if (mpptBanner) mpptBanner.style.opacity = '1';

  // 1. Populate Customer Need Card
  const need = matchResult.customerNeed || {
    minInverterContinuousKw: matchResult.sizingRequirements.minInverterContinuousKw,
    minInverterSurgeKw: matchResult.sizingRequirements.minInverterSurgeKw,
    targetUsableBatteryKwh: matchResult.sizingRequirements.targetUsableBatteryKwh,
    minPvKwPeak: matchResult.sizingRequirements.minPvKwPeak,
    dayEnergyKwh: profile.totalDayKwh,
    nightEnergyKwh: profile.totalNightKwh,
    outageHours: sched.totalOutageHours
  };

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('need-cont-kw', `${need.minInverterContinuousKw} kW`);
  setEl('need-surge-kw', `${need.minInverterSurgeKw} kW`);
  setEl('need-battery-kwh', `${need.targetUsableBatteryKwh} kWh`);
  setEl('need-pv-kw', `${need.minPvKwPeak} kWp`);
  setEl('need-day-night-kwh', `${need.dayEnergyKwh} نهاراً / ${need.nightEnergyKwh} ليلاً kWh`);
  setEl('need-outage-hours', `${need.outageHours} ساعة`);

  // 2. Populate Optimal Recommendation
  const opt = matchResult.optimalRecommendation || (matchResult.packages ? matchResult.packages.recommended : null);
  State.activePackage = opt;

  if (opt) {
    setEl('opt-pkg-title', opt.title || 'منظومة كراون مايكرو ولونجي المتكاملة');
    setEl('opt-inv-name', `${opt.inverter.name} (قدرة ${opt.inverter.capacityKw}kW - جهد ${opt.inverter.batteryVoltage || opt.inverter.systemVoltage || 48}V)`);
    setEl('opt-battery-name', `${opt.battery.quantity} × ${opt.battery.name} (${opt.battery.totalKwh} kWh)`);
    setEl('opt-panel-name', `${opt.panel.quantity} ألواح × ${opt.panel.name} (${opt.panel.totalKw} kWp)`);

    const optQuote = SolarEngine.generateQuotation(opt, State.designParams, State.customer);
    if (optQuote && optQuote.financials) {
      setEl('opt-price-sar', `${Math.round(optQuote.financials.totalCost).toLocaleString('en-US')} ر.س`);
    }

    // Render MPPT validation banner
    const stringing = opt.panel.stringing;
    if (stringing) {
      setEl('mppt-val-voc', `${stringing.stringVocCold}V`);
      setEl('mppt-val-vmp', `${stringing.stringVmpHot}V`);
      setEl('mppt-val-surge', `${opt.inverter.surgeKw || opt.inverter.surgeCapacityKw || (opt.inverter.capacityKw * 2)}kW`);
    }

    // Populate manual tuning dropdowns with optimal defaults
    populateManualTuningSelects(opt);
  }
}

function populateManualTuningSelects(defaultPkg) {
  const invSel = document.getElementById('custom-select-inverter');
  const panSel = document.getElementById('custom-select-panel');
  const batSel = document.getElementById('custom-select-battery');

  if (invSel) {
    invSel.innerHTML = State.inventory.inverters.map(i => `<option value="${i.id}" ${i.id === defaultPkg.inverter.id ? 'selected' : ''}>${i.name} (${i.capacityKw}kW) - ${i.price} ر.س</option>`).join('');
  }
  if (panSel) {
    panSel.innerHTML = State.inventory.panels.map(p => `<option value="${p.id}" ${p.id === defaultPkg.panel.id ? 'selected' : ''}>${p.name} (${p.watt}W) - ${p.price} ر.س</option>`).join('');
  }
  if (batSel) {
    batSel.innerHTML = State.inventory.batteries.map(b => `<option value="${b.id}" ${b.id === defaultPkg.battery.id ? 'selected' : ''}>${b.name} (${b.capacityKwh}kWh) - ${b.price} ر.س</option>`).join('');
  }

  const pCount = document.getElementById('custom-panels-count');
  const bCount = document.getElementById('custom-batteries-count');
  if (pCount) pCount.value = defaultPkg.panel.quantity;
  if (bCount) bCount.value = defaultPkg.battery.quantity;
}

// ============================================================
// STEP 5: عرض السعر والتقرير الفني الرسمي (Matching Official Template)
// ============================================================
function initStep5Quotation() {
  initCustomerQuoteModal();

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
    State.activePackage = State.matchedPackages.optimalRecommendation || State.matchedPackages.packages.recommended;
  }
  if (!State.activePackage) return;

  const quotation = SolarEngine.generateQuotation(State.activePackage, State.designParams, State.customer);
  if (!quotation) return;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Doc references
  setEl('quote-ref-code', quotation.quoteNo || quotation.quoteId);
  setEl('quote-issue-date', quotation.date);
  setEl('doc-client-name', quotation.customer.name || 'عميل بترونيل المحترم');
  setEl('doc-client-phone', quotation.customer.phone || '--');
  setEl('doc-client-location', quotation.customer.address || quotation.customer.location || 'حضرموت - سيئون');

  // BOM Table Rows matching official sheet
  const tbody = document.getElementById('quote-items-tbody');
  if (tbody) {
    tbody.innerHTML = quotation.items.map(item => `
      <tr>
        <td style="text-align: center; font-weight: bold;" class="font-num">${item.itemNumber}</td>
        <td>
          <strong style="display: block; font-size: 0.92rem; color: #0f172a;">${item.name}</strong>
          <small style="color: #64748b; font-size: 0.76rem; display: block; margin-top: 2px;">${item.specs}</small>
        </td>
        <td style="text-align: center;">${item.unit}</td>
        <td style="text-align: center; font-weight: bold;" class="font-num">${item.quantity}</td>
        <td style="text-align: center;" class="font-num">${item.unitPrice.toLocaleString('en-US')} ر.س</td>
        <td style="text-align: center; font-weight: 800; color: #1e3a8a;" class="font-num">${item.totalPrice.toLocaleString('en-US')} ر.س</td>
      </tr>
    `).join('');
  }

  // Financial figures in SAR
  const grandTotal = Math.round(quotation.financials.grandTotal || quotation.financials.totalCost);
  setEl('op-subtotal-sar', `${grandTotal.toLocaleString('en-US')} ر.س`);
  setEl('op-discount-sar', '0 ر.س');
  setEl('op-grandtotal-sar', `${grandTotal.toLocaleString('en-US')} ر.س`);
  setEl('doc-verbal-total', tafqeet(grandTotal));

  // Legacy element sync for any test or background script
  setEl('doc-total-usd', `$${quotation.financials.totalCostUsd || grandTotal}`);
  setEl('doc-total-yer', `${(quotation.financials.totalCostYer || grandTotal).toLocaleString('ar-YE')} ر.ي`);
  setEl('doc-cost-equipment', `$${quotation.financials.equipmentCostUsd || 0}`);
  setEl('doc-cost-accessories', `$${quotation.financials.accessoriesCostUsd || 0}`);
  setEl('doc-cost-install', `$${quotation.financials.installationFeeUsd || 0}`);
  setEl('quote-validity-text', `صلاحية العرض: ${quotation.validUntilDays || 7} أيام`);
  setEl('doc-package-type', State.activePackage.title);
  setEl('doc-inv-kw', `${quotation.systemOverview.inverterCapacityKw} kW`);
  setEl('doc-pv-kw', `${quotation.systemOverview.pvCapacityKw} kWp (${quotation.systemOverview.panelsCount} لوح)`);
  setEl('doc-bat-kwh', `${quotation.systemOverview.batteryCapacityKwh} kWh`);
  setEl('doc-outage-support', `${quotation.validUntilDays || 24} ساعة`);
}

function downloadQuotationPdf() {
  const element = document.getElementById('printable-quotation-area');
  if (!element || typeof html2pdf === 'undefined') {
    alert("جارٍ تشغيل نافذة الطباعة كبديل...");
    window.print();
    return;
  }

  const opt = {
    margin: [6, 6, 6, 6],
    filename: `عرض_سعر_بترونيل_يمن_${(State.customer.name || 'العميل').replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
}

function shareViaWhatsApp() {
  if (!State.activePackage) return;
  const quote = SolarEngine.generateQuotation(State.activePackage, State.designParams, State.customer);
  const totalSar = Math.round(quote.financials.grandTotal || quote.financials.totalCost);

  const text = `*عرض سعر رسمي من شركة بترونيل يمن للطاقة* ☀️
━━━━━━━━━━━━━━━━━━━━
👤 *العميل:* ${State.customer.name || 'عميل بترونيل المحترم'}
📍 *العنوان:* ${State.customer.address || 'حضرموت - سيئون'}
📄 *رقم العرض:* ${quote.quoteNo || quote.quoteId}
📦 *المنظومة:* ${State.activePackage.title}
⚡ *الإنفرتر:* ${quote.systemOverview.inverterCapacityKw} kW كراون مايكرو
☀️ *الألواح:* ${quote.systemOverview.panelsCount} لوح لونجي (${quote.systemOverview.pvCapacityKw} kWp)
🔋 *البطاريات:* ${quote.systemOverview.batteryCapacityKwh} kWh ليثيوم كراون مايكرو
━━━━━━━━━━━━━━━━━━━━
💰 *الإجمالي النهائي:* ${totalSar.toLocaleString('en-US')} ريال سعودي (SAR)
📝 *المبلغ كتابة:* ${tafqeet(totalSar)}
━━━━━━━━━━━━━━━━━━━━
📞 *بترونيل يمن للطاقة - الوكيل الحصري لـ Crown Micro:*
📍 سيئون - شارع الجزائر - مقابل حديقة الطويلة
📱 +967-779669868 / +967-770557550 / +971-557777395`;

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
