const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { generatePdfFile } = require('./generate_official_pdf');

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
  const includeAll = req.query.all === '1' && req.session && req.session.user;
  res.json(db.getPanels(includeAll));
});
app.post('/api/inventory/panels', requireAuth, hasPermission('inventory'), (req, res) => {
  const { name, watt, price } = req.body;
  if (!name || isNaN(watt) || isNaN(price)) {
    return res.status(400).json({ error: 'البيانات غير صالحة، تأكد من إدخال الاسم والقدرة والسعر' });
  }
  const panel = db.addPanel(req.body);
  res.json({ success: true, panel });
});
app.put('/api/inventory/panels/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const panel = db.updatePanel(req.params.id, req.body);
  if (!panel) return res.status(404).json({ error: 'المنتج غير موجود' });
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
  const includeAll = req.query.all === '1' && req.session && req.session.user;
  res.json(db.getBatteries(includeAll));
});
app.post('/api/inventory/batteries', requireAuth, hasPermission('inventory'), (req, res) => {
  const { name, capacityKwh, price } = req.body;
  if (!name || isNaN(capacityKwh) || isNaN(price)) {
    return res.status(400).json({ error: 'البيانات غير صالحة، تأكد من إدخال الاسم والسعة والسعر' });
  }
  const battery = db.addBattery(req.body);
  res.json({ success: true, battery });
});
app.put('/api/inventory/batteries/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const battery = db.updateBattery(req.params.id, req.body);
  if (!battery) return res.status(404).json({ error: 'المنتج غير موجود' });
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
  const includeAll = req.query.all === '1' && req.session && req.session.user;
  res.json(db.getInverters(includeAll));
});
app.post('/api/inventory/inverters', requireAuth, hasPermission('inventory'), (req, res) => {
  const { name, capacityKw, price } = req.body;
  if (!name || isNaN(capacityKw) || isNaN(price)) {
    return res.status(400).json({ error: 'البيانات غير صالحة، تأكد من إدخال الاسم والقدرة والسعر' });
  }
  const inverter = db.addInverter(req.body);
  res.json({ success: true, inverter });
});
app.put('/api/inventory/inverters/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const inverter = db.updateInverter(req.params.id, req.body);
  if (!inverter) return res.status(404).json({ error: 'المنتج غير موجود' });
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

// Distribution Boards (الطبالين وقواطع الحماية والتوزيع)
app.get('/api/inventory/boards', (req, res) => {
  res.json(db.getDistributionBoards(req.query.all === '1'));
});
app.post('/api/inventory/boards', requireAuth, hasPermission('inventory'), (req, res) => {
  const { name, brand, specs, price, available } = req.body;
  if (!name || isNaN(price)) {
    return res.status(400).json({ error: 'يرجى إدخال اسم الطبلون والسعر بشكل صحيح' });
  }
  const board = db.addDistributionBoard({ name, brand, specs, price: Number(price), available });
  res.json({ success: true, board });
});
app.put('/api/inventory/boards/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const board = db.updateDistributionBoard(req.params.id, req.body);
  if (!board) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true, board });
});
app.put('/api/inventory/boards/:id/toggle', requireAuth, hasPermission('inventory'), (req, res) => {
  const board = db.toggleDistributionBoardAvailability(req.params.id);
  if (!board) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true, board });
});
app.delete('/api/inventory/boards/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const success = db.deleteDistributionBoard(req.params.id);
  if (!success) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true });
});

// Custom Products (المنتجات المخصصة لعروض الأسعار)
app.get('/api/inventory/custom-products', (req, res) => {
  const includeUnavailable = req.query.all === 'true';
  res.json(db.getCustomProducts(includeUnavailable));
});
app.post('/api/inventory/custom-products', requireAuth, hasPermission('inventory'), (req, res) => {
  const { name, price } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'اسم المنتج وسعره مطلوبان' });
  }
  const item = db.addCustomProduct(req.body);
  res.json({ success: true, item });
});
app.put('/api/inventory/custom-products/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const item = db.updateCustomProduct(req.params.id, req.body);
  if (!item) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true, item });
});
app.put('/api/inventory/custom-products/:id/toggle', requireAuth, hasPermission('inventory'), (req, res) => {
  const item = db.toggleCustomProductAvailability(req.params.id);
  if (!item) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true, item });
});
app.delete('/api/inventory/custom-products/:id', requireAuth, hasPermission('inventory'), (req, res) => {
  const success = db.deleteCustomProduct(req.params.id);
  if (!success) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ success: true });
});

// Design Parameters
app.get('/api/design-params', (req, res) => {
  res.json(db.getDesignParams());
});
app.put('/api/design-params', requireAuth, hasPermission('content'), (req, res) => {
  const updated = db.updateDesignParams(req.body);
  res.json({ success: true, designParams: updated });
});

// Quotes
app.get('/api/quotes', requireAuth, hasPermission('leads'), (req, res) => {
  res.json(db.getQuotes());
});
app.get('/api/quotes/:id', (req, res) => {
  const quote = db.getQuotes().find(q => q.id === req.params.id || q.quoteNo === req.params.id);
  if (!quote) return res.status(404).json({ error: 'عرض السعر غير موجود' });
  res.json(quote);
});
app.post('/api/quotes', (req, res) => {
  const quote = db.addQuote(req.body);
  res.json({ success: true, quote });
});
app.put('/api/quotes/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'الحالة مطلوبة' });
  const updated = db.updateQuoteStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'عرض السعر غير موجود' });
  res.json({ success: true, quote: updated });
});
app.delete('/api/quotes/:id', requireAuth, hasPermission('leads'), (req, res) => {
  const success = db.deleteQuote(req.params.id);
  if (!success) return res.status(404).json({ error: 'عرض السعر غير موجود' });
  res.json({ success: true });
});

// Download / View official PDF for a stored quote
app.get('/api/quotes/:id/pdf', (req, res) => {
  const quote = db.getQuotes().find(q => q.id === req.params.id || q.quoteNo === req.params.id);
  if (!quote) return res.status(404).json({ error: 'عرض السعر غير موجود' });

  const quotesPdfDir = path.join(__dirname, 'quotes_pdf');
  if (!fs.existsSync(quotesPdfDir)) fs.mkdirSync(quotesPdfDir, { recursive: true });

  const safeName = (quote.customerName || 'عميل').replace(/[\s\/\\:]+/g, '_');
  const pdfFileName = `عرض_سعر_بترونيل_يمن_${safeName}_${quote.quoteNo}.pdf`;
  const pdfPath = path.join(quotesPdfDir, `${quote.id}.pdf`);

  try {
    generatePdfFile(quote, pdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(pdfFileName)}`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: 'فشل في إنشاء ملف الـ PDF: ' + err.message });
  }
});

// Generate and stream official PDF on the fly from current calculator state
app.post('/api/quotes/generate-pdf', (req, res) => {
  const quoteData = req.body;
  if (!quoteData) return res.status(400).json({ error: 'بيانات العرض ناقصة' });

  const tempPdfPath = path.join(__dirname, `temp_quote_${Date.now()}_${Math.floor(Math.random()*1000)}.pdf`);
  const safeName = (quoteData.customerName || 'عميل').replace(/[\s\/\\:]+/g, '_');
  const pdfFileName = `عرض_سعر_بترونيل_يمن_${safeName}.pdf`;

  try {
    generatePdfFile(quoteData, tempPdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(pdfFileName)}`);
    const stream = fs.createReadStream(tempPdfPath);
    stream.pipe(res);
    stream.on('finish', () => {
      try { fs.unlinkSync(tempPdfPath); } catch (e) {}
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: 'فشل في إنشاء ملف الـ PDF: ' + err.message });
  }
});

// Serve admin dashboard at /admin path explicitly
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running locally at: http://localhost:${PORT}`);
});
