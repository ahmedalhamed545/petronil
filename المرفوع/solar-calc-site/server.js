const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(session({
  secret: 'petronil-yemen-solar-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if running over HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 Hours session
  }
}));

// Serve static assets from project root
app.use(express.static(__dirname));

// --- Auth Middlewares ---
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'غير مصرح، يرجى تسجيل الدخول أولاً' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'SuperAdmin') {
    next();
  } else {
    res.status(403).json({ error: 'عذراً، هذه العملية تتطلب صلاحية مدير النظام الأساسي' });
  }
}

function hasPermission(perm) {
  return (req, res, next) => {
    if (req.session && req.session.user) {
      const user = req.session.user;
      if (user.role === 'SuperAdmin' || (Array.isArray(user.permissions) && user.permissions.includes(perm))) {
        return next();
      }
    }
    res.status(403).json({ error: `عذراً، هذه العملية تتطلب صلاحية الوصول إلى قسم: ${perm}` });
  };
}

// --- routes ---

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
  }

  const user = db.verifyUser(username, password);
  if (user) {
    req.session.user = user;
    res.json({ success: true, user });
  } else {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الخروج' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Me (Check Session)
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// --- Content and Settings ---

// Get all public page data
app.get('/api/content', (req, res) => {
  res.json(db.getContent());
});

// Update text content
app.put('/api/content/text', requireAuth, hasPermission('content'), (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

// --- Appliances CRUD ---

// List all
app.get('/api/appliances', (req, res) => {
  res.json(db.getAppliances());
});

// Add new appliance
app.post('/api/appliances', requireAuth, hasPermission('appliances'), (req, res) => {
  const { name, watt, dayHours, nightHours, icon } = req.body;
  if (!name || isNaN(watt) || watt <= 0) {
    return res.status(400).json({ error: 'يرجى إدخال اسم جهاز صحيح وقدرة بالوات أكبر من صفر' });
  }
  const newApp = db.addAppliance({ name, watt, dayHours, nightHours, icon });
  res.json({ success: true, appliance: newApp });
});

// Update appliance
app.put('/api/appliances/:id', requireAuth, hasPermission('appliances'), (req, res) => {
  const updated = db.updateAppliance(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'الجهاز غير موجود' });
  }
  res.json({ success: true, appliance: updated });
});

// Delete appliance
app.delete('/api/appliances/:id', requireAuth, hasPermission('appliances'), (req, res) => {
  const success = db.deleteAppliance(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'الجهاز غير موجود' });
  }
  res.json({ success: true });
});

// --- Leads CRUD ---

// Get all leads (Inquiries)
app.get('/api/leads', requireAuth, hasPermission('leads'), (req, res) => {
  res.json(db.getLeads());
});

// Add lead (Public Route for customers)
app.post('/api/leads', (req, res) => {
  const { name, phone, notes, systemSizeKw, panelsCount, batteriesKwh, inverterKva, totalCost, currency } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'يرجى إدخال اسم العميل ورقم هاتفه للتواصل' });
  }
  const newLead = db.addLead({
    name, phone, notes, systemSizeKw, panelsCount, batteriesKwh, inverterKva, totalCost, currency
  });
  res.json({ success: true, lead: newLead });
});

// Update lead status (New, Contacted, Completed)
app.put('/api/leads/:id/status', requireAuth, hasPermission('leads'), (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'الحالة مطلوبة' });
  }
  const updated = db.updateLeadStatus(req.params.id, status);
  if (!updated) {
    return res.status(404).json({ error: 'الطلب غير موجود' });
  }
  res.json({ success: true, lead: updated });
});

// Delete lead
app.delete('/api/leads/:id', requireAuth, hasPermission('leads'), (req, res) => {
  const success = db.deleteLead(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'الطلب غير موجود' });
  }
  res.json({ success: true });
});

// --- Users (RBAC) CRUD (SuperAdmin Only) ---

// Get users list
app.get('/api/users', requireAuth, hasPermission('users'), (req, res) => {
  res.json(db.getUsers());
});

// Create new user
app.post('/api/users', requireAuth, hasPermission('users'), (req, res) => {
  const { username, password, role, permissions } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
  }
  const newUser = db.addUser({ username, password, role, permissions });
  if (!newUser) {
    return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً' });
  }
  res.json({ success: true, user: newUser });
});

// Change current password
app.post('/api/users/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 5) {
    return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن لا تقل عن 5 أحرف' });
  }
  const success = db.changePassword(req.session.user.username, newPassword);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'تعذر تغيير كلمة المرور' });
  }
});

// Delete user
app.delete('/api/users/:username', requireAuth, hasPermission('users'), (req, res) => {
  const username = req.params.username;
  if (username.toLowerCase() === 'admin') {
    return res.status(400).json({ error: 'لا يمكن حذف حساب المسؤول الرئيسي' });
  }
  const success = db.deleteUser(username);
  if (!success) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }
  res.json({ success: true });
});

// --- Inventory (Panels, Batteries, Inverters) CRUD APIs ---

// Panels
app.get('/api/inventory/panels', (req, res) => {
  res.json(db.getPanels());
});
app.post('/api/inventory/panels', requireAuth, hasPermission('inventory'), (req, res) => {
  const { name, watt, price } = req.body;
  if (!name || isNaN(watt) || isNaN(price)) {
    return res.status(400).json({ error: 'البيانات غير صالحة' });
  }
  const panel = db.addPanel({ name, watt, price });
  res.json({ success: true, panel });
});
app.put('/api/inventory/panels/:id/toggle', requireAuth, hasPermission('inventory'), (req, res) => {
  const panel = db.togglePanelAvailability(req.params.id);
  if (!panel) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true, panel });
});
app.delete('/api/inventory/panels/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const success = db.deletePanel(req.params.id);
  if (!success) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true });
});

// Batteries
app.get('/api/inventory/batteries', (req, res) => {
  res.json(db.getBatteries());
});
app.post('/api/inventory/batteries', requireAuth, hasPermission('inventory'), (req, res) => {
  const { name, capacityKwh, price } = req.body;
  if (!name || isNaN(capacityKwh) || isNaN(price)) {
    return res.status(400).json({ error: 'البيانات غير صالحة' });
  }
  const battery = db.addBattery({ name, capacityKwh, price });
  res.json({ success: true, battery });
});
app.put('/api/inventory/batteries/:id/toggle', requireAuth, hasPermission('inventory'), (req, res) => {
  const battery = db.toggleBatteryAvailability(req.params.id);
  if (!battery) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true, battery });
});
app.delete('/api/inventory/batteries/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const success = db.deleteBattery(req.params.id);
  if (!success) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true });
});

// Inverters
app.get('/api/inventory/inverters', (req, res) => {
  res.json(db.getInverters());
});
app.post('/api/inventory/inverters', requireAuth, hasPermission('inventory'), (req, res) => {
  const { name, capacityKw, price } = req.body;
  if (!name || isNaN(capacityKw) || isNaN(price)) {
    return res.status(400).json({ error: 'البيانات غير صالحة' });
  }
  const inverter = db.addInverter({ name, capacityKw, price });
  res.json({ success: true, inverter });
});
app.put('/api/inventory/inverters/:id/toggle', requireAuth, hasPermission('inventory'), (req, res) => {
  const inverter = db.toggleInverterAvailability(req.params.id);
  if (!inverter) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true, inverter });
});
app.delete('/api/inventory/inverters/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const success = db.deleteInverter(req.params.id);
  if (!success) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true });
});

// Serve admin dashboard at /admin path explicitly
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running locally at: http://localhost:${PORT}`);
});
