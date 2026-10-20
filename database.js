const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'db.json');

// Initial defaults
const DEFAULT_DATA = {
  settings: {
    title: "بترونيل يمن للطاقة",
    heroBadge: "طاقة خضراء، مستدامة ونظيفة",
    heroTitle: "تحكّم بكهربائك ووفر أموالك مع بترونيل يمن",
    heroSubtitle: "نحن نؤمن لك أفضل حلول الطاقة البديلة والأنظمة الشمسية الذكية من بترونيل يمن. احسب منظومتك المتكاملة الآن بضغطة زر واحصل على تصميم فني دقيق وتكلفة تقديرية فورية.",
    servicesTitle: "لماذا تختار بترونيل يمن؟",
    servicesSubtitle: "نقدم خدمات متكاملة تضمن لك أعلى كفاءة وأطول عمر افتراضي للمنظومة الشمسية",
    service1Title: "أجود أنواع الألواح",
    service1Desc: "نوفر ألواحاً شمسية من الفئة الأولى (Tier 1) بنظام أنصاف الخلايا (Half-Cell) المقاوم للظلال وذو الكفاءة العالية.",
    service2Title: "بطاريات ليثيوم متطورة",
    service2Desc: "حلول تخزين طاقة فائقة الأمان من بطاريات الليثيوم LiFePO4 ذات العمر الافتراضي الطويل والكفاءة العالية.",
    service3Title: "انفرترات ذكية",
    service3Desc: "انفرترات طاقة بموجة جيبية نقية متطورة تدعم الشحن الذكي والتحكم الفوري عبر الهواتف الذكية.",
    service4Title: "صيانة ودعم فني مستمر",
    service4Desc: "فريق متكامل من المهندسين والفنيين لضمان التركيب الاحترافي الآمن وتقديم خدمات الصيانة الدورية.",
    footerAbout: "بترونيل يمن للطاقة - شركاؤكم في توفير الطاقة البديلة والنظيفة بأحدث التقنيات وأفضل الأسعار.",
    address: "عدن - المنصورة، خلف محطة التسعين، أمام فندق قتبان",
    phone: "783999039",
    email: "info@petronilyemen.com"
  },
  designParams: {
    defaultSunHours: 5.5,
    systemLossFactor: 0.80,
    batteryRoundTripEfficiency: 0.95,
    inverterEfficiency: 0.97,
    wiringLoss: 0.03,
    temperatureDerating: 0.05,
    safetyMargin: 1.25,
    solarFractionDay: 0.8,
    minBatteryAutonomy: 4,
    quoteValidityDays: 30,
    installationCostPercent: 0.15,
    currency: "USD",
    companyName: "بترونيل يمن للطاقة",
    companyPhone: "783999039",
    companyEmail: "info@petronilyemen.com",
    companyAddress: "عدن - المنصورة، خلف محطة التسعين، أمام فندق قتبان",
    companyWebsite: "petronilsolar.onrender.com"
  },
  appliances: [
    { id: "ac", name: "مكيف هواء (1.5 طن)", watt: 1500, dayHours: 6, nightHours: 2, icon: "fa-snowflake", quantity: 1 },
    { id: "fridge", name: "ثلاجة منزلية", watt: 200, dayHours: 10, nightHours: 14, icon: "fa-cube", quantity: 1 },
    { id: "tv", name: "شاشة تلفزيون", watt: 100, dayHours: 4, nightHours: 4, icon: "fa-tv", quantity: 1 },
    { id: "led", name: "إنارة LED (مجموعة)", watt: 80, dayHours: 1, nightHours: 6, icon: "fa-lightbulb", quantity: 1 },
    { id: "washer", name: "غسالة ملابس", watt: 500, dayHours: 2, nightHours: 0, icon: "fa-soap", quantity: 1 },
    { id: "fan", name: "مروحة كهربائية", watt: 75, dayHours: 8, nightHours: 8, icon: "fa-fan", quantity: 1 },
    { id: "computer", name: "كمبيوتر / لاب توب", watt: 120, dayHours: 4, nightHours: 2, icon: "fa-laptop", quantity: 1 },
    { id: "router", name: "راوتر إنترنت", watt: 15, dayHours: 12, nightHours: 12, icon: "fa-wifi", quantity: 1 },
    { id: "pump", name: "مضخة مياه (1 حصان)", watt: 750, dayHours: 1, nightHours: 0, icon: "fa-faucet-drip", quantity: 1 },
    { id: "microwave", name: "ميكروويف / فرن", watt: 1200, dayHours: 0.5, nightHours: 0.2, icon: "fa-circle-dot", quantity: 1 }
  ],
  users: [
    { username: "admin", passwordHash: "", role: "SuperAdmin", permissions: ["overview", "leads", "appliances", "content", "inventory", "users"] },
    { username: "editor", passwordHash: "", role: "Editor", permissions: ["overview", "leads", "appliances", "inventory"] }
  ],
  leads: [],
  quotes: [],
  panels: [
    {
      id: "panel_1",
      name: "لوح Jinko 610W N-Type Bifacial",
      brand: "Jinko",
      model: "JKM610N-78HL4-BDV",
      watt: 610,
      voc: 49.65,
      vmp: 41.74,
      isc: 15.76,
      imp: 14.62,
      tempCoefficientVoc: -0.0026,
      tempCoefficientPmax: -0.0030,
      tempCoefficientIsc: 0.0005,
      width: 1134,
      height: 2278,
      warranty: 30,
      price: 110,
      available: true
    },
    {
      id: "panel_2",
      name: "لوح Jinko 555W N-Type",
      brand: "Jinko",
      model: "JKM555N-72HL4-BDV",
      watt: 555,
      voc: 45.8,
      vmp: 38.5,
      isc: 15.1,
      imp: 14.4,
      tempCoefficientVoc: -0.0026,
      tempCoefficientPmax: -0.0030,
      tempCoefficientIsc: 0.0005,
      width: 1134,
      height: 2094,
      warranty: 30,
      price: 95,
      available: true
    },
    {
      id: "panel_3",
      name: "لوح Trina 545W",
      brand: "Trina",
      model: "TSM-545DE18M.08(II)",
      watt: 545,
      voc: 45.0,
      vmp: 37.8,
      isc: 14.96,
      imp: 14.42,
      tempCoefficientVoc: -0.0026,
      tempCoefficientPmax: -0.0034,
      tempCoefficientIsc: 0.0005,
      width: 1134,
      height: 2094,
      warranty: 25,
      price: 88,
      available: true
    }
  ],
  batteries: [
    {
      id: "battery_1",
      name: "بطارية ليثيوم Crown 5.12kWh",
      brand: "Crown",
      model: "CM-LFP-51.2V-100Ah",
      chemistry: "LiFePO4",
      nominalVoltage: 51.2,
      capacityAh: 100,
      capacityKwh: 5.12,
      dod: 0.9,
      usableKwh: 4.608,
      maxChargeCurrent: 100,
      maxDischargeCurrent: 100,
      continuousDischargeKw: 5.12,
      bmsLimit: true,
      communicationProtocol: "CAN",
      maxParallel: 4,
      maxSeries: 1,
      voltageRange: [44, 58.4],
      price: 950,
      warranty: 10,
      available: true
    },
    {
      id: "battery_2",
      name: "بطارية ليثيوم Crown 10.24kWh",
      brand: "Crown",
      model: "CM-LFP-51.2V-200Ah",
      chemistry: "LiFePO4",
      nominalVoltage: 51.2,
      capacityAh: 200,
      capacityKwh: 10.24,
      dod: 0.9,
      usableKwh: 9.216,
      maxChargeCurrent: 200,
      maxDischargeCurrent: 200,
      continuousDischargeKw: 10.24,
      bmsLimit: true,
      communicationProtocol: "CAN",
      maxParallel: 4,
      maxSeries: 1,
      voltageRange: [44, 58.4],
      price: 1800,
      warranty: 10,
      available: true
    },
    {
      id: "battery_3",
      name: "بطارية AGM Gel 12V 200Ah",
      brand: "Generic",
      model: "AGM-GEL-12V-200Ah",
      chemistry: "Lead-Acid",
      nominalVoltage: 12,
      capacityAh: 200,
      capacityKwh: 2.4,
      dod: 0.5,
      usableKwh: 1.2,
      maxChargeCurrent: 40,
      maxDischargeCurrent: 50,
      continuousDischargeKw: 0.6,
      bmsLimit: false,
      communicationProtocol: null,
      maxParallel: 4,
      maxSeries: 4,
      voltageRange: [10.5, 14.4],
      price: 280,
      warranty: 2,
      available: true
    }
  ],
  inverters: [
    {
      id: "inv_35",
      name: "انفرتر Deye SUN-3.6K-SG04LP1 3.6kW",
      brand: "Deye",
      model: "SUN-3.6K-SG04LP1",
      capacityKw: 3.6,
      capacityVa: 3600,
      systemVoltage: 48,
      phases: 1,
      mpptMin: 80,
      mpptMax: 430,
      maxVocInput: 500,
      maxIscInput: 13,
      maxPvPower: 4600,
      mpptTrackers: 2,
      maxPvCurrentPerMppt: 13,
      chargeCurrentA: 60,
      dischargeCurrentA: 60,
      batteryVoltageRange: [40, 60],
      batteryCompatibility: ["LiFePO4", "Lead-Acid"],
      powerFactor: 1.0,
      surgeCapacityKw: 7.2,
      surgeDurationSec: 5,
      efficiency: 0.97,
      price: 550,
      warranty: 5,
      available: true,
      notes: "يجب التحقق من المواصفات من datasheet رسمي"
    },
    {
      id: "inv_50",
      name: "انفرتر Deye SUN-5K-SG04LP1 5kW",
      brand: "Deye",
      model: "SUN-5K-SG04LP1",
      capacityKw: 5.0,
      capacityVa: 5000,
      systemVoltage: 48,
      phases: 1,
      mpptMin: 120,
      mpptMax: 430,
      maxVocInput: 500,
      maxIscInput: 15,
      maxPvPower: 6500,
      mpptTrackers: 2,
      maxPvCurrentPerMppt: 15,
      chargeCurrentA: 80,
      dischargeCurrentA: 80,
      batteryVoltageRange: [40, 60],
      batteryCompatibility: ["LiFePO4", "Lead-Acid"],
      powerFactor: 1.0,
      surgeCapacityKw: 10,
      surgeDurationSec: 5,
      efficiency: 0.97,
      price: 750,
      warranty: 5,
      available: true,
      notes: "يجب التحقق من المواصفات من datasheet رسمي"
    },
    {
      id: "inv_80",
      name: "انفرتر Deye SUN-8K-SG04LP3 8kW",
      brand: "Deye",
      model: "SUN-8K-SG04LP3",
      capacityKw: 8.0,
      capacityVa: 8000,
      systemVoltage: 48,
      phases: 3,
      mpptMin: 200,
      mpptMax: 750,
      maxVocInput: 850,
      maxIscInput: 15,
      maxPvPower: 10400,
      mpptTrackers: 2,
      maxPvCurrentPerMppt: 15,
      chargeCurrentA: 100,
      dischargeCurrentA: 100,
      batteryVoltageRange: [40, 60],
      batteryCompatibility: ["LiFePO4", "Lead-Acid"],
      powerFactor: 1.0,
      surgeCapacityKw: 16,
      surgeDurationSec: 5,
      efficiency: 0.97,
      price: 1200,
      warranty: 5,
      available: true,
      notes: "يجب التحقق من المواصفات من datasheet رسمي"
    },
    {
      id: "inv_100",
      name: "انفرتر Deye SUN-10K-SG04LP3 10kW",
      brand: "Deye",
      model: "SUN-10K-SG04LP3",
      capacityKw: 10.0,
      capacityVa: 10000,
      systemVoltage: 48,
      phases: 3,
      mpptMin: 200,
      mpptMax: 750,
      maxVocInput: 850,
      maxIscInput: 15,
      maxPvPower: 13000,
      mpptTrackers: 2,
      maxPvCurrentPerMppt: 15,
      chargeCurrentA: 120,
      dischargeCurrentA: 120,
      batteryVoltageRange: [40, 60],
      batteryCompatibility: ["LiFePO4", "Lead-Acid"],
      powerFactor: 1.0,
      surgeCapacityKw: 20,
      surgeDurationSec: 5,
      efficiency: 0.97,
      price: 1500,
      warranty: 5,
      available: true,
      notes: "يجب التحقق من المواصفات من datasheet رسمي"
    },
    {
      id: "inv_120",
      name: "انفرتر Deye SUN-12K-SG04LP3 12kW",
      brand: "Deye",
      model: "SUN-12K-SG04LP3",
      capacityKw: 12.0,
      capacityVa: 12000,
      systemVoltage: 48,
      phases: 3,
      mpptMin: 200,
      mpptMax: 750,
      maxVocInput: 850,
      maxIscInput: 15,
      maxPvPower: 15600,
      mpptTrackers: 2,
      maxPvCurrentPerMppt: 15,
      chargeCurrentA: 150,
      dischargeCurrentA: 150,
      batteryVoltageRange: [40, 60],
      batteryCompatibility: ["LiFePO4", "Lead-Acid"],
      powerFactor: 1.0,
      surgeCapacityKw: 24,
      surgeDurationSec: 5,
      efficiency: 0.97,
      price: 1800,
      warranty: 5,
      available: true,
      notes: "يجب التحقق من المواصفات من datasheet رسمي"
    },
    {
      id: "inv_150",
      name: "انفرتر Deye SUN-15K-SG04LP3 15kW",
      brand: "Deye",
      model: "SUN-15K-SG04LP3",
      capacityKw: 15.0,
      capacityVa: 15000,
      systemVoltage: 48,
      phases: 3,
      mpptMin: 200,
      mpptMax: 750,
      maxVocInput: 850,
      maxIscInput: 15,
      maxPvPower: 19500,
      mpptTrackers: 2,
      maxPvCurrentPerMppt: 15,
      chargeCurrentA: 180,
      dischargeCurrentA: 180,
      batteryVoltageRange: [40, 60],
      batteryCompatibility: ["LiFePO4", "Lead-Acid"],
      powerFactor: 1.0,
      surgeCapacityKw: 30,
      surgeDurationSec: 5,
      efficiency: 0.97,
      price: 2200,
      warranty: 5,
      available: true,
      notes: "يجب التحقق من المواصفات من datasheet رسمي"
    },
    {
      id: "inv_200",
      name: "انفرتر Deye SUN-20K-SG04LP3 20kW",
      brand: "Deye",
      model: "SUN-20K-SG04LP3",
      capacityKw: 20.0,
      capacityVa: 20000,
      systemVoltage: 48,
      phases: 3,
      mpptMin: 200,
      mpptMax: 750,
      maxVocInput: 850,
      maxIscInput: 15,
      maxPvPower: 26000,
      mpptTrackers: 2,
      maxPvCurrentPerMppt: 15,
      chargeCurrentA: 240,
      dischargeCurrentA: 240,
      batteryVoltageRange: [40, 60],
      batteryCompatibility: ["LiFePO4", "Lead-Acid"],
      powerFactor: 1.0,
      surgeCapacityKw: 40,
      surgeDurationSec: 5,
      efficiency: 0.97,
      price: 2800,
      warranty: 5,
      available: true,
      notes: "يجب التحقق من المواصفات من datasheet رسمي"
    }
  ]
};

// Ensure database exists and is populated
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    console.log("Database file db.json does not exist. Creating new database...");

    // Hash default passwords synchronously
    const adminHash = bcrypt.hashSync("admin@petronil2026", 10);
    const editorHash = bcrypt.hashSync("editor@petronil2026", 10);

    const initialData = JSON.parse(JSON.stringify(DEFAULT_DATA));
    initialData.users[0].passwordHash = adminHash;
    initialData.users[1].passwordHash = editorHash;

    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
    console.log("Database initialized successfully with default admin and editor.");
  } else {
    // Read and verify structure (simple check & update if missing tables)
    try {
      const data = readDb();
      let modified = false;

      if (!data.settings || !data.appliances || !data.users || !data.leads) {
        console.log("Database file is corrupted. Reinitializing...");
        fs.unlinkSync(DB_PATH);
        initDatabase();
        return;
      }

      // Dynamic migration for inventory tables if missing
      if (!data.panels) {
        data.panels = DEFAULT_DATA.panels;
        modified = true;
      }
      if (!data.batteries) {
        data.batteries = DEFAULT_DATA.batteries;
        modified = true;
      }
      if (!data.inverters) {
        data.inverters = DEFAULT_DATA.inverters;
        modified = true;
      }

      // Migration: add designParams if missing
      if (!data.designParams) {
        data.designParams = DEFAULT_DATA.designParams;
        modified = true;
      }

      // Migration: add quotes table if missing
      if (!data.quotes) {
        data.quotes = [];
        modified = true;
      }

      if (modified) {
        console.log("Database exists but some tables are missing. Migrating...");
        writeDb(data);
      }
    } catch (err) {
      console.error("Error reading database on init. Reinitializing...", err);
      fs.unlinkSync(DB_PATH);
      initDatabase();
    }
  }
}

// Read database
function readDb() {
  const content = fs.readFileSync(DB_PATH, 'utf8');
  const data = JSON.parse(content);

  // Auto-migrate users if permissions array is missing
  let modified = false;
  if (data.users && Array.isArray(data.users)) {
    data.users.forEach(u => {
      if (!u.permissions) {
        if (u.role === 'SuperAdmin') {
          u.permissions = ["overview", "leads", "appliances", "content", "inventory", "users"];
        } else {
          u.permissions = ["overview", "leads", "appliances", "inventory"];
        }
        modified = true;
      }
    });
  }

  if (modified) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  }

  return data;
}

// Write database
function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Initialize database right away
initDatabase();

module.exports = {
  // Settings CRUD
  getSettings() {
    return readDb().settings;
  },
  updateSettings(newSettings) {
    const db = readDb();
    db.settings = { ...db.settings, ...newSettings };
    writeDb(db);
    return db.settings;
  },

  // Content helper
  getContent() {
    const db = readDb();
    return {
      settings: db.settings,
      designParams: db.designParams || DEFAULT_DATA.designParams,
      appliances: db.appliances,
      panels: db.panels || [],
      batteries: db.batteries || [],
      inverters: db.inverters || []
    };
  },

  // Design Parameters
  getDesignParams() {
    return readDb().designParams || DEFAULT_DATA.designParams;
  },
  updateDesignParams(params) {
    const db = readDb();
    db.designParams = { ...db.designParams, ...params };
    writeDb(db);
    return db.designParams;
  },

  // Quotes
  getQuotes() {
    return readDb().quotes || [];
  },
  addQuote(quote) {
    const db = readDb();
    const newQuote = {
      id: 'quote_' + Date.now(),
      ...quote,
      createdAt: new Date().toISOString(),
      status: 'Draft'
    };
    if (!db.quotes) db.quotes = [];
    db.quotes.push(newQuote);
    writeDb(db);
    return newQuote;
  },
  deleteQuote(id) {
    const db = readDb();
    const filtered = db.quotes.filter(q => q.id !== id);
    const deleted = db.quotes.length !== filtered.length;
    db.quotes = filtered;
    writeDb(db);
    return deleted;
  },

  // Appliances CRUD
  getAppliances() {
    return readDb().appliances;
  },
  addAppliance(appliance) {
    const db = readDb();
    const newApp = {
      id: 'app_' + Math.random().toString(36).substr(2, 9),
      name: appliance.name,
      category: appliance.category || 'عام',
      watt: Number(appliance.watt),
      powerFactor: Number(appliance.powerFactor || 0.9),
      loadType: appliance.loadType || 'resistive',
      surgeMultiplier: Number(appliance.surgeMultiplier || 1.0),
      dutyCycle: Number(appliance.dutyCycle || 1.0),
      dayHours: Number(appliance.dayHours || 4),
      nightHours: Number(appliance.nightHours || 4),
      timeWindows: Array.isArray(appliance.timeWindows) ? appliance.timeWindows : [],
      priority: appliance.priority || 'important',
      icon: appliance.icon || 'fa-plug',
      quantity: Number(appliance.quantity || 1)
    };
    db.appliances.push(newApp);
    writeDb(db);
    return newApp;
  },
  updateAppliance(id, updatedFields) {
    const db = readDb();
    const index = db.appliances.findIndex(a => a.id === id);
    if (index === -1) return null;

    db.appliances[index] = {
      ...db.appliances[index],
      ...updatedFields,
      watt: updatedFields.watt !== undefined ? Number(updatedFields.watt) : db.appliances[index].watt,
      powerFactor: updatedFields.powerFactor !== undefined ? Number(updatedFields.powerFactor) : db.appliances[index].powerFactor,
      surgeMultiplier: updatedFields.surgeMultiplier !== undefined ? Number(updatedFields.surgeMultiplier) : db.appliances[index].surgeMultiplier,
      dutyCycle: updatedFields.dutyCycle !== undefined ? Number(updatedFields.dutyCycle) : db.appliances[index].dutyCycle,
      dayHours: updatedFields.dayHours !== undefined ? Number(updatedFields.dayHours) : db.appliances[index].dayHours,
      nightHours: updatedFields.nightHours !== undefined ? Number(updatedFields.nightHours) : db.appliances[index].nightHours,
      quantity: updatedFields.quantity !== undefined ? Number(updatedFields.quantity) : db.appliances[index].quantity
    };
    writeDb(db);
    return db.appliances[index];
  },
  deleteAppliance(id) {
    const db = readDb();
    const filtered = db.appliances.filter(a => a.id !== id);
    const deleted = db.appliances.length !== filtered.length;
    db.appliances = filtered;
    writeDb(db);
    return deleted;
  },

  // Leads CRUD
  getLeads() {
    return readDb().leads;
  },
  addLead(lead) {
    const db = readDb();
    const newLead = {
      id: 'lead_' + Math.random().toString(36).substr(2, 9),
      name: lead.name,
      phone: lead.phone,
      notes: lead.notes || '',
      systemSizeKw: lead.systemSizeKw,
      panelsCount: lead.panelsCount,
      batteriesKwh: lead.batteriesKwh,
      inverterKva: lead.inverterKva,
      totalCost: lead.totalCost,
      currency: lead.currency || 'USD',
      status: 'New', // New, Contacted, Completed
      createdAt: new Date().toISOString()
    };
    db.leads.push(newLead);
    writeDb(db);
    return newLead;
  },
  updateLeadStatus(id, status) {
    const db = readDb();
    const lead = db.leads.find(l => l.id === id);
    if (!lead) return null;
    lead.status = status;
    writeDb(db);
    return lead;
  },
  deleteLead(id) {
    const db = readDb();
    const filtered = db.leads.filter(l => l.id !== id);
    const deleted = db.leads.length !== filtered.length;
    db.leads = filtered;
    writeDb(db);
    return deleted;
  },

  // Users Auth & Management
  verifyUser(username, password) {
    const db = readDb();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return null;

    const match = bcrypt.compareSync(password, user.passwordHash);
    if (match) {
      return { username: user.username, role: user.role, permissions: user.permissions || [] };
    }
    return null;
  },
  getUsers() {
    return readDb().users.map(u => ({ username: u.username, role: u.role, permissions: u.permissions || [] }));
  },
  addUser(user) {
    const db = readDb();
    const exists = db.users.some(u => u.username.toLowerCase() === user.username.toLowerCase());
    if (exists) return null;

    const newUser = {
      username: user.username.toLowerCase(),
      passwordHash: bcrypt.hashSync(user.password, 10),
      role: user.role || 'Editor',
      permissions: user.permissions || ["overview", "leads", "appliances", "inventory"]
    };
    db.users.push(newUser);
    writeDb(db);
    return { username: newUser.username, role: newUser.role, permissions: newUser.permissions };
  },
  changePassword(username, newPassword) {
    const db = readDb();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return false;

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    writeDb(db);
    return true;
  },
  deleteUser(username) {
    const db = readDb();
    if (username.toLowerCase() === 'admin') return false;

    const filtered = db.users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    const deleted = db.users.length !== filtered.length;
    db.users = filtered;
    writeDb(db);
    return deleted;
  },

  // --- Panels Inventory ---
  getPanels() {
    return readDb().panels || [];
  },
  addPanel(panel) {
    const db = readDb();
    const newPanel = {
      id: 'panel_' + Math.random().toString(36).substr(2, 9),
      name: panel.name,
      brand: panel.brand || '',
      model: panel.model || '',
      watt: Number(panel.watt),
      voc: panel.voc ? Number(panel.voc) : null,
      vmp: panel.vmp ? Number(panel.vmp) : null,
      isc: panel.isc ? Number(panel.isc) : null,
      imp: panel.imp ? Number(panel.imp) : null,
      tempCoefficientVoc: panel.tempCoefficientVoc ? Number(panel.tempCoefficientVoc) : -0.0026,
      tempCoefficientPmax: panel.tempCoefficientPmax ? Number(panel.tempCoefficientPmax) : -0.0030,
      warranty: panel.warranty ? Number(panel.warranty) : 25,
      price: Number(panel.price),
      available: panel.available !== undefined ? panel.available : true
    };
    if (!db.panels) db.panels = [];
    db.panels.push(newPanel);
    writeDb(db);
    return newPanel;
  },
  updatePanel(id, fields) {
    const db = readDb();
    const idx = db.panels.findIndex(p => p.id === id);
    if (idx === -1) return null;
    db.panels[idx] = { ...db.panels[idx], ...fields };
    writeDb(db);
    return db.panels[idx];
  },
  togglePanelAvailability(id) {
    const db = readDb();
    const panel = db.panels.find(p => p.id === id);
    if (!panel) return null;
    panel.available = !panel.available;
    writeDb(db);
    return panel;
  },
  deletePanel(id) {
    const db = readDb();
    const filtered = db.panels.filter(p => p.id !== id);
    const deleted = db.panels.length !== filtered.length;
    db.panels = filtered;
    writeDb(db);
    return deleted;
  },

  // --- Batteries Inventory ---
  getBatteries() {
    return readDb().batteries || [];
  },
  addBattery(battery) {
    const db = readDb();
    const newBat = {
      id: 'battery_' + Math.random().toString(36).substr(2, 9),
      name: battery.name,
      brand: battery.brand || '',
      model: battery.model || '',
      chemistry: battery.chemistry || 'LiFePO4',
      nominalVoltage: battery.nominalVoltage ? Number(battery.nominalVoltage) : 51.2,
      capacityAh: battery.capacityAh ? Number(battery.capacityAh) : null,
      capacityKwh: Number(battery.capacityKwh),
      dod: battery.dod ? Number(battery.dod) : 0.9,
      usableKwh: battery.usableKwh ? Number(battery.usableKwh) : Number(battery.capacityKwh) * (battery.dod || 0.9),
      maxChargeCurrent: battery.maxChargeCurrent ? Number(battery.maxChargeCurrent) : null,
      maxDischargeCurrent: battery.maxDischargeCurrent ? Number(battery.maxDischargeCurrent) : null,
      communicationProtocol: battery.communicationProtocol || 'CAN',
      maxParallel: battery.maxParallel ? Number(battery.maxParallel) : 4,
      warranty: battery.warranty ? Number(battery.warranty) : 10,
      price: Number(battery.price),
      available: battery.available !== undefined ? battery.available : true
    };
    if (!db.batteries) db.batteries = [];
    db.batteries.push(newBat);
    writeDb(db);
    return newBat;
  },
  updateBattery(id, fields) {
    const db = readDb();
    const idx = db.batteries.findIndex(b => b.id === id);
    if (idx === -1) return null;
    db.batteries[idx] = { ...db.batteries[idx], ...fields };
    writeDb(db);
    return db.batteries[idx];
  },
  toggleBatteryAvailability(id) {
    const db = readDb();
    const battery = db.batteries.find(b => b.id === id);
    if (!battery) return null;
    battery.available = !battery.available;
    writeDb(db);
    return battery;
  },
  deleteBattery(id) {
    const db = readDb();
    const filtered = db.batteries.filter(b => b.id !== id);
    const deleted = db.batteries.length !== filtered.length;
    db.batteries = filtered;
    writeDb(db);
    return deleted;
  },

  // --- Inverters Inventory ---
  getInverters() {
    return readDb().inverters || [];
  },
  addInverter(inverter) {
    const db = readDb();
    const newInv = {
      id: 'inv_' + Math.random().toString(36).substr(2, 9),
      name: inverter.name,
      brand: inverter.brand || 'Deye',
      model: inverter.model || '',
      capacityKw: Number(inverter.capacityKw),
      capacityVa: inverter.capacityVa ? Number(inverter.capacityVa) : Number(inverter.capacityKw) * 1000,
      systemVoltage: inverter.systemVoltage ? Number(inverter.systemVoltage) : 48,
      phases: inverter.phases ? Number(inverter.phases) : 1,
      mpptMin: inverter.mpptMin ? Number(inverter.mpptMin) : null,
      mpptMax: inverter.mpptMax ? Number(inverter.mpptMax) : null,
      maxVocInput: inverter.maxVocInput ? Number(inverter.maxVocInput) : null,
      maxPvPower: inverter.maxPvPower ? Number(inverter.maxPvPower) : null,
      mpptTrackers: inverter.mpptTrackers ? Number(inverter.mpptTrackers) : 2,
      chargeCurrentA: inverter.chargeCurrentA ? Number(inverter.chargeCurrentA) : null,
      dischargeCurrentA: inverter.dischargeCurrentA ? Number(inverter.dischargeCurrentA) : null,
      surgeCapacityKw: inverter.surgeCapacityKw ? Number(inverter.surgeCapacityKw) : Number(inverter.capacityKw) * 2,
      efficiency: inverter.efficiency ? Number(inverter.efficiency) : 0.97,
      batteryCompatibility: inverter.batteryCompatibility || ['LiFePO4'],
      warranty: inverter.warranty ? Number(inverter.warranty) : 5,
      price: Number(inverter.price),
      available: inverter.available !== undefined ? inverter.available : true
    };
    if (!db.inverters) db.inverters = [];
    db.inverters.push(newInv);
    writeDb(db);
    return newInv;
  },
  updateInverter(id, fields) {
    const db = readDb();
    const idx = db.inverters.findIndex(i => i.id === id);
    if (idx === -1) return null;
    db.inverters[idx] = { ...db.inverters[idx], ...fields };
    writeDb(db);
    return db.inverters[idx];
  },
  toggleInverterAvailability(id) {
    const db = readDb();
    const inverter = db.inverters.find(i => i.id === id);
    if (!inverter) return null;
    inverter.available = !inverter.available;
    writeDb(db);
    return inverter;
  },
  deleteInverter(id) {
    const db = readDb();
    const filtered = db.inverters.filter(i => i.id !== id);
    const deleted = db.inverters.length !== filtered.length;
    db.inverters = filtered;
    writeDb(db);
    return deleted;
  }
};
