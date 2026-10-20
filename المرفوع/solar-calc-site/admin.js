// Base state
let currentUser = null;
let allLeads = [];
let allAppliances = [];
let editModeApplianceId = null;

// Inventory State
let allPanels = [];
let allBatteries = [];
let allInverters = [];

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
    if (hasPerm('appliances')) promises.push(fetchAppliances());
    if (hasPerm('content')) promises.push(fetchContentSettings());
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
        const [pRes, bRes, iRes] = await Promise.all([
            fetch('/api/inventory/panels'),
            fetch('/api/inventory/batteries'),
            fetch('/api/inventory/inverters')
        ]);
        if (pRes.ok) allPanels = await pRes.json();
        if (bRes.ok) allBatteries = await bRes.json();
        if (iRes.ok) allInverters = await iRes.json();
        
        renderPanelsTable();
        renderBatteriesTable();
        renderInvertersTable();
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
    document.getElementById('content-hero-title').value = settings.heroTitle || '';
    document.getElementById('content-hero-subtitle').value = settings.heroSubtitle || '';
    document.getElementById('content-phone').value = settings.phone || '';
    document.getElementById('content-email').value = settings.email || '';
    document.getElementById('content-address').value = settings.address || '';
}

// --- Render Inventory Tables ---

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
            <td class="font-num">$${p.price}</td>
            <td>
                <button class="btn btn-sm ${p.available ? 'btn-primary' : 'btn-secondary'} btn-toggle-panel" data-id="${p.id}">
                    ${p.available ? '<i class="fa-solid fa-circle-check"></i> متوفر' : '<i class="fa-solid fa-circle-xmark"></i> غير متوفر'}
                </button>
            </td>
            <td>
                <button class="btn-action delete btn-delete-panel" data-id="${p.id}"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
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
            <td class="font-num">${b.capacityKwh} kWh</td>
            <td class="font-num">$${b.price}</td>
            <td>
                <button class="btn btn-sm ${b.available ? 'btn-primary' : 'btn-secondary'} btn-toggle-battery" data-id="${b.id}">
                    ${b.available ? '<i class="fa-solid fa-circle-check"></i> متوفر' : '<i class="fa-solid fa-circle-xmark"></i> غير متوفر'}
                </button>
            </td>
            <td>
                <button class="btn-action delete btn-delete-battery" data-id="${b.id}"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
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
            <td class="font-num">${inv.capacityKw} kW</td>
            <td class="font-num">$${inv.price}</td>
            <td>
                <button class="btn btn-sm ${inv.available ? 'btn-primary' : 'btn-secondary'} btn-toggle-inverter" data-id="${inv.id}">
                    ${inv.available ? '<i class="fa-solid fa-circle-check"></i> متوفر' : '<i class="fa-solid fa-circle-xmark"></i> غير متوفر'}
                </button>
            </td>
            <td>
                <button class="btn-action delete btn-delete-inverter" data-id="${inv.id}"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
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
    const heroTitle = document.getElementById('content-hero-title').value.trim();
    const heroSubtitle = document.getElementById('content-hero-subtitle').value.trim();
    const phone = document.getElementById('content-phone').value.trim();
    const email = document.getElementById('content-email').value.trim();
    const address = document.getElementById('content-address').value.trim();
    
    const payload = { title, heroTitle, heroSubtitle, phone, email, address };
    
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

