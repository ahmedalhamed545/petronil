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
