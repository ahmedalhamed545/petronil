const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'db.json');

// Initial defaults
const DEFAULT_DATA = {
  settings: {
    title: "بترونيل يمن للطاقة",
    heroTitle: "صمم منظومتك الشمسية بنفسك",
    heroSubtitle: "انقر على الأجهزة التي تريد تشغيلها، حدد ساعات عملها، واحصل على التحليل المالي والفني فوراً!",
    address: "عدن - المنصورة، خلف محطة التسعين، أمام فندق قتبان",
    phone: "783999039",
    email: "info@petronilyemen.com"
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
  panels: [
    { id: "panel_1", name: "لوح جينكو 610 واط N-Type", watt: 610, price: 110, available: true },
    { id: "panel_2", name: "لوح ترينا 550 واط كفاءة عالية", watt: 550, price: 95, available: true }
  ],
  batteries: [
    { id: "battery_1", name: "بطارية ليثيوم نارادا 5.12kWh 48V", capacityKwh: 5.12, price: 1200, available: true },
    { id: "battery_2", name: "بطارية ليثيوم BYD 10.24kWh 48V", capacityKwh: 10.24, price: 2300, available: true }
  ],
  inverters: [
    { id: "inv_15", name: "انفرتر داي ذكي 1.5kW 12V", capacityKw: 1.5, price: 250, available: true },
    { id: "inv_30", name: "انفرتر داي ذكي 3kW 24V", capacityKw: 3.0, price: 450, available: true },
    { id: "inv_50", name: "انفرتر داي ذكي 5kW 48V", capacityKw: 5.0, price: 750, available: true },
    { id: "inv_80", name: "انفرتر داي ذكي 8kW 48V", capacityKw: 8.0, price: 1100, available: true },
    { id: "inv_100", name: "انفرتر داي ذكي 10kW 48V", capacityKw: 10.0, price: 1400, available: true },
    { id: "inv_150", name: "انفرتر داي ذكي 15kW 48V", capacityKw: 15.0, price: 2000, available: true },
    { id: "inv_200", name: "انفرتر داي ذكي 20kW 48V", capacityKw: 20.0, price: 2600, available: true }
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
      
      if (modified) {
        console.log("Database exists but inventory arrays are missing. Migrating inventory tables...");
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
      appliances: db.appliances,
      panels: db.panels || [],
      batteries: db.batteries || [],
      inverters: db.inverters || []
    };
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
      watt: Number(appliance.watt),
      dayHours: Number(appliance.dayHours || 4),
      nightHours: Number(appliance.nightHours || 4),
      icon: appliance.icon || 'fa-plug',
      quantity: 1
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
      name: updatedFields.name !== undefined ? updatedFields.name : db.appliances[index].name,
      watt: updatedFields.watt !== undefined ? Number(updatedFields.watt) : db.appliances[index].watt,
      dayHours: updatedFields.dayHours !== undefined ? Number(updatedFields.dayHours) : db.appliances[index].dayHours,
      nightHours: updatedFields.nightHours !== undefined ? Number(updatedFields.nightHours) : db.appliances[index].nightHours,
      icon: updatedFields.icon !== undefined ? updatedFields.icon : db.appliances[index].icon
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
      watt: Number(panel.watt),
      price: Number(panel.price),
      available: panel.available !== undefined ? panel.available : true
    };
    if (!db.panels) db.panels = [];
    db.panels.push(newPanel);
    writeDb(db);
    return newPanel;
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
      capacityKwh: Number(battery.capacityKwh),
      price: Number(battery.price),
      available: battery.available !== undefined ? battery.available : true
    };
    if (!db.batteries) db.batteries = [];
    db.batteries.push(newBat);
    writeDb(db);
    return newBat;
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
      capacityKw: Number(inverter.capacityKw),
      price: Number(inverter.price),
      available: inverter.available !== undefined ? inverter.available : true
    };
    if (!db.inverters) db.inverters = [];
    db.inverters.push(newInv);
    writeDb(db);
    return newInv;
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
