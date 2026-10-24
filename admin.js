// Base state
let currentUser = null;
let allLeads = [];
let allAppliances = [];
let editModeApplianceId = null;

// Inventory State
let allPanels = [];
let allBatteries = [];
let allInverters = [];
let allBoards = [];
let allQuotes = [];
let allCustomProducts = [];
let adminQuoteItems = [];
let activeQuoteIconsFilter = "all";
let activeQuotesFilter = "all";

// --- Initialize Admin App ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkAuth();
    setupEventListeners();
});

// --- Auth check ---
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        
        if (data.loggedIn) {
            currentUser = data.user;
            showDashboard();
        } else {
            showLogin();
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('admin-dashboard').style.display = 'none';
    document.body.style.display = 'flex'; // Align center for login card
}

function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'grid';
    document.body.style.display = 'block'; // Block layout for dashboard
    
    // Set user badges
    const userBadge = document.getElementById('current-user-badge');
    userBadge.innerText = `${currentUser.username} (${currentUser.role === 'SuperAdmin' ? 'مدير نظام' : 'محرر'})`;
    
    if (currentUser.role === 'SuperAdmin') {
        userBadge.className = 'user-badge';
    } else {
        userBadge.className = 'user-badge editor';
    }
    
    // Permissions-based menu display
    const targetPermissionMap = {
        'section-overview': 'overview',
        'section-leads': 'leads',
        'section-appliances': 'appliances',
        'section-content': 'content',
        'section-inventory': 'inventory',
        'section-design-params': 'content',
        'section-users': 'users'
    };
    
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const sections = document.querySelectorAll('.admin-main .content-section');
    
    let firstAllowedTarget = null;
    
    menuItems.forEach(item => {
        const target = item.getAttribute('data-target');
        const perm = targetPermissionMap[target];
        
        if (perm) {
            const hasPerm = currentUser.role === 'SuperAdmin' || (Array.isArray(currentUser.permissions) && currentUser.permissions.includes(perm));
            if (hasPerm) {
                item.style.display = 'flex';
                if (!firstAllowedTarget) firstAllowedTarget = target;
            } else {
                item.style.display = 'none';
            }
        } else {
            // Profile is always allowed
            item.style.display = 'flex';
            if (!firstAllowedTarget) firstAllowedTarget = target;
        }
    });
    
    // Deactivate all menu items and sections first
    menuItems.forEach(item => item.classList.remove('active'));
    sections.forEach(sec => sec.classList.remove('active'));
    
    // Activate the first allowed target section
    if (firstAllowedTarget) {
        const activeMenu = Array.from(menuItems).find(item => item.getAttribute('data-target') === firstAllowedTarget);
        if (activeMenu) activeMenu.classList.add('active');
        
        const activeSection = document.getElementById(firstAllowedTarget);
        if (activeSection) activeSection.classList.add('active');
    }
    
    // Load data
    loadAllData();
}

// --- Load Content & Stats ---
async function loadAllData() {
    const promises = [];
    const hasPerm = (perm) => currentUser.role === 'SuperAdmin' || (Array.isArray(currentUser.permissions) && currentUser.permissions.includes(perm));
    
    if (hasPerm('leads')) promises.push(fetchLeads());
promises.push(fetchQuotes());
    if (hasPerm('appliances')) promises.push(fetchAppliances());
    if (hasPerm('content')) {
        promises.push(fetchContentSettings());
        promises.push(fetchDesignParams());
    }
    if (hasPerm('inventory')) promises.push(fetchInventory());
    
    await Promise.all(promises);
    
    if (hasPerm('users')) {
        fetchUsers();
    }
    
    if (hasPerm('overview')) {
        updateOverviewStats();
    }
}

async function fetchLeads() {
    try {
        const res = await fetch('/api/leads');
        if (res.ok) {
            allLeads = await res.json();
            renderLeadsTable();
            renderLatestLeadsOverview();
        }
    } catch (err) {
        showToast("فشل تحميل طلبات العملاء", false);
    }
}

async function fetchAppliances() {
    try {
        const res = await fetch('/api/appliances');
        if (res.ok) {
            allAppliances = await res.json();
            renderAppliancesTable();
        }
    } catch (err) {
        showToast("فشل تحميل قائمة الأجهزة", false);
    }
}

async function fetchContentSettings() {
    try {
        const res = await fetch('/api/content');
        if (res.ok) {
            const data = await res.json();
            populateContentForm(data.settings);
        }
    } catch (err) {
        showToast("فشل تحميل محتوى ونصوص الموقع", false);
    }
}

async function fetchUsers() {
    try {
        const res = await fetch('/api/users');
        if (res.ok) {
            const users = await res.json();
            renderUsersTable(users);
        }
    } catch (err) {
        showToast("فشل تحميل قائمة المستخدمين", false);
    }
}

// --- Fetch System Inventory ---
async function fetchInventory() {
    try {
        const [pRes, bRes, iRes, brdRes, cpRes] = await Promise.all([
            fetch('/api/inventory/panels?all=1'),
            fetch('/api/inventory/batteries?all=1'),
            fetch('/api/inventory/inverters?all=1'),
            fetch('/api/inventory/boards?all=1'),
            fetch('/api/inventory/custom-products?all=1')
        ]);
        if (pRes.ok) allPanels = await pRes.json();
        if (bRes.ok) allBatteries = await bRes.json();
        if (iRes.ok) allInverters = await iRes.json();
        if (brdRes && brdRes.ok) allBoards = await brdRes.json();
        if (cpRes && cpRes.ok) allCustomProducts = await cpRes.json();
        
        renderPanelsTable();
        renderBatteriesTable();
        renderInvertersTable();
        renderBoardsTable();
        renderAdminQuoteProductIcons(activeQuoteIconsFilter);
    } catch (err) {
        console.error("Error loading inventory:", err);
        showToast("فشل تحميل مخزون المنظومة", false);
    }
}

// --- Update UI Statistics ---
function updateOverviewStats() {
    document.getElementById('stat-total-leads').innerText = allLeads.length;
    document.getElementById('stat-total-apps').innerText = allAppliances.length;
    
    const completedCount = allLeads.filter(l => l.status === 'Completed').length;
    document.getElementById('stat-completed-leads').innerText = completedCount;
}

// --- Render Functions ---

function renderLeadsTable() {
    const tbody = document.getElementById('leads-list');
    tbody.innerHTML = '';
    
    if (allLeads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;" class="text-muted">لا توجد طلبات عملاء مستلمة حالياً</td></tr>`;
        return;
    }
    
    const sorted = [...allLeads].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    sorted.forEach(lead => {
        const tr = document.createElement('tr');
        
        const dateStr = new Date(lead.createdAt).toLocaleDateString('ar-YE', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        const costStr = lead.currency === 'USD' ? `$${Number(lead.totalCost).toLocaleString()}` : `${Number(lead.totalCost).toLocaleString()} ر.س`;
        
        tr.innerHTML = `
            <td style="font-weight: 700;">${lead.name}</td>
            <td class="font-num">${lead.phone}</td>
            <td class="font-num">${Number(lead.systemSizeKw).toFixed(2)} kW</td>
            <td class="font-num">${lead.panelsCount}</td>
            <td>${lead.batteriesKwh}</td>
            <td>${lead.inverterKva}</td>
            <td class="font-num" style="color: var(--accent-primary); font-weight:700;">${costStr}</td>
            <td>
                <div class="select-custom-wrapper" style="width: 140px;">
                    <select class="select-custom status-select" data-id="${lead.id}" style="padding: 6px 12px; font-size: 0.8rem;">
                        <option value="New" ${lead.status === 'New' ? 'selected' : ''}>جديد</option>
                        <option value="Contacted" ${lead.status === 'Contacted' ? 'selected' : ''}>تم التواصل</option>
                        <option value="Completed" ${lead.status === 'Completed' ? 'selected' : ''}>مكتمل</option>
                    </select>
                </div>
            </td>
            <td>
                <button class="btn-action edit btn-view-lead" data-id="${lead.id}" title="عرض التفاصيل"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-action delete btn-delete-lead" data-id="${lead.id}" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        
        tr.querySelector('.status-select').addEventListener('change', handleLeadStatusChange);
        tr.querySelector('.btn-view-lead').addEventListener('click', () => openLeadModal(lead));
        tr.querySelector('.btn-delete-lead').addEventListener('click', () => deleteLead(lead.id));
        
        tbody.appendChild(tr);
    });
}

function renderLatestLeadsOverview() {
    const tbody = document.getElementById('overview-latest-leads');
    tbody.innerHTML = '';
    
    if (allLeads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="text-muted">لا توجد طلبات جديدة</td></tr>`;
        return;
    }
    
    const latest = [...allLeads]
        .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
        
    latest.forEach(lead => {
        const tr = document.createElement('tr');
        const dateStr = new Date(lead.createdAt).toLocaleDateString('ar-YE', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        let statusClass = 'status-new';
        let statusText = 'جديد';
        if (lead.status === 'Contacted') {
            statusClass = 'status-contacted';
            statusText = 'تم التواصل';
        } else if (lead.status === 'Completed') {
            statusClass = 'status-completed';
            statusText = 'مكتمل';
        }
        
        tr.innerHTML = `
            <td>${lead.name}</td>
            <td class="font-num">${lead.phone}</td>
            <td class="font-num">${dateStr}</td>
            <td class="font-num">${Number(lead.systemSizeKw).toFixed(2)} kW</td>
            <td><span class="status-pill ${statusClass}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAppliancesTable() {
    const tbody = document.getElementById('appliances-list-admin');
    tbody.innerHTML = '';
    
    allAppliances.forEach(app => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size:1.2rem;"><i class="fa-solid ${app.icon || 'fa-plug'} text-primary"></i></td>
            <td style="font-weight: 700;">${app.name}</td>
            <td class="font-num">${app.watt}W</td>
            <td class="font-num">${app.dayHours} ساعة</td>
            <td class="font-num">${app.nightHours} ساعة</td>
            <td>
                <button class="btn-action edit btn-edit-app" data-id="${app.id}" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn-action delete btn-delete-app" data-id="${app.id}" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        
        tr.querySelector('.btn-edit-app').addEventListener('click', () => loadApplianceForEdit(app));
        tr.querySelector('.btn-delete-app').addEventListener('click', () => deleteAppliance(app.id));
        tbody.appendChild(tr);
    });
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-list-admin');
    tbody.innerHTML = '';
    
    const permissionLabelsAr = {
        overview: 'الإحصائيات',
        leads: 'الطلبات',
        appliances: 'الأجهزة',
        content: 'المحتوى',
        inventory: 'المخزون',
        users: 'المستخدمين'
    };
    
    users.forEach(u => {
        const tr = document.createElement('tr');
        const userPermissions = u.permissions || [];
        const permListAr = u.role === 'SuperAdmin' ? 'الكل (مدير نظام)' : (userPermissions.map(p => permissionLabelsAr[p] || p).join('، ') || 'لا توجد صلاحيات');
        
        tr.innerHTML = `
            <td style="font-weight: 700;">${u.username}</td>
            <td>
                <span class="user-badge ${u.role !== 'SuperAdmin' ? 'editor' : ''}" style="margin-bottom: 5px; display: inline-block;">
                    ${u.role === 'SuperAdmin' ? 'مدير نظام (SuperAdmin)' : 'محرر (Editor)'}
                </span>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">الصلاحيات الممنوحة: ${permListAr}</div>
            </td>
            <td>
                ${u.username !== 'admin' ? `<button class="btn-action delete btn-delete-user" data-username="${u.username}" title="حذف الحساب"><i class="fa-solid fa-trash-can"></i></button>` : `<span class="text-muted">مغلق</span>`}
            </td>
        `;
        
        if (u.username !== 'admin') {
            tr.querySelector('.btn-delete-user').addEventListener('click', () => deleteUser(u.username));
        }
        tbody.appendChild(tr);
    });
}

function populateContentForm(settings) {
    document.getElementById('content-title').value = settings.title || '';
    if (document.getElementById('content-hero-badge')) document.getElementById('content-hero-badge').value = settings.heroBadge || '';
    document.getElementById('content-hero-title').value = settings.heroTitle || '';
    document.getElementById('content-hero-subtitle').value = settings.heroSubtitle || '';
    
    if (document.getElementById('content-services-title')) document.getElementById('content-services-title').value = settings.servicesTitle || '';
    if (document.getElementById('content-services-subtitle')) document.getElementById('content-services-subtitle').value = settings.servicesSubtitle || '';
    
    if (document.getElementById('content-service1-title')) document.getElementById('content-service1-title').value = settings.service1Title || '';
    if (document.getElementById('content-service1-desc')) document.getElementById('content-service1-desc').value = settings.service1Desc || '';
    if (document.getElementById('content-service2-title')) document.getElementById('content-service2-title').value = settings.service2Title || '';
    if (document.getElementById('content-service2-desc')) document.getElementById('content-service2-desc').value = settings.service2Desc || '';
    if (document.getElementById('content-service3-title')) document.getElementById('content-service3-title').value = settings.service3Title || '';
    if (document.getElementById('content-service3-desc')) document.getElementById('content-service3-desc').value = settings.service3Desc || '';
    if (document.getElementById('content-service4-title')) document.getElementById('content-service4-title').value = settings.service4Title || '';
    if (document.getElementById('content-service4-desc')) document.getElementById('content-service4-desc').value = settings.service4Desc || '';
    
    document.getElementById('content-phone').value = settings.phone || '';
    document.getElementById('content-email').value = settings.email || '';
    document.getElementById('content-address').value = settings.address || '';
    if (document.getElementById('content-footer-about')) document.getElementById('content-footer-about').value = settings.footerAbout || '';
}

// --- Render Inventory Tables ---


// --- Quotes Management ---

// --- Tafqeet (Arabic Number to Words) ---
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

// --- Get All Catalog Items for Quote Selection Icons ---
function getCatalogItems() {
    let items = [];
    
    // Inverters (12 Crown Models)
    (allInverters || []).forEach(i => {
        if (i.available !== false) {
            items.push({
                id: i.id,
                name: i.name,
                category: 'inverter',
                categoryLabel: 'انفرتر كراون',
                icon: 'fa-gauge-high',
                iconClass: '',
                spec: (i.capacityKw ? i.capacityKw + 'kW' : '') + ' • ' + (i.batteryVoltage ? i.batteryVoltage + 'V' : ''),
                price: Number(i.price || 0)
            });
        }
    });

    // Batteries (6 Crown Models)
    (allBatteries || []).forEach(b => {
        if (b.available !== false) {
            items.push({
                id: b.id,
                name: b.name,
                category: 'battery',
                categoryLabel: 'بطارية ليثيوم',
                icon: 'fa-battery-full',
                iconClass: 'bat',
                spec: (b.capacityKwh ? b.capacityKwh + 'kWh' : '') + ' • ' + (b.voltage ? b.voltage + 'V' : ''),
                price: Number(b.price || 0)
            });
        }
    });

    // Panels (Longi 610W)
    (allPanels || []).forEach(p => {
        if (p.available !== false) {
            items.push({
                id: p.id,
                name: p.name,
                category: 'panel',
                categoryLabel: 'لوح شمسي',
                icon: 'fa-solar-panel',
                iconClass: 'pnl',
                spec: (p.watt || 610) + 'W N-Type',
                price: Number(p.price || 0)
            });
        }
    });

    // Distribution Boards (الطبالين وقواطع الحماية)
    (allBoards || []).forEach(d => {
        if (d.available !== false) {
            items.push({
                id: d.id,
                name: d.name,
                category: 'board',
                categoryLabel: 'طبلون وقواطع',
                icon: 'fa-server',
                iconClass: 'brd',
                spec: d.specs || 'حماية وتوزيع AC/DC',
                price: Number(d.price || 0)
            });
        }
    });

    // Custom Products Added On-The-Fly (المنتجات المضافة مخصصة)
    (allCustomProducts || []).forEach(c => {
        if (c.available !== false) {
            items.push({
                id: c.id,
                name: c.name,
                category: c.category || 'custom',
                categoryLabel: c.categoryName || 'صنف مخصص',
                icon: 'fa-box-open',
                iconClass: 'cst',
                spec: c.specs || 'صنف مضاف مخصص',
                price: Number(c.price || 0)
            });
        }
    });

    return items;
}

// --- Render Quotation Product Selection Icons ---
function renderAdminQuoteProductIcons(filter = 'all') {
    const container = document.getElementById('admin-quote-product-icons-container');
    if (!container) return;

    activeQuoteIconsFilter = filter;
    let items = getCatalogItems();

    if (filter !== 'all') {
        items = items.filter(it => it.category === filter);
    }

    if (items.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);">لا توجد منتجات في هذا القسم حالياً. استخدم خانة إضافة منتج جديد بالأعلى لإضافة أي صنف.</div>';
        return;
    }

    container.innerHTML = items.map(it => `
        <div class="quote-prod-icon-card" data-id="${it.id}" title="انقر لإضافة ${it.name} إلى العرض">
            <div class="quote-prod-icon-top">
                <div class="quote-prod-icon-avatar ${it.iconClass}">
                    <i class="fa-solid ${it.icon}"></i>
                </div>
                <span class="badge quote-prod-badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted);">${it.categoryLabel}</span>
            </div>
            <div class="quote-prod-title">${it.name}</div>
            <div class="quote-prod-spec font-num">${it.spec}</div>
            <div class="quote-prod-price-row">
                <span class="quote-prod-price font-num">${(it.price || 0).toLocaleString('en-US')} ر.س</span>
                <span class="quote-prod-add-btn"><i class="fa-solid fa-plus"></i> إضافة</span>
            </div>
        </div>
    `).join('');

    // Attach click events
    container.querySelectorAll('.quote-prod-icon-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            const found = getCatalogItems().find(x => x.id === id);
            if (found) {
                addAdminQuoteItem(found);
                // Quick pulse animation
                card.style.transform = 'scale(0.95)';
                setTimeout(() => { card.style.transform = ''; }, 150);
            }
        });
    });
}

// --- Add Item to Current Admin Quotation ---
function addAdminQuoteItem(item) {
    const existing = adminQuoteItems.find(x => x.id === item.id);
    if (existing) {
        existing.quantity += 1;
        existing.total = Math.round(existing.quantity * existing.price);
    } else {
        adminQuoteItems.push({
            id: item.id,
            name: item.name,
            price: Number(item.price || 0),
            quantity: 1,
            total: Number(item.price || 0),
            category: item.category
        });
    }
    renderAdminQuoteItemsTable();
    showToast(`تمت إضافة: ${item.name}`, true);
}

// --- Render Admin Quotation Items Table & Update Totals ---
function renderAdminQuoteItemsTable() {
    const tbody = document.getElementById('admin-quote-items-tbody');
    if (!tbody) return;

    if (adminQuoteItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 25px; color: var(--text-muted);"><i class="fa-solid fa-hand-pointer text-warning"></i> لا توجد بنود بعد. اضغط على أيقونة أي منتج من الأعلى لإضافته فوراً للعرض.</td></tr>';
        updateAdminQuoteTotals();
        return;
    }

    tbody.innerHTML = adminQuoteItems.map((item, idx) => `
        <tr>
            <td class="font-num text-center" style="font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
            <td style="font-weight: 700; color: var(--text-main);">${item.name}</td>
            <td>
                <input type="number" class="font-num item-price-input" value="${item.price}" data-id="${item.id}" title="تعديل السعر لهذا العرض">
            </td>
            <td style="text-align: center;">
                <div class="qty-control-wrap">
                    <button type="button" class="qty-btn btn-qty-minus" data-id="${item.id}">-</button>
                    <input type="number" class="qty-input font-num" value="${item.quantity}" min="1" data-id="${item.id}">
                    <button type="button" class="qty-btn btn-qty-plus" data-id="${item.id}">+</button>
                </div>
            </td>
            <td class="font-num" style="font-weight: 800; color: #10b981;">${(item.total).toLocaleString('en-US')} ر.س</td>
            <td style="text-align: center;">
                <button type="button" class="btn btn-sm btn-danger btn-item-del" data-id="${item.id}" title="حذف البند">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Attach listeners for Qty + / - / input & price input
    tbody.querySelectorAll('.btn-qty-minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const it = adminQuoteItems.find(x => x.id === id);
            if (it) {
                if (it.quantity > 1) {
                    it.quantity -= 1;
                    it.total = Math.round(it.quantity * it.price);
                } else {
                    adminQuoteItems = adminQuoteItems.filter(x => x.id !== id);
                }
                renderAdminQuoteItemsTable();
            }
        });
    });

    tbody.querySelectorAll('.btn-qty-plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const it = adminQuoteItems.find(x => x.id === id);
            if (it) {
                it.quantity += 1;
                it.total = Math.round(it.quantity * it.price);
                renderAdminQuoteItemsTable();
            }
        });
    });

    tbody.querySelectorAll('.qty-input').forEach(inp => {
        inp.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const val = parseInt(e.target.value, 10);
            const it = adminQuoteItems.find(x => x.id === id);
            if (it) {
                it.quantity = isNaN(val) || val < 1 ? 1 : val;
                it.total = Math.round(it.quantity * it.price);
                renderAdminQuoteItemsTable();
            }
        });
    });

    tbody.querySelectorAll('.item-price-input').forEach(inp => {
        inp.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const val = parseFloat(e.target.value);
            const it = adminQuoteItems.find(x => x.id === id);
            if (it) {
                it.price = isNaN(val) || val < 0 ? 0 : val;
                it.total = Math.round(it.quantity * it.price);
                renderAdminQuoteItemsTable();
            }
        });
    });

    tbody.querySelectorAll('.btn-item-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            adminQuoteItems = adminQuoteItems.filter(x => x.id !== id);
            renderAdminQuoteItemsTable();
            showToast("تم حذف البند من العرض", true);
        });
    });

    updateAdminQuoteTotals();
}

// --- Update Financial Totals & Tafqeet ---
function updateAdminQuoteTotals() {
    const subtotal = adminQuoteItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const discountInp = document.getElementById('admin-quote-discount');
    const discount = discountInp ? Math.max(0, parseFloat(discountInp.value) || 0) : 0;
    const grandTotal = Math.max(0, subtotal - discount);

    const subtotalEl = document.getElementById('admin-quote-subtotal');
    if (subtotalEl) subtotalEl.innerText = subtotal.toLocaleString('en-US') + ' ر.س';

    const grandTotalEl = document.getElementById('admin-quote-grandtotal');
    if (grandTotalEl) grandTotalEl.innerText = grandTotal.toLocaleString('en-US') + ' ر.س';

    const verbalEl = document.getElementById('admin-quote-verbal-display');
    if (verbalEl) verbalEl.innerText = tafqeet(grandTotal);
}

// --- Handle Fast On-The-Fly Product Creation ---
async function handleAddNewCustomProduct(e) {
    e.preventDefault();
    const nameInp = document.getElementById('admin-new-prod-name');
    const catInp = document.getElementById('admin-new-prod-category');
    const priceInp = document.getElementById('admin-new-prod-price');
    const specsInp = document.getElementById('admin-new-prod-specs');

    const name = nameInp?.value.trim();
    const category = catInp?.value || 'custom';
    const price = parseFloat(priceInp?.value);
    const specs = specsInp?.value.trim() || '';

    if (!name || isNaN(price) || price < 0) {
        showToast("يرجى إدخال اسم المنتج وسعره بشكل صحيح", false);
        return;
    }

    const catLabels = {
        'inverter': 'إنفرتر كراون مايكرو',
        'battery': 'بطارية ليثيوم كراون',
        'panel': 'ألواح شمسية',
        'board': 'طبلون وقواطع حماية',
        'custom': 'ملحقات وتوصيلات مخصصة'
    };

    try {
        const res = await fetch('/api/inventory/custom-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                category,
                categoryName: catLabels[category] || 'صنف مخصص',
                price,
                specs
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            allCustomProducts.push(data.item);
            showToast(`تم اعتماد المنتج (${name}) في الأيقونات بنجاح!`, true);
            
            // Auto add to current quote items
            addAdminQuoteItem({
                id: data.item.id,
                name: data.item.name,
                category: data.item.category,
                price: data.item.price
            });

            // Re-render product icons so it appears in the grid immediately
            renderAdminQuoteProductIcons(activeQuoteIconsFilter);

            // Reset add product form
            nameInp.value = '';
            priceInp.value = '';
            if (specsInp) specsInp.value = '';
        } else {
            showToast(data.error || "فشل إضافة الصنف", false);
        }
    } catch (err) {
        console.error("Error adding custom product:", err);
        showToast("حدث خطأ أثناء حفظ المنتج", false);
    }
}

// --- Save Admin Custom Quotation ---
async function saveAdminQuote() {
    const custName = document.getElementById('admin-quote-cust-name')?.value.trim();
    const custPhone = document.getElementById('admin-quote-cust-phone')?.value.trim() || '';
    const custAddr = document.getElementById('admin-quote-cust-addr')?.value.trim() || 'حضرموت';
    const notes = document.getElementById('admin-quote-notes')?.value.trim() || '';

    if (!custName) {
        alert("يرجى إدخال اسم العميل أولاً");
        document.getElementById('admin-quote-cust-name')?.focus();
        return;
    }

    if (adminQuoteItems.length === 0) {
        alert("يرجى إضافة بند واحد على الأقل إلى عرض السعر عبر النقر على أيقونات المنتجات بالأعلى");
        return;
    }

    const subtotal = adminQuoteItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const discount = Math.max(0, parseFloat(document.getElementById('admin-quote-discount')?.value) || 0);
    const grandTotal = Math.max(0, subtotal - discount);

    const quotePayload = {
        customerName: custName,
        customerPhone: custPhone,
        customerAddress: custAddr,
        notes: notes,
        items: adminQuoteItems.map(it => ({
            name: it.name,
            quantity: it.quantity,
            price: it.price,
            total: it.total
        })),
        subtotal: subtotal,
        discount: discount,
        grandTotal: grandTotal,
        verbalTotal: tafqeet(grandTotal),
        currency: 'SAR',
        source: 'admin',
        isPrivateAdmin: true,
        status: 'AdminCustom',
        date: new Date().toISOString().split('T')[0]
    };

    try {
        const res = await fetch('/api/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quotePayload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast("تم حفظ عرض السعر الخاص بالإدارة بنجاح!", true);
            await fetchQuotes();
            
            if (confirm(`تم حفظ عرض السعر بنجاح برقم: ${data.quote.quoteNo || data.quote.id}\n\nهل ترغب بتحميل ملف الـ PDF الرسمي الآن؟`)) {
                window.open(`/api/quotes/${data.quote.id}/pdf`, '_blank');
            }
        } else {
            showToast(data.error || "فشل حفظ عرض السعر", false);
        }
    } catch (err) {
        console.error("Error saving admin quote:", err);
        showToast("حدث خطأ أثناء حفظ عرض السعر", false);
    }
}

// --- Download Official PDF On-The-Fly for Current Admin Quote ---
async function downloadAdminQuotePdf() {
    const custName = document.getElementById('admin-quote-cust-name')?.value.trim();
    const custPhone = document.getElementById('admin-quote-cust-phone')?.value.trim() || '';
    const custAddr = document.getElementById('admin-quote-cust-addr')?.value.trim() || 'حضرموت';
    const notes = document.getElementById('admin-quote-notes')?.value.trim() || '';

    if (!custName) {
        alert("يرجى إدخال اسم العميل لإصدار الـ PDF الرسمي باسمه");
        document.getElementById('admin-quote-cust-name')?.focus();
        return;
    }

    if (adminQuoteItems.length === 0) {
        alert("يرجى إضافة بند واحد على الأقل عبر الأيقونات لإصدار ملف الـ PDF");
        return;
    }

    const subtotal = adminQuoteItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const discount = Math.max(0, parseFloat(document.getElementById('admin-quote-discount')?.value) || 0);
    const grandTotal = Math.max(0, subtotal - discount);

    const quotePayload = {
        customerName: custName,
        customerPhone: custPhone,
        customerAddress: custAddr,
        notes: notes,
        items: adminQuoteItems.map(it => ({
            name: it.name,
            quantity: it.quantity,
            price: it.price,
            total: it.total
        })),
        subtotal: subtotal,
        discount: discount,
        grandTotal: grandTotal,
        verbalTotal: tafqeet(grandTotal),
        currency: 'SAR',
        date: new Date().toISOString().split('T')[0]
    };

    showToast("جاري إنشاء ملف الـ PDF الرسمي...", true);

    try {
        const res = await fetch('/api/quotes/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quotePayload)
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const safeName = custName.replace(/[\s\\\/:]+/g, '_');
            a.download = `عرض_سعر_بترونيل_يمن_${safeName}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast("تم تحميل ملف الـ PDF الرسمي بنجاح!", true);
        } else {
            showToast("فشل إنشاء ملف الـ PDF", false);
        }
    } catch (err) {
        console.error("Error generating quote PDF:", err);
        showToast("حدث خطأ أثناء إنشاء ملف الـ PDF", false);
    }
}

// --- Reset Admin Quote Form ---
function resetAdminQuoteForm() {
    if (adminQuoteItems.length > 0 && !confirm("هل أنت متأكد من تفريغ جميع البنود والبيانات لبدء عرض جديد؟")) {
        return;
    }
    const nameInp = document.getElementById('admin-quote-cust-name');
    if (nameInp) nameInp.value = '';
    const phoneInp = document.getElementById('admin-quote-cust-phone');
    if (phoneInp) phoneInp.value = '';
    const notesInp = document.getElementById('admin-quote-notes');
    if (notesInp) notesInp.value = '';
    const discInp = document.getElementById('admin-quote-discount');
    if (discInp) discInp.value = '0';

    adminQuoteItems = [];
    renderAdminQuoteItemsTable();
    showToast("تم تفريغ الخانات بنجاح", true);
}

async function fetchQuotes() {
    try {
        const res = await fetch('/api/quotes');
        if (res.ok) {
            allQuotes = await res.json();
            renderQuotesTable();
        }
    } catch (err) {
        console.error("Error fetching quotes:", err);
    }
}

function renderQuotesTable(filter = activeQuotesFilter) {
    activeQuotesFilter = filter;
    const tbody = document.getElementById('quotes-list-admin');
    if (!tbody) return;
    tbody.innerHTML = '';

    const countBadge = document.getElementById('admin-quotes-count-badge');
    if (countBadge) countBadge.innerText = (allQuotes || []).length;
    
    let filtered = allQuotes || [];
    if (filter === 'admin') {
        filtered = filtered.filter(q => q.isPrivateAdmin || q.source === 'admin');
    } else if (filter === 'calculator') {
        filtered = filtered.filter(q => !q.isPrivateAdmin && q.source !== 'admin');
    }
    
    const summaryEl = document.getElementById('quotes-table-summary');
    if (summaryEl) summaryEl.innerText = `إجمالي العروض المعروضة: ${filtered.length} من أصل ${(allQuotes || []).length}`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 25px;" class="text-muted">لا توجد عروض أسعار مطابقة في هذا التصنيف</td></tr>`;
        return;
    }
    
    filtered.forEach((q, idx) => {
        const tr = document.createElement('tr');
        
        // Status & Source Badges
        let sourceBadge = '';
        if (q.isPrivateAdmin || q.source === 'admin') {
            sourceBadge = '<span class="status-pill" style="background: rgba(59, 130, 246, 0.18); color: #60a5fa; font-weight: 800; border: 1px solid rgba(59, 130, 246, 0.4);"><i class="fa-solid fa-user-tie"></i> عرض خاص بالإدارة</span>';
        } else if (q.status === 'Approved' || q.status === 'Accepted') {
            sourceBadge = '<span class="status-pill status-completed" style="background: rgba(16, 185, 129, 0.18); color: #10b981; font-weight: 800; border: 1px solid rgba(16, 185, 129, 0.4);"><i class="fa-solid fa-circle-check"></i> معتمد من العميل</span>';
        } else {
            sourceBadge = '<span class="status-pill" style="background: rgba(245, 158, 11, 0.18); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4);"><i class="fa-solid fa-calculator"></i> حاسبة العملاء</span>';
        }

        tr.innerHTML = `
            <td class="font-num text-center" style="font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
            <td class="font-num" style="font-weight: 700; color: #f59e0b;">${q.quoteNo || q.id}</td>
            <td class="font-num">${q.date ? q.date.split('T')[0] : '--'}</td>
            <td style="font-weight: 800; color: var(--text-main);">${q.customerName || '--'}</td>
            <td class="font-num">${q.customerPhone || '--'}</td>
            <td>${q.customerAddress || '--'}</td>
            <td class="font-num" style="font-weight: 900; color: #10b981;">${(q.grandTotal || 0).toLocaleString('en-US')} ${q.currency || 'ر.س'}</td>
            <td>${sourceBadge}</td>
            <td style="white-space: nowrap;">
                <a href="/api/quotes/${q.id}/pdf" target="_blank" class="btn btn-sm btn-primary" title="تحميل ملف PDF الرسمي" style="margin-left: 4px;">
                    <i class="fa-solid fa-file-pdf"></i> PDF
                </a>
                <button type="button" class="btn btn-sm btn-secondary btn-view-quote-details" data-id="${q.id}" title="عرض تفاصيل البنود" style="margin-left: 4px;">
                    <i class="fa-solid fa-list-check"></i>
                </button>
                <button type="button" class="btn btn-sm btn-danger btn-delete-quote" data-id="${q.id}" title="حذف العرض">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        
        tr.querySelector('.btn-view-quote-details')?.addEventListener('click', () => {
            let itemsSummary = (q.items && q.items.length > 0)
                ? q.items.map(it => `- ${it.name || it.model} (عدد ${it.quantity || 1}) بسعر ${it.price || it.unitPrice || 0} ر.س`).join('\n')
                : 'لا توجد تفاصيل بنود مسجلة';
            alert(`عرض سعر رسمي: ${q.quoteNo || q.id}\nالعميل: ${q.customerName}\nالهاتف: ${q.customerPhone}\nالعنوان: ${q.customerAddress}\nالإجمالي: ${(q.grandTotal || 0).toLocaleString('en-US')} ${q.currency || 'ر.س'}\n\nالبنود:\n${itemsSummary}`);
        });

        tr.querySelector('.btn-delete-quote')?.addEventListener('click', async () => {
            if (confirm(`هل أنت متأكد من حذف عرض السعر (${q.quoteNo || q.id}) الخاص بالعميل (${q.customerName})؟`)) {
                try {
                    const res = await fetch(`/api/quotes/${q.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        showToast("تم حذف عرض السعر بنجاح", true);
                        await fetchQuotes();
                    } else {
                        showToast("فشل حذف عرض السعر", false);
                    }
                } catch (e) {
                    showToast("خطأ أثناء حذف عرض السعر", false);
                }
            }
        });
        
        tbody.appendChild(tr);
    });
}

async function editProductPrice(type, id, currentPrice, productName) {
    const newPriceStr = prompt(`تعديل سعر (${productName}) بالريال السعودي:\nالسعر الحالي: ${currentPrice} ر.س`, currentPrice);
    if (newPriceStr === null) return;
    
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) || newPrice <= 0) {
        alert("يرجى إدخال سعر رقمي صحيح أكبر من صفر.");
        return;
    }
    
    try {
        const endpoint = `/api/inventory/${type}/${id}`;
        const res = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: newPrice })
        });
        
        if (res.ok) {
            showToast(`تم تعديل سعر ${productName} إلى ${newPrice} ر.س بنجاح`, true);
            await fetchInventory();
        } else {
            showToast("فشل تحديث السعر في قاعدة البيانات", false);
        }
    } catch (err) {
        console.error(err);
        showToast("حدث خطأ في الاتصال بالخادم", false);
    }
}

function renderPanelsTable() {
    const tbody = document.getElementById('inventory-panels-list');
    tbody.innerHTML = '';
    if (allPanels.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="text-muted">لا توجد ألواح شمسية مسجلة</td></tr>`;
        return;
    }
    allPanels.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${p.name}</td>
            <td class="font-num">${p.watt} W</td>
            <td class="font-num" style="font-weight: 700; color: #f59e0b;">
                ${p.price} ر.س
                <button class="btn btn-sm btn-edit-price" title="تعديل السعر" style="background:none; border:none; color:var(--text-muted); cursor:pointer; margin-right:6px;"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
            <td>
                <button class="btn btn-sm ${p.available ? 'btn-primary' : 'btn-secondary'} btn-toggle-panel" data-id="${p.id}">
                    ${p.available ? '<i class="fa-solid fa-circle-check"></i> متوفر' : '<i class="fa-solid fa-circle-xmark"></i> غير متوفر'}
                </button>
            </td>
            <td>
                <button class="btn-action delete btn-delete-panel" data-id="${p.id}"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tr.querySelector('.btn-edit-price')?.addEventListener('click', () => editProductPrice('panels', p.id, p.price, p.name));
        tr.querySelector('.btn-toggle-panel').addEventListener('click', () => togglePanel(p.id));
        tr.querySelector('.btn-delete-panel').addEventListener('click', () => deletePanel(p.id));
        tbody.appendChild(tr);
    });
}

function renderBatteriesTable() {
    const tbody = document.getElementById('inventory-batteries-list');
    tbody.innerHTML = '';
    if (allBatteries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="text-muted">لا توجد بطاريات مسجلة</td></tr>`;
        return;
    }
    allBatteries.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${b.name}</td>
            <td class="font-num">${b.capacityKwh} kWh (${b.voltage || b.nominalVoltage || 48}V)</td>
            <td class="font-num" style="font-weight: 700; color: #f59e0b;">
                ${b.price} ر.س
                <button class="btn btn-sm btn-edit-price" title="تعديل السعر" style="background:none; border:none; color:var(--text-muted); cursor:pointer; margin-right:6px;"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
            <td>
                <button class="btn btn-sm ${b.available ? 'btn-primary' : 'btn-secondary'} btn-toggle-battery" data-id="${b.id}">
                    ${b.available ? '<i class="fa-solid fa-circle-check"></i> متوفر' : '<i class="fa-solid fa-circle-xmark"></i> غير متوفر'}
                </button>
            </td>
            <td>
                <button class="btn-action delete btn-delete-battery" data-id="${b.id}"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tr.querySelector('.btn-edit-price')?.addEventListener('click', () => editProductPrice('batteries', b.id, b.price, b.name));
        tr.querySelector('.btn-toggle-battery').addEventListener('click', () => toggleBattery(b.id));
        tr.querySelector('.btn-delete-battery').addEventListener('click', () => deleteBattery(b.id));
        tbody.appendChild(tr);
    });
}

function renderInvertersTable() {
    const tbody = document.getElementById('inventory-inverters-list');
    tbody.innerHTML = '';
    if (allInverters.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="text-muted">لا توجد انفرترات مسجلة</td></tr>`;
        return;
    }
    allInverters.forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${inv.name}</td>
            <td class="font-num">${inv.capacityKw} kW (${inv.batteryVoltage || inv.systemVoltage || 48}V)</td>
            <td class="font-num" style="font-weight: 700; color: #f59e0b;">
                ${inv.price} ر.س
                <button class="btn btn-sm btn-edit-price" title="تعديل السعر" style="background:none; border:none; color:var(--text-muted); cursor:pointer; margin-right:6px;"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
            <td>
                <button class="btn btn-sm ${inv.available ? 'btn-primary' : 'btn-secondary'} btn-toggle-inverter" data-id="${inv.id}">
                    ${inv.available ? '<i class="fa-solid fa-circle-check"></i> متوفر' : '<i class="fa-solid fa-circle-xmark"></i> غير متوفر'}
                </button>
            </td>
            <td>
                <button class="btn-action delete btn-delete-inverter" data-id="${inv.id}"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tr.querySelector('.btn-edit-price')?.addEventListener('click', () => editProductPrice('inverters', inv.id, inv.price, inv.name));
        tr.querySelector('.btn-toggle-inverter').addEventListener('click', () => toggleInverter(inv.id));
        tr.querySelector('.btn-delete-inverter').addEventListener('click', () => deleteInverter(inv.id));
        tbody.appendChild(tr);
    });
}

// --- Toggle & Delete Operations ---

async function togglePanel(id) {
    try {
        const res = await fetch(`/api/inventory/panels/${id}/toggle`, { method: 'PUT' });
        if (res.ok) {
            showToast("تم تحديث حالة توفر اللوح الشمسي", true);
            fetchInventory();
        }
    } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
}

async function deletePanel(id) {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا اللوح الشمسي نهائياً من قائمة المخزون؟")) return;
    try {
        const res = await fetch(`/api/inventory/panels/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("تم حذف اللوح بنجاح", true);
            fetchInventory();
        }
    } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
}

async function toggleBattery(id) {
    try {
        const res = await fetch(`/api/inventory/batteries/${id}/toggle`, { method: 'PUT' });
        if (res.ok) {
            showToast("تم تحديث حالة توفر البطارية", true);
            fetchInventory();
        }
    } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
}

async function deleteBattery(id) {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذه البطارية نهائياً من قائمة المخزون؟")) return;
    try {
        const res = await fetch(`/api/inventory/batteries/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("تم حذف البطارية بنجاح", true);
            fetchInventory();
        }
    } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
}

async function toggleInverter(id) {
    try {
        const res = await fetch(`/api/inventory/inverters/${id}/toggle`, { method: 'PUT' });
        if (res.ok) {
            showToast("تم تحديث حالة توفر الانفرتر", true);
            fetchInventory();
        }
    } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
}

async function deleteInverter(id) {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الانفرتر نهائياً من قائمة المخزون؟")) return;
    try {
        const res = await fetch(`/api/inventory/inverters/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("تم حذف الانفرتر بنجاح", true);
            fetchInventory();
        }
    } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
}

function renderBoardsTable() {
    const tbody = document.getElementById('inventory-boards-list');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!allBoards || allBoards.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="text-muted">لا توجد طبالين أو لوحات توزيع مسجلة</td></tr>`;
        return;
    }
    allBoards.forEach(brd => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${brd.name}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${brd.specs || '--'}</td>
            <td class="font-num" style="font-weight: 700; color: #f59e0b;">
                ${brd.price} ر.س
                <button class="btn btn-sm btn-edit-price" title="تعديل السعر" style="background:none; border:none; color:var(--text-muted); cursor:pointer; margin-right:6px;"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
            <td>
                <button class="btn btn-sm ${brd.available ? 'btn-primary' : 'btn-secondary'} btn-toggle-board" data-id="${brd.id}">
                    ${brd.available ? '<i class="fa-solid fa-circle-check"></i> متوفر' : '<i class="fa-solid fa-circle-xmark"></i> غير متوفر'}
                </button>
            </td>
            <td>
                <button class="btn-action delete btn-delete-board" data-id="${brd.id}"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tr.querySelector('.btn-edit-price')?.addEventListener('click', () => editProductPrice('boards', brd.id, brd.price, brd.name));
        tr.querySelector('.btn-toggle-board').addEventListener('click', () => toggleBoard(brd.id));
        tr.querySelector('.btn-delete-board').addEventListener('click', () => deleteBoard(brd.id));
        tbody.appendChild(tr);
    });
}

async function toggleBoard(id) {
    try {
        const res = await fetch(`/api/inventory/boards/${id}/toggle`, { method: 'PUT' });
        if (res.ok) {
            showToast("تم تحديث حالة توفر الطبلون", true);
            fetchInventory();
        }
    } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
}

async function deleteBoard(id) {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الطبلون نهائياً من قائمة المخزون؟")) return;
    try {
        const res = await fetch(`/api/inventory/boards/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("تم حذف الطبلون بنجاح", true);
            fetchInventory();
        }
    } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
}

// --- Form Submissions and API Actions ---

// Login Submit
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error-msg');
    
    errorMsg.style.display = 'none';
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
            currentUser = data.user;
            showDashboard();
            showToast("تم تسجيل الدخول بنجاح", true);
        } else {
            errorMsg.innerText = data.error || "فشل تسجيل الدخول";
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        errorMsg.innerText = "تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً";
        errorMsg.style.display = 'block';
    }
});

// Logout Submit
document.getElementById('btn-logout').addEventListener('click', async () => {
    if (!confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) return;
    
    try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
            currentUser = null;
            showLogin();
            showToast("تم تسجيل الخروج بنجاح", true);
        }
    } catch (err) {
        showToast("فشل تسجيل الخروج", false);
    }
});

// Change Lead Status
async function handleLeadStatusChange(e) {
    const leadId = e.target.getAttribute('data-id');
    const status = e.target.value;
    
    try {
        const res = await fetch(`/api/leads/${leadId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (res.ok) {
            showToast("تم تحديث حالة الطلب", true);
            loadAllData();
        } else {
            const err = await res.json();
            showToast(err.error || "فشل تحديث الحالة", false);
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالخادم", false);
    }
}

// Delete Lead
async function deleteLead(id) {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الطلب نهائياً؟")) return;
    
    try {
        const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("تم حذف طلب العميل بنجاح", true);
            loadAllData();
        } else {
            showToast("فشل في حذف الطلب", false);
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالخادم", false);
    }
}

// Appliance Form Submit (Add / Edit)
document.getElementById('appliance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('appliance-name').value.trim();
    const watt = parseFloat(document.getElementById('appliance-watt').value);
    const icon = document.getElementById('appliance-icon').value;
    const dayHours = parseFloat(document.getElementById('appliance-day-hours').value || 4);
    const nightHours = parseFloat(document.getElementById('appliance-night-hours').value || 4);
    
    const payload = { name, watt, icon, dayHours, nightHours };
    
    try {
        let res;
        if (editModeApplianceId) {
            res = await fetch(`/api/appliances/${editModeApplianceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch('/api/appliances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(editModeApplianceId ? "تم تحديث الجهاز بنجاح" : "تم إضافة الجهاز الجديد بنجاح", true);
            resetApplianceForm();
            loadAllData();
        } else {
            showToast(data.error || "تعذر حفظ الجهاز", false);
        }
    } catch (err) {
        showToast("حدث خطأ أثناء الاتصال بالخادم", false);
    }
});

function loadApplianceForEdit(app) {
    editModeApplianceId = app.id;
    document.getElementById('appliance-form-title').innerText = "تعديل الجهاز المحدد";
    document.getElementById('appliance-name').value = app.name;
    document.getElementById('appliance-watt').value = app.watt;
    document.getElementById('appliance-icon').value = app.icon || 'fa-plug';
    document.getElementById('appliance-day-hours').value = app.dayHours;
    document.getElementById('appliance-night-hours').value = app.nightHours;
    document.getElementById('btn-appliance-save').innerText = "تحديث الجهاز";
    document.getElementById('btn-appliance-reset').style.display = 'inline-flex';
}

document.getElementById('btn-appliance-reset').addEventListener('click', resetApplianceForm);

function resetApplianceForm() {
    editModeApplianceId = null;
    document.getElementById('appliance-form-title').innerText = "إضافة جهاز جديد للحاسبة";
    document.getElementById('appliance-form').reset();
    document.getElementById('btn-appliance-save').innerText = "حفظ الجهاز";
    document.getElementById('btn-appliance-reset').style.display = 'none';
}

// Delete Appliance
async function deleteAppliance(id) {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الجهاز من الحاسبة؟")) return;
    
    try {
        const res = await fetch(`/api/appliances/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("تم حذف الجهاز بنجاح", true);
            loadAllData();
        } else {
            showToast("فشل في حذف الجهاز", false);
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالخادم", false);
    }
}

// Content Form Submit
document.getElementById('content-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('content-title').value.trim();
    const heroBadge = document.getElementById('content-hero-badge') ? document.getElementById('content-hero-badge').value.trim() : '';
    const heroTitle = document.getElementById('content-hero-title').value.trim();
    const heroSubtitle = document.getElementById('content-hero-subtitle').value.trim();
    
    const servicesTitle = document.getElementById('content-services-title') ? document.getElementById('content-services-title').value.trim() : '';
    const servicesSubtitle = document.getElementById('content-services-subtitle') ? document.getElementById('content-services-subtitle').value.trim() : '';
    
    const service1Title = document.getElementById('content-service1-title') ? document.getElementById('content-service1-title').value.trim() : '';
    const service1Desc = document.getElementById('content-service1-desc') ? document.getElementById('content-service1-desc').value.trim() : '';
    const service2Title = document.getElementById('content-service2-title') ? document.getElementById('content-service2-title').value.trim() : '';
    const service2Desc = document.getElementById('content-service2-desc') ? document.getElementById('content-service2-desc').value.trim() : '';
    const service3Title = document.getElementById('content-service3-title') ? document.getElementById('content-service3-title').value.trim() : '';
    const service3Desc = document.getElementById('content-service3-desc') ? document.getElementById('content-service3-desc').value.trim() : '';
    const service4Title = document.getElementById('content-service4-title') ? document.getElementById('content-service4-title').value.trim() : '';
    const service4Desc = document.getElementById('content-service4-desc') ? document.getElementById('content-service4-desc').value.trim() : '';
    
    const phone = document.getElementById('content-phone').value.trim();
    const email = document.getElementById('content-email').value.trim();
    const address = document.getElementById('content-address').value.trim();
    const footerAbout = document.getElementById('content-footer-about') ? document.getElementById('content-footer-about').value.trim() : '';
    
    const payload = { 
        title, heroBadge, heroTitle, heroSubtitle,
        servicesTitle, servicesSubtitle,
        service1Title, service1Desc,
        service2Title, service2Desc,
        service3Title, service3Desc,
        service4Title, service4Desc,
        phone, email, address, footerAbout
    };
    
    try {
        const res = await fetch('/api/content/text', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
            showToast("تم تحديث نصوص ومحتوى الموقع بنجاح", true);
            loadAllData();
        } else {
            showToast(data.error || "فشل تحديث المحتوى", false);
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالخادم", false);
    }
});

// User Form Submit (SuperAdmin/Authorized Only)
document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    
    // Compile checked permissions
    const checkedBoxes = document.querySelectorAll('input[name="permissions"]:checked');
    const permissions = Array.from(checkedBoxes).map(cb => cb.value);
    
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, permissions })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
            showToast("تم إضافة المشرف الجديد بنجاح", true);
            document.getElementById('user-form').reset();
            // Re-check defaults for permissions checkboxes
            const checkboxes = document.querySelectorAll('input[name="permissions"]');
            checkboxes.forEach(cb => {
                if (cb.value !== 'users') cb.checked = true;
                else cb.checked = false;
            });
            fetchUsers();
        } else {
            showToast(data.error || "تعذر إضافة المستخدم", false);
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالخادم", false);
    }
});

// Delete User
async function deleteUser(username) {
    if (!confirm(`هل أنت متأكد من حذف الحساب "${username}" نهائياً؟`)) return;
    
    try {
        const res = await fetch(`/api/users/${username}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("تم حذف الحساب بنجاح", true);
            fetchUsers();
        } else {
            const err = await res.json();
            showToast(err.error || "فشل في حذف المستخدم", false);
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالخادم", false);
    }
}

// Password Form Submit
document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('profile-password').value;
    const confirmPass = document.getElementById('profile-password-confirm').value;
    
    if (password !== confirmPass) {
        showToast("أخطاء في تأكيد كلمة المرور، يرجى التطابق", false);
        return;
    }
    
    try {
        const res = await fetch('/api/users/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword: password })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
            showToast("تم تعديل كلمة المرور بنجاح", true);
            document.getElementById('password-form').reset();
        } else {
            showToast(data.error || "فشل تحديث كلمة المرور", false);
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالخادم", false);
    }
});

// --- Modal Details Functions ---
function openLeadModal(lead) {
    const modal = document.getElementById('lead-modal');
    
    document.getElementById('modal-lead-name').innerText = `تفاصيل طلب العميل: ${lead.name}`;
    document.getElementById('modal-detail-name').innerText = lead.name;
    document.getElementById('modal-detail-phone').innerText = lead.phone;
    
    const dateStr = new Date(lead.createdAt).toLocaleString('ar-YE', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('modal-detail-date').innerText = dateStr;
    
    document.getElementById('modal-detail-size').innerText = `${Number(lead.systemSizeKw).toFixed(2)} كيلووات (kW)`;
    document.getElementById('modal-detail-panels').innerText = `${lead.panelsCount}`;
    
    document.getElementById('modal-detail-batteries').innerText = `${lead.batteriesKwh}`;
    document.getElementById('modal-detail-inverter').innerText = lead.inverterKva;
    
    const costStr = lead.currency === 'USD' ? `$${Number(lead.totalCost).toLocaleString()}` : `${Number(lead.totalCost).toLocaleString()} ريال سعودي`;
    document.getElementById('modal-detail-cost').innerText = costStr;
    
    document.getElementById('modal-detail-notes').innerText = lead.notes || 'لا توجد ملاحظات إضافية.';
    
    modal.style.display = 'flex';
}

function closeLeadModal() {
    document.getElementById('lead-modal').style.display = 'none';
}

// --- Setup Event Listeners ---
function setupEventListeners() {

    // --- Sub-Tabs inside Section Quotes ---
    const btnTabCreate = document.getElementById('btn-tab-create-quote');
    const btnTabHistory = document.getElementById('btn-tab-history-quotes');
    const panelTabCreate = document.getElementById('panel-tab-create-quote');
    const panelTabHistory = document.getElementById('panel-tab-history-quotes');

    btnTabCreate?.addEventListener('click', () => {
        btnTabCreate.classList.add('active');
        btnTabHistory.classList.remove('active');
        panelTabCreate.classList.add('active');
        panelTabHistory.classList.remove('active');
        renderAdminQuoteProductIcons(activeQuoteIconsFilter);
    });

    btnTabHistory?.addEventListener('click', () => {
        btnTabHistory.classList.add('active');
        btnTabCreate.classList.remove('active');
        panelTabHistory.classList.add('active');
        panelTabCreate.classList.remove('active');
        renderQuotesTable(activeQuotesFilter);
    });

    // Quote Icons Filter Pills
    document.querySelectorAll('#admin-quote-icons-filter-bar .quote-icon-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#admin-quote-icons-filter-bar .quote-icon-filter-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const filter = e.currentTarget.getAttribute('data-filter') || 'all';
            renderAdminQuoteProductIcons(filter);
        });
    });

    // Saved Quotes Filter Pills
    document.querySelectorAll('.filter-quotes-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-quotes-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const filter = e.currentTarget.getAttribute('data-qfilter') || 'all';
            renderQuotesTable(filter);
        });
    });

    // Add New Product on-the-fly Form in Quote Builder
    document.getElementById('admin-add-icon-product-form')?.addEventListener('submit', handleAddNewCustomProduct);

    // Save & PDF & Clear Quote Buttons
    document.getElementById('btn-admin-quote-save')?.addEventListener('click', saveAdminQuote);
    document.getElementById('btn-admin-quote-pdf')?.addEventListener('click', downloadAdminQuotePdf);
    document.getElementById('btn-admin-quote-reset')?.addEventListener('click', resetAdminQuoteForm);
    document.getElementById('btn-admin-quote-clear')?.addEventListener('click', () => {
        if (adminQuoteItems.length > 0 && confirm("هل تريد مسح جميع البنود المضافة؟")) {
            adminQuoteItems = [];
            renderAdminQuoteItemsTable();
        }
    });

    // Discount input listener
    document.getElementById('admin-quote-discount')?.addEventListener('input', updateAdminQuoteTotals);

    // Sidebar Tab switches
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const sections = document.querySelectorAll('.admin-main .content-section');
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            sections.forEach(s => {
                if (s.id === target) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
            
            document.getElementById('admin-sidebar').classList.remove('open');
        });
    });
    
    // Sidebar Toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('admin-sidebar').classList.toggle('open');
    });
    
    // Close Modal triggers
    document.getElementById('btn-close-modal').addEventListener('click', closeLeadModal);
    document.getElementById('modal-btn-close').addEventListener('click', closeLeadModal);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('lead-modal');
        if (e.target === modal) {
            closeLeadModal();
        }
    });

    // --- Inventory Adding Forms Listeners ---
    
    // Add Panel
    document.getElementById('add-panel-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('panel-new-name').value.trim();
        const watt = parseInt(document.getElementById('panel-new-watt').value);
        const price = parseFloat(document.getElementById('panel-new-price').value);
        
        try {
            const res = await fetch('/api/inventory/panels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, watt, price })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast("تم إضافة اللوح الجديد للمخزون", true);
                document.getElementById('add-panel-form').reset();
                fetchInventory();
            } else {
                showToast(data.error || "تعذر إضافة اللوح", false);
            }
        } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
    });

    // Add Battery
    document.getElementById('add-battery-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('battery-new-name').value.trim();
        const capacityKwh = parseFloat(document.getElementById('battery-new-capacity').value);
        const price = parseFloat(document.getElementById('battery-new-price').value);
        
        try {
            const res = await fetch('/api/inventory/batteries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, capacityKwh, price })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast("تم إضافة البطارية الجديدة للمخزون", true);
                document.getElementById('add-battery-form').reset();
                fetchInventory();
            } else {
                showToast(data.error || "تعذر إضافة البطارية", false);
            }
        } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
    });

    // Add Inverter
    document.getElementById('add-inverter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('inverter-new-name').value.trim();
        const capacityKw = parseFloat(document.getElementById('inverter-new-capacity').value);
        const price = parseFloat(document.getElementById('inverter-new-price').value);
        
        try {
            const res = await fetch('/api/inventory/inverters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, capacityKw, price })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast("تم إضافة الانفرتر الجديد للمخزون", true);
                document.getElementById('add-inverter-form').reset();
                fetchInventory();
            } else {
                showToast(data.error || "تعذر إضافة الانفرتر", false);
            }
        } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
    });

    // Add Distribution Board (الطبالين وقواطع الحماية)
    const addBoardForm = document.getElementById('add-board-form');
    if (addBoardForm) {
        addBoardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('board-new-name').value.trim();
            const specs = document.getElementById('board-new-specs').value.trim();
            const brand = document.getElementById('board-new-brand').value.trim() || 'Crown Micro';
            const price = parseFloat(document.getElementById('board-new-price').value);

            try {
                const res = await fetch('/api/inventory/boards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, specs, brand, price })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast("تم إضافة الطبلون الجديد للمخزون بنجاح", true);
                    addBoardForm.reset();
                    fetchInventory();
                } else {
                    showToast(data.error || "تعذر إضافة الطبلون", false);
                }
            } catch (err) { showToast("حدث خطأ في الاتصال بالخادم", false); }
        });
    }
}

// --- Show Toast Message ---
function showToast(message, isSuccess) {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    
    toastMsg.innerText = message;
    toast.className = 'toast-notify show ' + (isSuccess ? 'toast-success' : 'toast-error');
    toastIcon.className = 'fa-solid ' + (isSuccess ? 'fa-circle-check' : 'fa-circle-exclamation');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// --- Theme control ---
function initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    
    document.body.className = savedTheme;
    updateThemeIcon();
    
    themeBtn.addEventListener('click', () => {
        if (document.body.classList.contains('dark-theme')) {
            document.body.className = 'light-theme';
            localStorage.setItem('theme', 'light-theme');
        } else {
            document.body.className = 'dark-theme';
            localStorage.setItem('theme', 'dark-theme');
        }
        updateThemeIcon();
    });
}

function updateThemeIcon() {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        if (document.body.classList.contains('dark-theme')) {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }
}

// --- Design Parameters Functions ---
async function fetchDesignParams() {
    try {
        const res = await fetch('/api/design-params');
        if (res.ok) {
            const p = await res.json();
            if (document.getElementById('param-psh')) document.getElementById('param-psh').value = p.psh || 5.8;
            if (document.getElementById('param-derating')) document.getElementById('param-derating').value = p.deratingFactor || 0.78;
            if (document.getElementById('param-inverter-margin')) document.getElementById('param-inverter-margin').value = p.inverterSafetyMargin || 1.25;
            if (document.getElementById('param-exchange-rate')) document.getElementById('param-exchange-rate').value = p.currencyExchangeRate || 535;
            if (document.getElementById('param-temp-min')) document.getElementById('param-temp-min').value = p.tempMinC || 15;
            if (document.getElementById('param-temp-max')) document.getElementById('param-temp-max').value = p.tempMaxCellC || 65;
            if (document.getElementById('param-quote-validity')) document.getElementById('param-quote-validity').value = p.quoteValidityDays || 15;
            if (document.getElementById('param-default-currency')) document.getElementById('param-default-currency').value = p.defaultCurrency || 'USD';
            if (document.getElementById('param-enable-yer')) document.getElementById('param-enable-yer').checked = Boolean(p.enableYerDisplay);
        }
    } catch (err) {
        console.error("Failed to fetch design params", err);
    }
}

// Handle Design Parameters form submit
document.getElementById('design-params-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        psh: parseFloat(document.getElementById('param-psh').value),
        deratingFactor: parseFloat(document.getElementById('param-derating').value),
        inverterSafetyMargin: parseFloat(document.getElementById('param-inverter-margin').value),
        currencyExchangeRate: parseFloat(document.getElementById('param-exchange-rate').value),
        tempMinC: parseFloat(document.getElementById('param-temp-min').value),
        tempMaxCellC: parseFloat(document.getElementById('param-temp-max').value),
        quoteValidityDays: parseInt(document.getElementById('param-quote-validity')?.value, 10) || 15,
        defaultCurrency: document.getElementById('param-default-currency')?.value || 'USD',
        enableYerDisplay: Boolean(document.getElementById('param-enable-yer')?.checked)
    };
    try {
        const res = await fetch('/api/design-params', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast("تم تحديث المعايير الهندسية بنجاح", true);
        } else {
            showToast("فشل تحديث المعايير الهندسية", false);
        }
    } catch (err) {
        showToast("خطأ في الاتصال بالخادم", false);
    }
});

