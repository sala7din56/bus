import { api } from './api.js';
import { renderStatusPill, renderModal, renderDataTable, showToast, initGlobalUI, renderStatCard, animateCountUps } from './shared.js';
import './auth.js';

let allDrivers = [];
let allRoutes = [];
let allBuses = [];
let allDepots = [];
let currentFilters = { status: '', depot: '', shift: '', search: '' };
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    loadDependencies().then(() => {
        setupFilters();
        loadDrivers();
        loadStats();
    });

    document.getElementById('addDriverBtn').addEventListener('click', () => openDriverModal());
    
    // Setup Drawer Close
    document.getElementById('closeDrawerBtn').addEventListener('click', closeDrawer);
    document.getElementById('driverDrawer').addEventListener('click', (e) => {
        if (e.target.id === 'driverDrawer') closeDrawer();
    });

    // URL parameter filtering (e.g. ?filter=expiring)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('filter') === 'expiring') {
        setTimeout(() => showExpiringLicenses(), 500);
    }
});

async function loadDependencies() {
    try {
        const [routes, buses, depots] = await Promise.all([
            api.routes.list(),
            api.buses.list(),
            api.depots.list()
        ]);
        allRoutes = routes;
        allBuses = buses;
        allDepots = depots;
        
        // Populate Depot Filter Dropdown
        const depotSelect = document.getElementById('filterDepot');
        depots.forEach(dp => {
            const opt = document.createElement('option');
            opt.value = dp.name;
            opt.textContent = dp.name;
            depotSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load dependencies', err);
    }
}

function buildQueryString() {
    const params = new URLSearchParams();
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.depot) params.append('depot', currentFilters.depot);
    if (currentFilters.shift) params.append('shift', currentFilters.shift);
    if (currentFilters.search) params.append('search', currentFilters.search);
    params.append('limit', '500'); // Fetch max for front-end sorting/viewing
    return `?${params.toString()}`;
}

function setupFilters() {
    let debounceTimer;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        currentFilters.search = e.target.value;
        debounceTimer = setTimeout(() => loadDrivers(), 300);
    });

    document.getElementById('filterStatus').addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        loadDrivers();
    });
    
    document.getElementById('filterDepot').addEventListener('change', (e) => {
        currentFilters.depot = e.target.value;
        loadDrivers();
    });

    document.getElementById('filterShift').addEventListener('change', (e) => {
        currentFilters.shift = e.target.value;
        loadDrivers();
    });
}

function camelToHuman(str) {
    return str.replace(/_DEPOT/g, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

async function loadStats() {
    try {
        const stats = await api.drivers.stats();
        const grid = document.getElementById('driverStatsGrid');
        grid.classList.remove('skeleton');
        
        grid.innerHTML = `
            ${renderStatCard('badge', 'navy', 'Total', stats.total, 'All enrolled drivers')}
            ${renderStatCard('check_circle', 'green', 'Active', stats.active, 'Currently working')}
            ${renderStatCard('beach_access', 'orange', 'On Leave', stats.onLeave, 'Vacation/Sick')}
            ${renderStatCard('report_problem', 'red', 'Suspended', stats.suspended, 'Requires attention')}
        `;
        animateCountUps();
    } catch(err) {
        console.error('Failed to load stats', err);
    }
}

async function showExpiringLicenses() {
    try {
        const expiring = await api.drivers.expiring(30);
        allDrivers = expiring; // override view
        renderTable(expiring);
        showToast(`Showing ${expiring.length} expiring licenses`, 'info');
    } catch(err) {
        showToast('Failed to load expiring licenses', 'error');
    }
}

async function loadDrivers() {
    const indicator = document.getElementById('refreshIndicator');
    if (indicator) {
        indicator.style.opacity = '1';
        indicator.classList.add('spin');
    }

    try {
        const res = await api.drivers.list(buildQueryString());
        allDrivers = res.drivers || [];
        renderTable(allDrivers);
    } catch (err) {
        showToast('Failed to load drivers', 'error');
    } finally {
        if (indicator) {
            indicator.classList.remove('spin');
            indicator.style.opacity = '0';
        }
    }
}

function renderTable(drivers) {
    const container = document.getElementById('driversTableContainer');
    const columns = ['Driver', 'Code', 'Contact', 'Depot / Shift', 'Status', 'Assignment', 'Actions'];
    
    window.viewDriver = (id) => {
        const driver = allDrivers.find(d => d.id === id);
        if (driver) openDrawer(driver);
    };

    window.editDriver = (id) => {
        const driver = allDrivers.find(d => d.id === id);
        if (driver) openDriverModal(driver);
    };

    window.quickStatus = (id) => {
        const driver = allDrivers.find(d => d.id === id);
        if (driver) openStatusModal(driver);
    };

    window.promptDeleteDriver = (id) => {
        if (confirm('Are you sure you want to delete this driver? This action cannot be undone.')) {
            api.drivers.delete(id).then(() => {
                showToast('Driver deleted successfully');
                loadDrivers();
                loadStats();
            }).catch(() => showToast('Failed to delete driver', 'error'));
        }
    };

    if (drivers.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--color-text-muted);">
                <span class="material-icons" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">badge</span>
                <h3>No drivers found</h3>
                <p>Try adjusting your search or filters.</p>
            </div>`;
        return;
    }

    const rowsHTML = drivers.map(d => {
        const photo = d.photo ? `<img src="${d.photo}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` : 
                                `<div class="driver-photo-placeholder" style="width: 32px; height: 32px; font-size: 14px;">${d.fullName.charAt(0)}</div>`;
        
        let assignment = '<span style="color: var(--color-text-muted)">Unassigned</span>';
        if (d.assignedBus) {
            assignment = `<span class="material-icons" style="font-size: 14px; vertical-align: middle;">directions_bus</span> Bus ${d.assignedBus.id.substring(d.assignedBus.id.length - 4).toUpperCase()}`;
        } else if (d.assignedRoute) {
            assignment = `<span class="material-icons" style="font-size: 14px; vertical-align: middle;">route</span> Route ${d.assignedRoute.name}`;
        }
        
        return `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="viewDriver('${d.id}')">
                    ${photo}
                    <div>
                        <div style="font-weight: 600; color: var(--color-teal);">${d.fullName}</div>
                        <div style="font-size: 12px; color: var(--color-text-muted);" dir="rtl">${d.fullNameKurdish}</div>
                    </div>
                </div>
            </td>
            <td style="font-family: monospace; font-weight: 600;">${d.employeeCode}</td>
            <td>
                <div style="font-size: 13px;">${d.phoneNumber}</div>
                ${d.email ? `<div style="font-size: 12px; color: var(--color-text-muted);">${d.email}</div>` : ''}
            </td>
            <td>
                <div style="font-size: 13px; font-weight: 500;">${d.depotName.replace('_DEPOT', '')}</div>
                <div style="font-size: 12px; color: var(--color-text-muted);">${camelToHuman(d.shift)}</div>
            </td>
            <td>${renderStatusPill(d.status)}</td>
            <td style="font-size: 13px; font-weight: 500;">${assignment}</td>
            <td class="actions">
                <button class="action-btn" title="View Details" onclick="viewDriver('${d.id}')">
                    <span class="material-icons" style="color: var(--color-blue)">visibility</span>
                </button>
                <button class="action-btn" title="Quick Status" onclick="quickStatus('${d.id}')">
                    <span class="material-icons" style="color: var(--color-orange)">swap_horiz</span>
                </button>
                <button class="action-btn edit" title="Edit" onclick="editDriver('${d.id}')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="action-btn delete" title="Delete" onclick="promptDeleteDriver('${d.id}')">
                    <span class="material-icons">delete</span>
                </button>
            </td>
        </tr>
    `}).join('');

    container.innerHTML = renderDataTable(columns, rowsHTML);
}

// Drawer logic
function openDrawer(driver) {
    const drawer = document.getElementById('driverDrawer');
    const body = document.getElementById('drawerBody');
    
    let assignmentDetails = '<em>Not currently assigned to any active vehicle or route.</em>';
    if (driver.assignedBus) {
        assignmentDetails = `<strong>Bus ID:</strong> ${driver.assignedBus.id}<br><strong>Status:</strong> ${driver.assignedBus.status}`;
    }
    if (driver.assignedRoute) {
        assignmentDetails += `<br><strong>Route:</strong> ${driver.assignedRoute.name}`;
    }

    body.innerHTML = `
        <div class="driver-header-card">
            ${driver.photo ? `<img src="${driver.photo}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover;">` : `<div class="driver-photo-placeholder">${driver.fullName.charAt(0)}</div>`}
            <div>
                <h3 style="margin-bottom: 4px;">${driver.fullName}</h3>
                <div style="color: var(--color-text-muted); font-size: 13px;" dir="rtl">${driver.fullNameKurdish}</div>
                <div style="margin-top: 8px;">${renderStatusPill(driver.status)}</div>
            </div>
        </div>

        <div class="drawer-section">
            <div class="drawer-section-title">Employment</div>
            <div class="drawer-item"><span class="drawer-label">Employee Code</span><span class="drawer-val" style="font-family: monospace;">${driver.employeeCode}</span></div>
            <div class="drawer-item"><span class="drawer-label">Depot & Shift</span><span class="drawer-val">${camelToHuman(driver.depotName)} • ${camelToHuman(driver.shift)}</span></div>
            <div class="drawer-item"><span class="drawer-label">Contract Type</span><span class="drawer-val">${camelToHuman(driver.contractType)}</span></div>
            <div class="drawer-item"><span class="drawer-label">Hire Date</span><span class="drawer-val">${new Date(driver.hireDate).toLocaleDateString()}</span></div>
        </div>

        <div class="drawer-section">
            <div class="drawer-section-title">Contact Information</div>
            <div class="drawer-item"><span class="drawer-label">Phone</span><span class="drawer-val">${driver.phoneNumber}</span></div>
            ${driver.phoneNumberAlt ? `<div class="drawer-item"><span class="drawer-label">Alt Phone</span><span class="drawer-val">${driver.phoneNumberAlt}</span></div>` : ''}
            ${driver.email ? `<div class="drawer-item"><span class="drawer-label">Email</span><span class="drawer-val">${driver.email}</span></div>` : ''}
            ${driver.address ? `<div class="drawer-item"><span class="drawer-label">Address</span><span class="drawer-val">${driver.address}</span></div>` : ''}
        </div>

        <div class="drawer-section">
            <div class="drawer-section-title">License Details</div>
            <div class="drawer-item"><span class="drawer-label">License Number</span><span class="drawer-val" style="font-family: monospace;">${driver.licenseNumber}</span></div>
            <div class="drawer-item"><span class="drawer-label">Type</span><span class="drawer-val">${camelToHuman(driver.licenseType)}</span></div>
            <div class="drawer-item">
                <span class="drawer-label">Expiry Date</span>
                <span class="drawer-val ${new Date(driver.licenseExpiry) < new Date() ? 'status-pill status-OUT_OF_SERVICE' : ''}">
                    ${new Date(driver.licenseExpiry).toLocaleDateString()}
                </span>
            </div>
        </div>

        <div class="drawer-section">
            <div class="drawer-section-title">Current Assignment</div>
            <div class="drawer-item"><span class="drawer-val" style="font-size: 13px;">${assignmentDetails}</span></div>
        </div>
        
        ${driver.emergencyContactName ? `
        <div class="drawer-section">
            <div class="drawer-section-title">Emergency Contact</div>
            <div class="drawer-item"><span class="drawer-label">Name (${driver.emergencyContactRelation || 'Relation'})</span><span class="drawer-val">${driver.emergencyContactName}</span></div>
            <div class="drawer-item"><span class="drawer-label">Phone</span><span class="drawer-val">${driver.emergencyContactPhone}</span></div>
        </div>` : ''}
    `;
    
    drawer.classList.add('active');
}

function closeDrawer() {
    document.getElementById('driverDrawer').classList.remove('active');
}

function openStatusModal(driver) {
    const title = `Update Status: ${driver.fullName}`;
    const formHTML = `
        <input type="hidden" id="statusDriverId" value="${driver.id}">
        <div class="form-group">
            <label class="form-label" for="newDriverStatus">New Status</label>
            <select id="newDriverStatus" class="form-control">
                <option value="ACTIVE" ${driver.status === 'ACTIVE' ? 'selected' : ''}>Active</option>
                <option value="ON_LEAVE" ${driver.status === 'ON_LEAVE' ? 'selected' : ''}>On Leave</option>
                <option value="SUSPENDED" ${driver.status === 'SUSPENDED' ? 'selected' : ''}>Suspended</option>
                <option value="RETIRED" ${driver.status === 'RETIRED' ? 'selected' : ''}>Retired</option>
                <option value="TERMINATED" ${driver.status === 'TERMINATED' ? 'selected' : ''}>Terminated</option>
            </select>
        </div>
        <p style="font-size: 12px; color: var(--color-text-muted);">Changing status to Retired or Terminated will automatically record the termination date.</p>
    `;

    renderModal(title, formHTML, async (form, closeModal) => {
        try {
            const status = document.getElementById('newDriverStatus').value;
            await api.drivers.updateStatus(driver.id, { status });
            showToast('Status updated');
            closeModal();
            loadDrivers();
            loadStats();
        } catch (err) {
            showToast('Failed to update status', 'error');
        }
    });
}

function openDriverModal(driver = null) {
    const isEdit = !!driver;
    const title = isEdit ? 'Edit Driver' : 'Add Driver';
    const d = driver || { 
        fullName: '', fullNameKurdish: '', employeeCode: '', phoneNumber: '', 
        licenseNumber: '', licenseType: 'CLASS_A', licenseExpiry: '', 
        depotName: '', status: 'ACTIVE', shift: 'MORNING', contractType: 'FULL_TIME', hireDate: new Date().toISOString().split('T')[0]
    };

    const formatDate = (dateString) => dateString ? new Date(dateString).toISOString().split('T')[0] : '';
    
    window.switchDriverTab = (tabId) => {
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelector(`.modal-tab[data-target="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
    };

    const formHTML = `
        <input type="hidden" id="drvId" value="${d.id || ''}">
        
        <div class="modal-tabs">
            <div class="modal-tab active" data-target="tabPersonal" onclick="switchDriverTab('tabPersonal')">Personal & Contact</div>
            <div class="modal-tab" data-target="tabEmployment" onclick="switchDriverTab('tabEmployment')">Employment & License</div>
        </div>

        <div id="tabPersonal" class="tab-content active">
            <div class="flex-between gap-4" style="display: flex; gap: 12px;">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label" for="drvName">Full Name (English) *</label>
                    <input type="text" id="drvName" class="form-control" value="${d.fullName}" required>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label" for="drvNameKurdish">Full Name (Kurdish) *</label>
                    <input type="text" id="drvNameKurdish" class="form-control" value="${d.fullNameKurdish}" dir="rtl" required>
                </div>
            </div>
            
            <div class="flex-between gap-4" style="display: flex; gap: 12px;">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label" for="drvPhone">Primary Phone *</label>
                    <input type="text" id="drvPhone" class="form-control" value="${d.phoneNumber}" placeholder="+964 750..." required>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label" for="drvPhoneAlt">Alt Phone</label>
                    <input type="text" id="drvPhoneAlt" class="form-control" value="${d.phoneNumberAlt || ''}">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label" for="drvEmail">Email Address</label>
                <input type="email" id="drvEmail" class="form-control" value="${d.email || ''}">
            </div>
            
            <div class="form-group">
                <label class="form-label" for="drvAddress">Home Address</label>
                <input type="text" id="drvAddress" class="form-control" value="${d.address || ''}">
            </div>
            
            <div style="border-top: 1px solid var(--color-border); margin: 20px 0; padding-top: 20px;">
                <h4 style="margin-bottom: 12px; font-size: 13px; color: var(--color-text-muted);">Emergency Contact</h4>
                <div class="flex-between gap-4" style="display: flex; gap: 12px;">
                    <div class="form-group" style="flex: 1;">
                        <input type="text" id="drvEmergName" class="form-control" placeholder="Name" value="${d.emergencyContactName || ''}">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="text" id="drvEmergPhone" class="form-control" placeholder="Phone" value="${d.emergencyContactPhone || ''}">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="text" id="drvEmergRel" class="form-control" placeholder="Relation" value="${d.emergencyContactRelation || ''}">
                    </div>
                </div>
            </div>
        </div>

        <div id="tabEmployment" class="tab-content">
            <div class="flex-between gap-4" style="display: flex; gap: 12px;">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label" for="drvCode">Employee Code *</label>
                    <input type="text" id="drvCode" class="form-control" value="${d.employeeCode}" required ${isEdit ? 'readonly style="opacity:0.7"' : ''}>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label" for="drvHireDate">Hire Date *</label>
                    <input type="date" id="drvHireDate" class="form-control" value="${formatDate(d.hireDate)}" required>
                </div>
            </div>

            <div class="flex-between gap-4" style="display: flex; gap: 12px;">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Depot *</label>
                    <select id="drvDepot" class="form-control" required>
                        <option value="">Select Depot</option>
                        ${allDepots.map(dp => `<option value="${dp.name}" ${d.depotName === dp.name ? 'selected' : ''}>${dp.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Shift *</label>
                    <select id="drvShift" class="form-control" required>
                        <option value="MORNING" ${d.shift === 'MORNING' ? 'selected' : ''}>Morning</option>
                        <option value="AFTERNOON" ${d.shift === 'AFTERNOON' ? 'selected' : ''}>Afternoon</option>
                        <option value="NIGHT" ${d.shift === 'NIGHT' ? 'selected' : ''}>Night</option>
                        <option value="ROTATING" ${d.shift === 'ROTATING' ? 'selected' : ''}>Rotating</option>
                    </select>
                </div>
            </div>

            <div class="flex-between gap-4" style="display: flex; gap: 12px;">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Contract Type</label>
                    <select id="drvContract" class="form-control">
                        <option value="FULL_TIME" ${d.contractType === 'FULL_TIME' ? 'selected' : ''}>Full-Time</option>
                        <option value="PART_TIME" ${d.contractType === 'PART_TIME' ? 'selected' : ''}>Part-Time</option>
                        <option value="CONTRACT" ${d.contractType === 'CONTRACT' ? 'selected' : ''}>Contract</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Status</label>
                    <select id="drvStatus" class="form-control">
                        <option value="ACTIVE" ${d.status === 'ACTIVE' ? 'selected' : ''}>Active</option>
                        <option value="ON_LEAVE" ${d.status === 'ON_LEAVE' ? 'selected' : ''}>On Leave</option>
                        <option value="SUSPENDED" ${d.status === 'SUSPENDED' ? 'selected' : ''}>Suspended</option>
                    </select>
                </div>
            </div>

            <div style="border-top: 1px solid var(--color-border); margin: 20px 0; padding-top: 20px;">
                <h4 style="margin-bottom: 12px; font-size: 13px; color: var(--color-text-muted);">License Details *</h4>
                <div class="flex-between gap-4" style="display: flex; gap: 12px;">
                    <div class="form-group" style="flex: 2;">
                        <input type="text" id="drvLicNum" class="form-control" placeholder="License Number" value="${d.licenseNumber}" required>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="date" id="drvLicExp" class="form-control" value="${formatDate(d.licenseExpiry)}" required>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <select id="drvLicType" class="form-control" required>
                            <option value="CLASS_A" ${d.licenseType === 'CLASS_A' ? 'selected' : ''}>Class A</option>
                            <option value="CLASS_B" ${d.licenseType === 'CLASS_B' ? 'selected' : ''}>Class B</option>
                            <option value="CLASS_C" ${d.licenseType === 'CLASS_C' ? 'selected' : ''}>Class C</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="drvNotes">Notes</label>
                <textarea id="drvNotes" class="form-control" rows="2">${d.notes || ''}</textarea>
            </div>
        </div>
    `;

    renderModal(title, formHTML, async (form, closeModal) => {
        const data = {
            fullName: document.getElementById('drvName').value,
            fullNameKurdish: document.getElementById('drvNameKurdish').value,
            employeeCode: document.getElementById('drvCode').value,
            phoneNumber: document.getElementById('drvPhone').value,
            phoneNumberAlt: document.getElementById('drvPhoneAlt').value || undefined,
            email: document.getElementById('drvEmail').value || undefined,
            address: document.getElementById('drvAddress').value || undefined,
            emergencyContactName: document.getElementById('drvEmergName').value || undefined,
            emergencyContactPhone: document.getElementById('drvEmergPhone').value || undefined,
            emergencyContactRelation: document.getElementById('drvEmergRel').value || undefined,
            depotName: document.getElementById('drvDepot').value,
            shift: document.getElementById('drvShift').value,
            contractType: document.getElementById('drvContract').value,
            status: document.getElementById('drvStatus').value,
            hireDate: document.getElementById('drvHireDate').value,
            licenseNumber: document.getElementById('drvLicNum').value,
            licenseExpiry: document.getElementById('drvLicExp').value,
            licenseType: document.getElementById('drvLicType').value,
            notes: document.getElementById('drvNotes').value || undefined,
        };

        try {
            const btn = document.getElementById('modalSaveBtn');
            const originalText = btn.innerText;
            btn.innerHTML = '<span class="material-icons spin">refresh</span>';
            btn.disabled = true;

            const drvId = document.getElementById('drvId').value;
            if (drvId) {
                await api.drivers.update(drvId, data);
            } else {
                await api.drivers.create(data);
            }
            closeModal();
            loadDrivers();
            loadStats();
        } catch (err) {
            showToast(err.error || 'Failed to save driver', 'error');
            const btn = document.getElementById('modalSaveBtn');
            btn.innerHTML = 'Save';
            btn.disabled = false;
        }
    });
}
