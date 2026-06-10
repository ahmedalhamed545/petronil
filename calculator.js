/**
 * Shamsuna Solar System Calculator - JavaScript Engine
 * Handles user interactions, state, solar formulas, and currency management
 */

// --- Default Appliance Specifications ---
const APPLIANCE_DEFAULTS = {
    ac: { name: 'مكيف هواء (1.5 طن)', watt: 1500, dayHours: 6, nightHours: 2, icon: 'fa-snowflake', quantity: 1 },
    fridge: { name: 'ثلاجة منزلية', watt: 200, dayHours: 10, nightHours: 14, icon: 'fa-cube', quantity: 1 },
    tv: { name: 'شاشة تلفزيون', watt: 100, dayHours: 4, nightHours: 4, icon: 'fa-tv', quantity: 1 },
    led: { name: 'إنارة LED (مجموعة)', watt: 80, dayHours: 1, nightHours: 6, icon: 'fa-lightbulb', quantity: 1 },
    washer: { name: 'غسالة ملابس', watt: 500, dayHours: 2, nightHours: 0, icon: 'fa-soap', quantity: 1 },
    fan: { name: 'مروحة كهربائية', watt: 75, dayHours: 8, nightHours: 8, icon: 'fa-fan', quantity: 1 },
    computer: { name: 'كمبيوتر / لاب توب', watt: 120, dayHours: 4, nightHours: 2, icon: 'fa-laptop', quantity: 1 },
    router: { name: 'راوتر إنترنت', watt: 15, dayHours: 12, nightHours: 12, icon: 'fa-wifi', quantity: 1 },
    pump: { name: 'مضخة مياه (1 حصان)', watt: 750, dayHours: 1, nightHours: 0, icon: 'fa-faucet-drip', quantity: 1 },
    microwave: { name: 'ميكروويف / فرن', watt: 1200, dayHours: 0.5, nightHours: 0.2, icon: 'fa-circle-dot', quantity: 1 }
};

// --- Currency Config ---
const CURRENCIES = {
    USD: { symbol: '$', rate: 1.0, format: (v) => `$${v.toLocaleString('en-US', {maximumFractionDigits: 0})}` },
    SAR: { symbol: 'ر.س', rate: 3.75, format: (v) => `${v.toLocaleString('ar-SA', {maximumFractionDigits: 0})} ر.س` }
};

// --- Fallback default values if backend/db is not loaded ---
const DEFAULT_PANELS = [
    { id: "panel_1", name: "لوح جينكو 610 واط N-Type", watt: 610, price: 110, available: true },
    { id: "panel_2", name: "لوح ترينا 550 واط كفاءة عالية", watt: 550, price: 95, available: true }
];
const DEFAULT_BATTERIES = [
    { id: "battery_1", name: "بطارية ليثيوم نارادا 5.12kWh 48V", capacityKwh: 5.12, price: 1200, available: true },
    { id: "battery_2", name: "بطارية ليثيوم BYD 10.24kWh 48V", capacityKwh: 10.24, price: 2300, available: true }
];
const DEFAULT_INVERTERS = [
    { id: "inv_15", name: "انفرتر داي ذكي 1.5kW 12V", capacityKw: 1.5, price: 250, available: true },
    { id: "inv_30", name: "انفرتر داي ذكي 3kW 24V", capacityKw: 3.0, price: 450, available: true },
    { id: "inv_50", name: "انفرتر داي ذكي 5kW 48V", capacityKw: 5.0, price: 750, available: true },
    { id: "inv_80", name: "انفرتر داي ذكي 8kW 48V", capacityKw: 8.0, price: 1100, available: true },
    { id: "inv_100", name: "انفرتر داي ذكي 10kW 48V", capacityKw: 10.0, price: 1400, available: true },
    { id: "inv_150", name: "انفرتر داي ذكي 15kW 48V", capacityKw: 15.0, price: 2000, available: true },
    { id: "inv_200", name: "انفرتر داي ذكي 20kW 48V", capacityKw: 20.0, price: 2600, available: true }
];

// --- State Management ---
let selectedAppliances = [];
let currentCurrency = 'USD';
let allPanels = [...DEFAULT_PANELS];
let allBatteries = [...DEFAULT_BATTERIES];
let allInverters = [...DEFAULT_INVERTERS];
let selectedPanelId = null;
let selectedBatteryId = null;
let selectedInverterId = null;

// Add default presets to demonstrate on load
const DEMO_PRESETS = [
    { type: 'fridge', q: 1, dh: 10, nh: 14 },
    { type: 'tv', q: 1, dh: 3, nh: 4 },
    { type: 'led', q: 1, dh: 1, nh: 6 },
    { type: 'fan', q: 2, dh: 8, nh: 6 },
    { type: 'router', q: 1, dh: 12, nh: 12 }
];

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileMenu();
    initAppliancePicker();
    initCurrencySelector();
    initActionButtons();
    initContactForm();
    
    // Populate dropdowns with default inventory on load (updated with backend later)
    populateDropdowns();
    initInventorySelects();
    
    // Load some default devices for a friendly first-look
    loadDemoPresets();
    
    // Fetch dynamic contents and presets from local server if available
    loadBackendContent();
});

// --- Theme Toggle Control ---
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    
    document.body.className = savedTheme;
    
    themeToggle.addEventListener('click', () => {
        if (document.body.classList.contains('dark-theme')) {
            document.body.classList.replace('dark-theme', 'light-theme');
            localStorage.setItem('theme', 'light-theme');
        } else {
            document.body.classList.replace('light-theme', 'dark-theme');
            localStorage.setItem('theme', 'dark-theme');
        }
    });
}

// --- Mobile Navigation Drawer Control ---
function initMobileMenu() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const drawer = document.querySelector('.mobile-drawer');
    const closeBtn = document.querySelector('.close-drawer');
    const drawerLinks = document.querySelectorAll('.drawer-link');

    const openDrawer = () => drawer.classList.add('open');
    const closeDrawer = () => drawer.classList.remove('open');

    menuToggle.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    drawerLinks.forEach(link => link.addEventListener('click', closeDrawer));
}

// --- Dynamic Appliance Grid Loading ---
function initAppliancePicker() {
    const picker = document.getElementById('appliance-picker');
    picker.innerHTML = ''; // Clear fallback design

    Object.keys(APPLIANCE_DEFAULTS).forEach(key => {
        const item = APPLIANCE_DEFAULTS[key];
        const card = document.createElement('button');
        card.className = 'appliance-picker-card';
        card.setAttribute('data-type', key);
        card.innerHTML = `
            <div class="card-badge font-num">${item.watt}W</div>
            <div class="appliance-icon"><i class="fa-solid ${item.icon}"></i></div>
            <span>${item.name}</span>
        `;
        card.addEventListener('click', () => addAppliance(key));
        picker.appendChild(card);
    });
}

// --- Selectors & Form Inputs Bindings ---
function initCurrencySelector() {
    const selector = document.getElementById('currency-select');
    selector.addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        populateDropdowns();
        calculateSystem();
    });
}

function initInventorySelects() {
    document.getElementById('calc-panel-select').addEventListener('change', (e) => {
        selectedPanelId = e.target.value;
        calculateSystem();
    });
    document.getElementById('calc-battery-select').addEventListener('change', (e) => {
        selectedBatteryId = e.target.value;
        calculateSystem();
    });
    document.getElementById('calc-inverter-select').addEventListener('change', (e) => {
        selectedInverterId = e.target.value;
        calculateSystem();
    });
}

function formatItemPrice(usdPrice) {
    const currency = CURRENCIES[currentCurrency];
    return currency.format(usdPrice * currency.rate);
}

function populateDropdowns() {
    const panelSelect = document.getElementById('calc-panel-select');
    const batterySelect = document.getElementById('calc-battery-select');
    
    if (!panelSelect || !batterySelect) return;
    
    // Clear and populate panels select
    panelSelect.innerHTML = '';
    const availablePanels = allPanels.filter(p => p.available);
    const panelsToUse = availablePanels.length > 0 ? availablePanels : DEFAULT_PANELS;
    panelsToUse.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const priceText = formatItemPrice(p.price);
        opt.innerText = `${p.name} (${p.watt}W) - ${priceText}`;
        panelSelect.appendChild(opt);
    });
    
    if (selectedPanelId && panelsToUse.some(p => p.id === selectedPanelId)) {
        panelSelect.value = selectedPanelId;
    } else if (panelsToUse.length > 0) {
        selectedPanelId = panelsToUse[0].id;
        panelSelect.value = selectedPanelId;
    }

    // Clear and populate batteries select
    batterySelect.innerHTML = '';
    const availableBatteries = allBatteries.filter(b => b.available);
    const batteriesToUse = availableBatteries.length > 0 ? availableBatteries : DEFAULT_BATTERIES;
    batteriesToUse.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        const priceText = formatItemPrice(b.price);
        opt.innerText = `${b.name} (${b.capacityKwh}kWh) - ${priceText}`;
        batterySelect.appendChild(opt);
    });

    if (selectedBatteryId && batteriesToUse.some(b => b.id === selectedBatteryId)) {
        batterySelect.value = selectedBatteryId;
    } else if (batteriesToUse.length > 0) {
        selectedBatteryId = batteriesToUse[0].id;
        batterySelect.value = selectedBatteryId;
    }
}



function initActionButtons() {
    document.getElementById('clear-all-appliances').addEventListener('click', () => {
        selectedAppliances = [];
        renderAppliancesList();
        calculateSystem();
    });

    document.getElementById('download-report').addEventListener('click', () => {
        const oldTitle = document.title;
        document.title = `تقرير_حساب_منظومة_بترونيل_يمن_${new Date().toISOString().slice(0, 10)}`;
        window.print();
        document.title = oldTitle;
    });

    document.getElementById('btn-add-custom').addEventListener('click', addCustomAppliance);
}

function loadDemoPresets() {
    DEMO_PRESETS.forEach(preset => {
        const def = APPLIANCE_DEFAULTS[preset.type];
        selectedAppliances.push({
            id: generateUniqueId(),
            type: preset.type,
            name: def.name,
            icon: def.icon,
            watt: def.watt,
            quantity: preset.q,
            dayHours: preset.dh,
            nightHours: preset.nh
        });
    });
    renderAppliancesList();
    calculateSystem();
}

// --- State Mutation & Rendering ---
function generateUniqueId() {
    return 'app_' + Math.random().toString(36).substr(2, 9);
}

function addAppliance(type) {
    // Check if the appliance already exists, then increment quantity
    const existing = selectedAppliances.find(item => item.type === type);
    if (existing) {
        existing.quantity += 1;
    } else {
        const def = APPLIANCE_DEFAULTS[type];
        selectedAppliances.push({
            id: generateUniqueId(),
            type: type,
            name: def.name,
            icon: def.icon,
            watt: def.watt,
            quantity: def.quantity,
            dayHours: def.dayHours,
            nightHours: def.nightHours
        });
    }
    renderAppliancesList();
    calculateSystem();
}

function addCustomAppliance() {
    const nameInput = document.getElementById('custom-appliance-name');
    const wattInput = document.getElementById('custom-appliance-watt');
    const name = nameInput.value.trim();
    const watt = parseFloat(wattInput.value);

    if (!name) {
        alert("يرجى إدخال اسم الجهاز الجديد");
        return;
    }
    if (isNaN(watt) || watt <= 0) {
        alert("يرجى إدخال قدرة كهربائية صحيحة بالوات (W)");
        return;
    }

    selectedAppliances.push({
        id: generateUniqueId(),
        type: 'custom',
        name: name,
        icon: 'fa-plug',
        watt: watt,
        quantity: 1,
        dayHours: 4,
        nightHours: 4
    });

    nameInput.value = '';
    wattInput.value = '';

    renderAppliancesList();
    calculateSystem();
}

function removeAppliance(id) {
    selectedAppliances = selectedAppliances.filter(item => item.id !== id);
    renderAppliancesList();
    calculateSystem();
}

function updateApplianceField(id, field, value) {
    const item = selectedAppliances.find(item => item.id === id);
    if (item) {
        let numVal = parseFloat(value);
        if (isNaN(numVal) || numVal < 0) numVal = 0;
        
        // Boundaries
        if (field === 'quantity' && numVal < 1) numVal = 1;
        if (field === 'dayHours' || field === 'nightHours') {
            if (numVal > 24) numVal = 24;
        }

        item[field] = numVal;
        calculateSystem();
    }
}

function renderAppliancesList() {
    const container = document.getElementById('selected-appliances-list');
    container.innerHTML = '';

    if (selectedAppliances.length === 0) {
        container.innerHTML = `
            <tr class="empty-placeholder">
                <td colspan="6" class="text-center py-5 text-muted">
                    <i class="fa-solid fa-circle-exclamation fa-2x mb-3 text-secondary d-block"></i>
                    لم يتم إضافة أي أجهزة بعد. انقر على بطاقات الأجهزة بالأعلى للبدء.
                </td>
            </tr>
        `;
        return;
    }

    selectedAppliances.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="الجهاز">
                <div class="table-device-name">
                    <i class="fa-solid ${item.icon} table-device-icon"></i>
                    <span>${item.name}</span>
                </div>
            </td>
            <td data-label="العدد">
                <div class="number-spinner">
                    <button class="spinner-btn" onclick="adjustSpinner('${item.id}', 'quantity', -1)">-</button>
                    <input type="number" class="spinner-input font-num" value="${item.quantity}" min="1" 
                        onchange="updateApplianceField('${item.id}', 'quantity', this.value)">
                    <button class="spinner-btn" onclick="adjustSpinner('${item.id}', 'quantity', 1)">+</button>
                </div>
            </td>
            <td data-label="القدرة (وات)">
                <input type="number" class="form-control-input font-num" value="${item.watt}" min="1" 
                    onchange="updateApplianceField('${item.id}', 'watt', this.value)">
            </td>
            <td data-label="نهاراً (ساعة)">
                <div class="number-spinner">
                    <button class="spinner-btn" onclick="adjustSpinner('${item.id}', 'dayHours', -1)">-</button>
                    <input type="number" class="spinner-input font-num" value="${item.dayHours}" min="0" max="24"
                        onchange="updateApplianceField('${item.id}', 'dayHours', this.value)">
                    <button class="spinner-btn" onclick="adjustSpinner('${item.id}', 'dayHours', 1)">+</button>
                </div>
            </td>
            <td data-label="ليلاً (ساعة)">
                <div class="number-spinner">
                    <button class="spinner-btn" onclick="adjustSpinner('${item.id}', 'nightHours', -1)">-</button>
                    <input type="number" class="spinner-input font-num" value="${item.nightHours}" min="0" max="24"
                        onchange="updateApplianceField('${item.id}', 'nightHours', this.value)">
                    <button class="spinner-btn" onclick="adjustSpinner('${item.id}', 'nightHours', 1)">+</button>
                </div>
            </td>
            <td data-label="إلغاء" class="text-center">
                <button class="btn-remove-row" onclick="removeAppliance('${item.id}')" aria-label="حذف">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        container.appendChild(tr);
    });
}

// Global spinner helper for HTML buttons
window.adjustSpinner = (id, field, change) => {
    const item = selectedAppliances.find(item => item.id === id);
    if (item) {
        let val = parseFloat(item[field]) + change;
        const minVal = (field === 'quantity') ? 1 : 0;
        const maxVal = (field === 'quantity') ? 999 : 24;
        
        if (val < minVal) val = minVal;
        if (val > maxVal) val = maxVal;
        
        updateApplianceField(id, field, val);
        renderAppliancesList();
    }
};

// --- Mathematical Solar Calculations ---
function calculateSystem() {
    if (selectedAppliances.length === 0) {
        resetResults();
        return;
    }

    // Parameters
    const batteryType = 'lithium';
    const safetyFactor = 1.25;
    const sunHours = 5.0;

    // 1. Energy Calculation (Wh)
    let totalDayEnergy = 0;
    let totalNightEnergy = 0;
    let peakLoad = 0;

    selectedAppliances.forEach(item => {
        const itemLoad = item.watt * item.quantity;
        totalDayEnergy += itemLoad * item.dayHours;
        totalNightEnergy += itemLoad * item.nightHours;
        peakLoad += itemLoad;
    });

    const totalDailyEnergy = totalDayEnergy + totalNightEnergy;

    // 2. Inverter sizing (kW)
    let simultaneousFactor = 1.0;
    if (peakLoad > 6000) simultaneousFactor = 0.70;
    else if (peakLoad > 3000) simultaneousFactor = 0.80;
    else if (peakLoad > 1500) simultaneousFactor = 0.90;

    const designPeakLoad = peakLoad * simultaneousFactor * 1.2; // 20% surge safety
    
    // Dynamically filter and populate inverters based on designPeakLoad
    populateInvertersDropdown(designPeakLoad);

    // Get current selected items
    selectedPanelId = document.getElementById('calc-panel-select').value;
    selectedBatteryId = document.getElementById('calc-battery-select').value;
    selectedInverterId = document.getElementById('calc-inverter-select').value;

    const selectedPanel = allPanels.find(p => p.id === selectedPanelId) || DEFAULT_PANELS[0];
    const selectedBattery = allBatteries.find(b => b.id === selectedBatteryId) || DEFAULT_BATTERIES[0];
    const selectedInverter = allInverters.find(inv => inv.id === selectedInverterId) || DEFAULT_INVERTERS[2]; // default to 5kW

    // System Voltage based on inverter capacity
    const systemVoltage = selectedInverter.capacityKw >= 5.0 ? 48 : (selectedInverter.capacityKw >= 3.0 ? 24 : 12);

    // 3. Solar Panels Calculations
    let totalSystemWattage = 0;
    selectedAppliances.forEach(item => {
        totalSystemWattage += item.watt * item.quantity;
    });

    let panelCount = Math.ceil((totalSystemWattage * 1.5) / selectedPanel.watt);
    if (panelCount % 2 !== 0) {
        panelCount += 1;
    }
    const totalPanelPowerWatts = panelCount * selectedPanel.watt;
    const requiredRoofArea = panelCount * 2.7;

    // 4. Battery Bank Calculations (Lithium batteries only, with custom rounding logic)
    const targetStorageWh = totalNightEnergy * 1.15;
    const dod = 0.90;
    const requiredKwh = (targetStorageWh / dod) / 1000;

    // Calculate required batteries of the selected battery capacity
    const batteryCount = requiredKwh > 0 ? Math.ceil(requiredKwh / selectedBattery.capacityKwh) : 0;
    const totalBatteryKwh = (batteryCount * selectedBattery.capacityKwh).toFixed(1);

    // 5. Costing & Quotation Setup
    const panelsTotalCostUsd = panelCount * selectedPanel.price;
    const batteriesTotalCostUsd = batteryCount * selectedBattery.price;
    const inverterCost = selectedInverter.price;
    
    const installationAccessoriesUsd = (panelsTotalCostUsd + batteriesTotalCostUsd + inverterCost) * 0.20; // 20%
    const grandTotalUsd = panelsTotalCostUsd + batteriesTotalCostUsd + inverterCost + installationAccessoriesUsd;

    // Currency Formatting
    const currency = CURRENCIES[currentCurrency];
    const rate = currency.rate;

    const formattedPanelsCost = currency.format(panelsTotalCostUsd * rate);
    const formattedBatteriesCost = currency.format(batteriesTotalCostUsd * rate);
    const formattedInverterCost = currency.format(inverterCost * rate);
    const formattedAccessoriesCost = currency.format(installationAccessoriesUsd * rate);
    const formattedGrandTotal = currency.format(grandTotalUsd * rate);

    // 6. Update UI
    const requiredPowerKw = (totalSystemWattage * 1.5) / 1000;
    document.getElementById('total-system-kw').innerHTML = `${requiredPowerKw.toFixed(2)} <span class="metric-unit">كيلووات (kW)</span>`;
    
    // Inverter subtext
    document.getElementById('result-inverter-sub').innerText = `انفرتر بموجة جيبية نقية (${systemVoltage}V)`;
    
    // Panels count
    document.getElementById('result-panels-count').innerText = `${panelCount} ألواح`;
    document.getElementById('result-panels-sub').innerText = `إجمالي: ${totalPanelPowerWatts.toLocaleString()} واط | المساحة: ${requiredRoofArea.toFixed(1)} م²`;
    
    // Batteries count
    if (totalNightEnergy === 0) {
        document.getElementById('result-batteries-count').innerText = `0 بطارية`;
        document.getElementById('result-batteries-sub').innerText = `المنظومة تعمل نهاراً فقط لتغطية الأحمال`;
    } else {
        document.getElementById('result-batteries-count').innerText = `${batteryCount} بطاريات`;
        document.getElementById('result-batteries-sub').innerText = `سعة التخزين: ${totalBatteryKwh} كيلووات/ساعة (kWh)`;
    }

    // Costs UI
    document.getElementById('cost-panels').innerText = formattedPanelsCost;
    document.getElementById('cost-batteries').innerText = totalNightEnergy === 0 ? currency.format(0) : formattedBatteriesCost;
    document.getElementById('cost-inverter').innerText = formattedInverterCost;
    document.getElementById('cost-accessories').innerText = formattedAccessoriesCost;
    
    const finalGrandTotal = totalNightEnergy === 0 
        ? (panelsTotalCostUsd + inverterCost + (panelsTotalCostUsd + inverterCost) * 0.15) // lower installation cost without battery setup
        : grandTotalUsd;

    document.getElementById('cost-total').innerText = currency.format(finalGrandTotal * rate);
    
    // Update Hidden Form fields
    document.getElementById('form-system-kw').value = requiredPowerKw.toFixed(2);
    document.getElementById('form-panels').value = `${panelCount} panels (${selectedPanel.name})`;
    document.getElementById('form-batteries').value = totalNightEnergy === 0 ? "None" : `${batteryCount} units (${selectedBattery.name})`;
    document.getElementById('form-inverter').value = `${selectedInverter.name}`;
    document.getElementById('form-total-cost').value = currency.format(finalGrandTotal * rate);

    // Update dynamic budget visual chart segments
    updateBudgetChart(panelsTotalCostUsd, totalNightEnergy === 0 ? 0 : batteriesTotalCostUsd, inverterCost, installationAccessoriesUsd);
}

function populateInvertersDropdown(designPeakLoad) {
    const inverterSelect = document.getElementById('calc-inverter-select');
    if (!inverterSelect) return;
    
    inverterSelect.innerHTML = '';

    const availableInverters = allInverters.filter(inv => inv.available);
    const invertersToUse = availableInverters.length > 0 ? availableInverters : DEFAULT_INVERTERS;

    // Filter sufficient ones based on capacityKw
    let minRequiredKw = 1.5;
    if (designPeakLoad <= 1200) minRequiredKw = 1.5;
    else if (designPeakLoad <= 2500) minRequiredKw = 3.0;
    else if (designPeakLoad <= 4500) minRequiredKw = 5.0;
    else if (designPeakLoad <= 7000) minRequiredKw = 8.0;
    else if (designPeakLoad <= 9000) minRequiredKw = 10.0;
    else if (designPeakLoad <= 13500) minRequiredKw = 15.0;
    else minRequiredKw = 20.0;

    let sufficientInverters = invertersToUse.filter(inv => inv.capacityKw >= minRequiredKw);
    if (sufficientInverters.length === 0) {
        // Fallback: use the largest available inverter
        const largest = invertersToUse.reduce((prev, current) => (prev.capacityKw > current.capacityKw) ? prev : current, invertersToUse[0]);
        sufficientInverters = [largest];
    }

    sufficientInverters.forEach(inv => {
        const opt = document.createElement('option');
        opt.value = inv.id;
        const priceText = formatItemPrice(inv.price);
        opt.innerText = `${inv.name} (${inv.capacityKw}kW) - ${priceText}`;
        inverterSelect.appendChild(opt);
    });

    if (selectedInverterId && sufficientInverters.some(inv => inv.id === selectedInverterId)) {
        inverterSelect.value = selectedInverterId;
    } else if (sufficientInverters.length > 0) {
        selectedInverterId = sufficientInverters[0].id;
        inverterSelect.value = selectedInverterId;
    }
}

function updateBudgetChart(panels, batteries, inverter, install) {
    const total = panels + batteries + inverter + install;
    if (total === 0) return;

    const pPct = ((panels / total) * 100).toFixed(0);
    const bPct = ((batteries / total) * 100).toFixed(0);
    const iPct = ((inverter / total) * 100).toFixed(0);
    const instPct = (100 - pPct - bPct - iPct); // remainder to ensure precise 100%

    const panelsSeg = document.querySelector('.segment-panels');
    const batteriesSeg = document.querySelector('.segment-batteries');
    const inverterSeg = document.querySelector('.segment-inverter');
    const installSeg = document.querySelector('.segment-install');

    panelsSeg.style.width = `${pPct}%`;
    panelsSeg.setAttribute('data-tooltip', `الألواح: ${pPct}%`);
    
    batteriesSeg.style.width = `${bPct}%`;
    batteriesSeg.setAttribute('data-tooltip', `البطاريات: ${bPct}%`);
    
    inverterSeg.style.width = `${iPct}%`;
    inverterSeg.setAttribute('data-tooltip', `العاكس: ${iPct}%`);
    
    installSeg.style.width = `${instPct}%`;
    installSeg.setAttribute('data-tooltip', `التركيب: ${instPct}%`);
}

function resetResults() {
    document.getElementById('total-system-kw').innerHTML = `0.00 <span class="metric-unit">كيلووات (kW)</span>`;
    
    const panelsCountEl = document.getElementById('result-panels-count');
    const batteriesCountEl = document.getElementById('result-batteries-count');
    if (panelsCountEl) panelsCountEl.innerText = '-- ألواح';
    if (batteriesCountEl) batteriesCountEl.innerText = '-- بطاريات';
    
    document.getElementById('result-panels-sub').innerText = 'إجمالي: -- واط | مساحة: -- م²';
    document.getElementById('result-batteries-sub').innerText = 'سعة تخزين: -- kWh';
    
    const currency = CURRENCIES[currentCurrency];
    document.getElementById('cost-panels').innerText = '--';
    document.getElementById('cost-batteries').innerText = '--';
    document.getElementById('cost-inverter').innerText = '--';
    document.getElementById('cost-accessories').innerText = '--';
    document.getElementById('cost-total').innerText = '--';
    
    document.querySelector('.segment-panels').style.width = '25%';
    document.querySelector('.segment-batteries').style.width = '25%';
    document.querySelector('.segment-inverter').style.width = '25%';
    document.querySelector('.segment-install').style.width = '25%';
}

// --- Contact Form Handling ---
function initContactForm() {
    const form = document.getElementById('lead-form');
    const successMsg = document.getElementById('form-success-msg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            name: document.getElementById('client-name').value.trim(),
            phone: document.getElementById('client-phone').value.trim(),
            notes: (document.getElementById('client-notes').value.trim() || '') + ` (المدينة: ${document.getElementById('client-city').value.trim()})`,
            systemSizeKw: parseFloat(document.getElementById('form-system-kw').value),
            panelsCount: document.getElementById('form-panels').value,
            batteriesKwh: document.getElementById('form-batteries').value,
            inverterKva: document.getElementById('form-inverter').value,
            totalCost: document.getElementById('form-total-cost').value,
            currency: currentCurrency
        };

        try {
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                form.classList.add('hidden');
                successMsg.classList.remove('hidden');
            } else {
                alert("تعذر إرسال الطلب، يرجى ملء الحقول بشكل صحيح");
            }
        } catch (err) {
            console.error("Error submitting lead:", err);
            // Fallback for offline mode
            form.classList.add('hidden');
            successMsg.classList.remove('hidden');
        }
    });
}

// --- Dynamic Content Loader from Backend ---
async function loadBackendContent() {
    try {
        const res = await fetch('/api/content');
        if (!res.ok) return;
        const data = await res.json();
        
        // Update settings text
        if (data.settings) {
            const s = data.settings;
            if (s.title) document.title = s.title;
            
            const heroTitleEl = document.getElementById('main-hero-title');
            const heroSubEl = document.getElementById('main-hero-subtitle');
            const addressEl = document.getElementById('main-address');
            const phoneEl = document.getElementById('main-phone');
            const emailEl = document.getElementById('main-email');
            
            if (heroTitleEl && s.heroTitle) heroTitleEl.innerText = s.heroTitle;
            if (heroSubEl && s.heroSubtitle) heroSubEl.innerText = s.heroSubtitle;
            if (addressEl && s.address) addressEl.innerText = s.address;
            if (phoneEl && s.phone) phoneEl.innerText = s.phone;
            if (emailEl && s.email) emailEl.innerText = s.email;
        }

        // Update panels, batteries, inverters arrays from backend
        if (data.panels && data.panels.length > 0) {
            allPanels = data.panels;
        }
        if (data.batteries && data.batteries.length > 0) {
            allBatteries = data.batteries;
        }
        if (data.inverters && data.inverters.length > 0) {
            allInverters = data.inverters;
        }
        
        populateDropdowns();
        
        // Update appliances defaults
        if (data.appliances && data.appliances.length > 0) {
            const hasUserInteracted = selectedAppliances.length > DEMO_PRESETS.length;
            
            // Clear current defaults
            Object.keys(APPLIANCE_DEFAULTS).forEach(key => delete APPLIANCE_DEFAULTS[key]);
            
            data.appliances.forEach(app => {
                APPLIANCE_DEFAULTS[app.id] = {
                    name: app.name,
                    watt: app.watt,
                    dayHours: app.dayHours,
                    nightHours: app.nightHours,
                    icon: app.icon || 'fa-plug',
                    quantity: 1
                };
            });
            
            initAppliancePicker();
            
            if (!hasUserInteracted) {
                selectedAppliances = [];
                DEMO_PRESETS.forEach(preset => {
                    if (APPLIANCE_DEFAULTS[preset.type]) {
                        const def = APPLIANCE_DEFAULTS[preset.type];
                        selectedAppliances.push({
                            id: generateUniqueId(),
                            type: preset.type,
                            name: def.name,
                            icon: def.icon,
                            watt: def.watt,
                            quantity: preset.q,
                            dayHours: preset.dh,
                            nightHours: preset.nh
                        });
                    }
                });
                renderAppliancesList();
            }
        }

        calculateSystem();
    } catch (err) {
        console.log("Could not load backend content, running in offline/static mode.");
    }
}

