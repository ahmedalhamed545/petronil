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

  // Update hero stats live if visible
  const heroPv = document.getElementById('hero-pv-stat');
  if (heroPv && State.appliances.length > 0) {
    const profile = SolarEngine.calculateLoadProfile(State.appliances, schedule, 96);
    heroPv.textContent = `${(profile.peakContinuousKw * 1.3).toFixed(1)} kWp`;
  }
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
          لم يتم إضافة أي أجهزة بعد. انقر على بطاقات الأجهزة بالأعلى للبدء في حساب منظومتك.
        </td>
      </tr>
    `;
    return;
  }

  State.appliances.forEach((app, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="d-flex align-center gap-2">
          <i class="fa-solid ${app.icon || 'fa-plug'} text-primary"></i>
          <div>
            <strong>${app.name}</strong>
            <small class="text-muted d-block">${app.category || 'عام'}</small>
          </div>
        </div>
      </td>
      <td>
        <input type="number" min="1" max="50" class="form-control font-num text-center app-qty-input" value="${app.quantity}" style="width: 70px;">
      </td>
      <td>
        <input type="number" min="5" max="25000" class="form-control font-num text-center app-watt-input" value="${app.watt}" style="width: 85px;">
      </td>
      <td>
        <input type="number" min="0" max="12" step="0.5" class="form-control font-num text-center app-dh-input" value="${app.dayHours}" style="width: 75px;">
      </td>
      <td>
        <input type="number" min="0" max="12" step="0.5" class="form-control font-num text-center app-nh-input" value="${app.nightHours}" style="width: 75px;">
      </td>
      <td>
        <select class="form-control app-duty-select font-num" style="width: 90px;">
          <option value="1.0" ${app.dutyCycle === 1.0 ? 'selected' : ''}>100%</option>
          <option value="0.7" ${app.dutyCycle === 0.7 ? 'selected' : ''}>70%</option>
          <option value="0.5" ${app.dutyCycle === 0.5 ? 'selected' : ''}>50%</option>
          <option value="0.3" ${app.dutyCycle === 0.3 ? 'selected' : ''}>30%</option>
        </select>
      </td>
      <td>
        <span class="badge-priority badge-${app.priority}">
          ${app.priority === 'essential' ? 'أساسي' : (app.priority === 'sheddable' ? 'قابل للفصل' : 'مهم')}
        </span>
      </td>
      <td class="text-center">
        <button type="button" class="btn-remove-interval app-delete-btn" title="حذف الجهاز">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;

    // Bind row controls
    tr.querySelector('.app-qty-input').addEventListener('change', (e) => {
      app.quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
      updateLoadsMetrics();
    });
    tr.querySelector('.app-watt-input').addEventListener('change', (e) => {
      app.watt = Math.max(1, parseFloat(e.target.value) || 1);
      updateLoadsMetrics();
    });
    tr.querySelector('.app-dh-input').addEventListener('change', (e) => {
      app.dayHours = Math.max(0, Math.min(12, parseFloat(e.target.value) || 0));
      updateLoadsMetrics();
    });
    tr.querySelector('.app-nh-input').addEventListener('change', (e) => {
      app.nightHours = Math.max(0, Math.min(12, parseFloat(e.target.value) || 0));
      updateLoadsMetrics();
    });
    tr.querySelector('.app-duty-select').addEventListener('change', (e) => {
      app.dutyCycle = parseFloat(e.target.value) || 1.0;
      updateLoadsMetrics();
    });
    tr.querySelector('.app-delete-btn').addEventListener('click', () => {
      State.appliances.splice(idx, 1);
      renderSelectedAppliancesTable();
      updateLoadsMetrics();
    });

    tbody.appendChild(tr);
  });
}

function updateLoadsMetrics() {
  const sched = SolarEngine.parseGridSchedule({
    mode: State.grid.mode,
    intervals: State.grid.intervals,
    dailyHours: State.grid.dailyHours,
    worstOutageHours: State.grid.worstOutageHours
  }, 96);

  const profile = SolarEngine.calculateLoadProfile(State.appliances, sched, 96);

  document.getElementById('summary-total-kwh').innerHTML = `${profile.totalDailyKwh} <small>kWh/يوم</small>`;
  document.getElementById('summary-day-kwh').innerHTML = `${profile.totalDayKwh} <small>kWh</small>`;
  document.getElementById('summary-outage-kwh').innerHTML = `${profile.totalOutageKwh} <small>kWh</small>`;
  document.getElementById('summary-peak-kw').innerHTML = `${profile.peakContinuousKw} <small>kW</small>`;
  document.getElementById('summary-surge-kw').innerHTML = `${profile.maxSurgeKw} <small>kW</small>`;
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
