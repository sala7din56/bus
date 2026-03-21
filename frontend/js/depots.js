import { api } from './api.js';
import { renderStatusPill, renderModal, showToast, initGlobalUI } from './shared.js';
import './auth.js';

// ─── State ───────────────────────────────────────────────────────
let allDepots = [];
let allBuses = [];
let allRoutes = [];
let selectedDepotId = null;
let selectedBusId = null;

// ─── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initGlobalUI();

    document.getElementById('addDepotBtn').addEventListener('click', () => openDepotModal());
    document.getElementById('depotSearchInput').addEventListener('input', (e) => renderDepotList(filterDepots(e.target.value)));

    document.getElementById('editDepotBtn').addEventListener('click', () => {
        const depot = allDepots.find(d => d.id === selectedDepotId);
        if (depot) openDepotModal(depot);
    });

    document.getElementById('deleteDepotBtn').addEventListener('click', () => {
        if (!selectedDepotId) return;
        const depot = allDepots.find(d => d.id === selectedDepotId);
        if (confirm(`Delete depot "${depot?.name}"? All buses will be unassigned.`)) deleteDepot(selectedDepotId);
    });

    document.getElementById('addBusToDepotBtn').addEventListener('click', () => {
        if (!selectedDepotId) return;
        const unassignedBuses = allBuses.filter(b => !b.depotId || b.depotId !== selectedDepotId);
        openAssignBusModal(unassignedBuses);
    });

    document.getElementById('closeBusDetail').addEventListener('click', closeBusDetail);

    document.getElementById('editBusFromDepotBtn').addEventListener('click', () => {
        const bus = allBuses.find(b => b.id === selectedBusId);
        if (bus) openBusEditModal(bus);
    });

    document.getElementById('unassignBusBtn').addEventListener('click', () => {
        if (!selectedBusId) return;
        if (confirm('Remove this bus from the depot?')) unassignBus(selectedBusId);
    });

    await loadAll();
});

// ─── Data loading ─────────────────────────────────────────────────
async function loadAll() {
    try {
        [allDepots, allBuses, allRoutes] = await Promise.all([
            api.depots.list(),
            api.buses.list(),
            api.routes.list()
        ]);
        renderDepotList(allDepots);
        updateDepotCount(allDepots.length);

        // Re-select and refresh if we had a selection
        if (selectedDepotId) {
            const still = allDepots.find(d => d.id === selectedDepotId);
            if (still) selectDepot(selectedDepotId);
        }
    } catch (err) {
        console.error('Load failed:', err);
        showToast('Failed to load depots', 'error');
        document.getElementById('depotListBody').innerHTML = `<div style="padding:32px;text-align:center;color:var(--color-text-muted);">Failed to load. Check server.</div>`;
    }
}

// ─── Filter ───────────────────────────────────────────────────────
function filterDepots(q) {
    if (!q) return allDepots;
    const lq = q.toLowerCase();
    return allDepots.filter(d =>
        d.name.toLowerCase().includes(lq) ||
        (d.address || '').toLowerCase().includes(lq) ||
        (d.manager || '').toLowerCase().includes(lq)
    );
}

// ─── Depot list render ────────────────────────────────────────────
function renderDepotList(depots) {
    const container = document.getElementById('depotListBody');

    if (!depots.length) {
        container.innerHTML = `
            <div style="padding: 48px 24px; text-align: center; color: var(--color-text-muted);">
                <span class="material-icons" style="font-size: 48px; opacity: 0.3;">garage</span>
                <p style="margin-top: 12px; font-size: 14px;">No depots found</p>
                <button class="btn btn-primary" style="margin-top: 16px;" onclick="document.getElementById('addDepotBtn').click()">
                    <span class="material-icons">add</span> Add First Depot
                </button>
            </div>`;
        return;
    }

    container.innerHTML = depots.map(depot => {
        const busesHere = allBuses.filter(b => b.depotId === depot.id);
        const isSelected = depot.id === selectedDepotId;
        const capacityPct = depot.capacity > 0 ? Math.round((busesHere.length / depot.capacity) * 100) : 0;
        const barColor = capacityPct >= 90 ? 'var(--color-red)' : capacityPct >= 70 ? '#FF9800' : 'var(--color-green)';

        return `
        <div class="depot-card ${isSelected ? 'selected' : ''}"
             data-id="${depot.id}"
             onclick="window._selectDepot('${depot.id}')"
             style="${isSelected ? `border-left-color: ${depot.colorHex}` : ''}">
            <div class="depot-card-top">
                <div class="depot-dot" style="background: ${depot.colorHex};"></div>
                <div class="depot-name">${depot.name}</div>
                <span class="status-pill status-${depot.status || 'ACTIVE'}" style="font-size: 11px; padding: 2px 8px; margin-left: auto; flex-shrink: 0;">${depot.status || 'ACTIVE'}</span>
            </div>
            <div class="depot-meta">
                <span><span class="material-icons">directions_bus</span>${busesHere.length} bus${busesHere.length === 1 ? '' : 'es'}</span>
                ${depot.capacity ? `<span><span class="material-icons">inventory_2</span>Cap. ${depot.capacity}</span>` : ''}
                ${depot.manager ? `<span><span class="material-icons">person</span>${depot.manager}</span>` : ''}
            </div>
            ${depot.capacity > 0 ? `
            <div style="margin-top: 8px;">
                <div style="height: 3px; background: var(--color-border); border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; width: ${Math.min(capacityPct, 100)}%; background: ${barColor}; border-radius: 2px; transition: width 0.4s;"></div>
                </div>
            </div>` : ''}
        </div>`;
    }).join('');

    // Re-attach click handler through global (needed for inline onclick in innerHTML)
    window._selectDepot = (id) => selectDepot(id);
}

function updateDepotCount(n) {
    document.getElementById('depotCount').textContent = n;
}

// ─── Select depot ─────────────────────────────────────────────────
function selectDepot(depotId) {
    selectedDepotId = depotId;
    selectedBusId = null;
    closeBusDetail();

    // Update cards
    document.querySelectorAll('.depot-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.id === depotId);
    });

    const depot = allDepots.find(d => d.id === depotId);
    if (!depot) return;

    // Show detail view
    document.getElementById('depotEmptyState').style.display = 'none';
    const view = document.getElementById('depotDetailView');
    view.style.display = 'flex';

    // Header
    document.getElementById('depotColorBadge').style.background = depot.colorHex;
    document.getElementById('depotDetailName').textContent = depot.name;
    document.getElementById('depotDetailAddress').textContent = depot.address || (depot.nameKurdish ? `${depot.nameKurdish}` : 'No address specified');

    // Info strip
    const busesHere = allBuses.filter(b => b.depotId === depotId);
    document.getElementById('infoParked').textContent = busesHere.length;
    document.getElementById('infoCapacity').textContent = depot.capacity || '—';
    document.getElementById('infoHours').textContent =
        (depot.openTime && depot.closeTime) ? `${depot.openTime} – ${depot.closeTime}` : '24/7';
    document.getElementById('infoManager').textContent = depot.manager || '—';
    const statusBadge = document.getElementById('infoStatus');
    statusBadge.innerHTML = renderStatusPill(depot.status || 'ACTIVE');

    // Render bus list
    renderBusList(busesHere);
}

// ─── Bus list render ──────────────────────────────────────────────
function renderBusList(buses) {
    const container = document.getElementById('depotBusesList');
    document.getElementById('busesCountBadge').textContent = buses.length;

    if (!buses.length) {
        container.innerHTML = `
            <div style="padding: 48px 24px; text-align: center; color: var(--color-text-muted);">
                <span class="material-icons" style="font-size: 40px; opacity: 0.3;">directions_bus</span>
                <p style="margin-top: 12px; font-size: 14px;">No buses assigned to this depot</p>
                <button class="btn btn-ghost" style="margin-top: 12px; font-size: 13px;" onclick="document.getElementById('addBusToDepotBtn').click()">
                    <span class="material-icons" style="font-size: 15px;">add</span> Assign a Bus
                </button>
            </div>`;
        return;
    }

    container.innerHTML = buses.map(bus => {
        const route = bus.route || allRoutes.find(r => r.id === bus.routeId);
        const isSelected = bus.id === selectedBusId;

        return `
        <div class="depot-bus-row ${isSelected ? 'selected' : ''}"
             data-bus-id="${bus.id}"
             onclick="window._selectBus('${bus.id}')">
            <span class="bus-id-chip">${bus.id.slice(-6).toUpperCase()}</span>
            <div class="bus-row-info">
                ${route ? `
                    <div class="bus-row-route">
                        <span class="color-dot-sm" style="display:inline-block; vertical-align: middle; background: ${route.colorHex};"></span>
                        &nbsp;${route.name}
                    </div>
                ` : `<div class="bus-row-route" style="color: var(--color-text-muted);">No route assigned</div>`}
                <div class="bus-row-meta">${bus.latitude.toFixed(4)}°N, ${bus.longitude.toFixed(4)}°E &nbsp;·&nbsp; ${timeSince(bus.lastUpdated)}</div>
            </div>
            <div class="bus-row-status">${renderStatusPill(bus.status)}</div>
        </div>`;
    }).join('');

    window._selectBus = (id) => selectBus(id);
}

// ─── Select bus → open detail panel ──────────────────────────────
function selectBus(busId) {
    if (selectedBusId === busId) {
        closeBusDetail();
        return;
    }
    selectedBusId = busId;

    // Highlight row
    document.querySelectorAll('.depot-bus-row').forEach(r => {
        r.classList.toggle('selected', r.dataset.busId === busId);
    });

    const bus = allBuses.find(b => b.id === busId);
    if (!bus) return;

    const route = bus.route || allRoutes.find(r => r.id === bus.routeId);

    // Fill panel
    document.getElementById('busDetailId').textContent = busId.slice(-6).toUpperCase();
    document.getElementById('busDetailGrid').innerHTML = `
        <div class="bus-detail-field">
            <div class="bus-detail-field-label">Full ID</div>
            <div class="bus-detail-field-value" style="font-family: monospace; font-size: 12px;">${bus.id}</div>
        </div>
        <div class="bus-detail-field">
            <div class="bus-detail-field-label">Status</div>
            <div class="bus-detail-field-value">${renderStatusPill(bus.status)}</div>
        </div>
        <div class="bus-detail-field">
            <div class="bus-detail-field-label">Route</div>
            <div class="bus-detail-field-value">
                ${route ? `<span class="bus-route-indicator">
                    <span class="color-dot-sm" style="background: ${route.colorHex};"></span>
                    ${route.name}
                </span>` : '<span style="color:var(--color-text-muted)">No route</span>'}
            </div>
        </div>
        <div class="bus-detail-field">
            <div class="bus-detail-field-label">Position</div>
            <div class="bus-detail-field-value" style="font-family: monospace; font-size: 12px;">${bus.latitude.toFixed(5)}°N<br>${bus.longitude.toFixed(5)}°E</div>
        </div>
        <div class="bus-detail-field">
            <div class="bus-detail-field-label">Next Stop</div>
            <div class="bus-detail-field-value">${bus.nextStopName || '—'}</div>
        </div>
        <div class="bus-detail-field">
            <div class="bus-detail-field-label">Last Updated</div>
            <div class="bus-detail-field-value">${timeSince(bus.lastUpdated)}</div>
        </div>
    `;

    const panel = document.getElementById('busDetailPanel');
    panel.classList.add('open');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeBusDetail() {
    selectedBusId = null;
    document.querySelectorAll('.depot-bus-row').forEach(r => r.classList.remove('selected'));
    document.getElementById('busDetailPanel').classList.remove('open');
}

// ─── CRUD - Depots ────────────────────────────────────────────────
function openDepotModal(depot = null) {
    const isEdit = !!depot;
    const d = depot || { name: '', nameKurdish: '', capacity: 20, status: 'ACTIVE', manager: '', phone: '', address: '', openTime: '06:00', closeTime: '22:00', colorHex: '#00BCD4' };

    const formHTML = `
        <input type="hidden" id="depotId" value="${d.id || ''}">

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label class="form-label">Depot Name (EN) *</label>
                <input type="text" id="depotName" class="form-control" value="${d.name}" placeholder="Central Depot" required>
            </div>
            <div class="form-group">
                <label class="form-label">Depot Name (KU)</label>
                <input type="text" id="depotNameKu" class="form-control" value="${d.nameKurdish || ''}" placeholder="کەرگەی ناوەند" dir="rtl">
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Address / Location</label>
            <input type="text" id="depotAddress" class="form-control" value="${d.address || ''}" placeholder="Gulan Street, Erbil">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label class="form-label">Capacity (buses)</label>
                <input type="number" id="depotCapacity" class="form-control" value="${d.capacity || 0}" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">Open Time</label>
                <input type="time" id="depotOpenTime" class="form-control" value="${d.openTime || '06:00'}">
            </div>
            <div class="form-group">
                <label class="form-label">Close Time</label>
                <input type="time" id="depotCloseTime" class="form-control" value="${d.closeTime || '22:00'}">
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label class="form-label">Manager Name</label>
                <input type="text" id="depotManager" class="form-control" value="${d.manager || ''}" placeholder="e.g. Kawa Ahmad">
            </div>
            <div class="form-group">
                <label class="form-label">Phone</label>
                <input type="text" id="depotPhone" class="form-control" value="${d.phone || ''}" placeholder="+964 750 ...">
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label class="form-label">Status</label>
                <select id="depotStatus" class="form-control">
                    <option value="ACTIVE" ${(d.status||'ACTIVE') === 'ACTIVE' ? 'selected' : ''}>Active</option>
                    <option value="MAINTENANCE" ${d.status === 'MAINTENANCE' ? 'selected' : ''}>Maintenance</option>
                    <option value="CLOSED" ${d.status === 'CLOSED' ? 'selected' : ''}>Closed</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Color</label>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="color" id="depotColorPicker" value="${d.colorHex || '#00BCD4'}" style="width: 44px; height: 36px; border: none; border-radius: 8px; cursor: pointer; padding: 0;">
                    <input type="text" id="depotColorHex" class="form-control" value="${d.colorHex || '#00BCD4'}" placeholder="#00BCD4" maxlength="7">
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label class="form-label">Latitude</label>
                <input type="number" id="depotLat" class="form-control" value="${d.lat || 36.1901}" step="0.000001">
            </div>
            <div class="form-group">
                <label class="form-label">Longitude</label>
                <input type="number" id="depotLng" class="form-control" value="${d.lng || 44.0089}" step="0.000001">
            </div>
        </div>
    `;

    renderModal(isEdit ? 'Edit Depot' : 'Add New Depot', formHTML, async (form, closeModal) => {
        const name = document.getElementById('depotName').value.trim();
        if (!name) { showToast('Depot name is required', 'error'); return; }

        const colorPicker = document.getElementById('depotColorPicker').value;
        const colorHex = document.getElementById('depotColorHex').value.trim() || colorPicker;

        const data = {
            name,
            nameKurdish: document.getElementById('depotNameKu').value.trim(),
            address: document.getElementById('depotAddress').value.trim(),
            addressKurdish: '',
            capacity: parseInt(document.getElementById('depotCapacity').value) || 0,
            openTime: document.getElementById('depotOpenTime').value,
            closeTime: document.getElementById('depotCloseTime').value,
            manager: document.getElementById('depotManager').value.trim(),
            phone: document.getElementById('depotPhone').value.trim(),
            status: document.getElementById('depotStatus').value,
            colorHex,
            lat: parseFloat(document.getElementById('depotLat').value) || 36.1901,
            lng: parseFloat(document.getElementById('depotLng').value) || 44.0089
        };

        try {
            const btn = document.getElementById('modalSaveBtn');
            btn.innerHTML = '<span class="material-icons spin">refresh</span>';
            btn.disabled = true;

            const depotId = document.getElementById('depotId').value;
            if (depotId) {
                await api.depots.update(depotId, data);
                showToast('Depot updated');
            } else {
                await api.depots.create(data);
                showToast('Depot created');
            }
            closeModal();
            await loadAll();
        } catch (err) {
            showToast(err.error || 'Failed to save depot', 'error');
            const btn = document.getElementById('modalSaveBtn');
            btn.innerHTML = 'Save';
            btn.disabled = false;
        }
    });

    // Sync color picker ↔ hex input
    setTimeout(() => {
        const picker = document.getElementById('depotColorPicker');
        const hex = document.getElementById('depotColorHex');
        if (picker && hex) {
            picker.addEventListener('input', () => { hex.value = picker.value; });
            hex.addEventListener('input', () => {
                if (/^#[0-9A-Fa-f]{6}$/.test(hex.value)) picker.value = hex.value;
            });
        }
    }, 50);
}

async function deleteDepot(id) {
    try {
        await api.depots.delete(id);
        showToast('Depot deleted');
        selectedDepotId = null;
        document.getElementById('depotEmptyState').style.display = 'flex';
        document.getElementById('depotDetailView').style.display = 'none';
        await loadAll();
    } catch (err) {
        showToast(err.error || 'Failed to delete depot', 'error');
    }
}

// ─── CRUD - Assign / Edit Bus from Depot ─────────────────────────
function openAssignBusModal(unassignedBuses) {
    if (!unassignedBuses.length) {
        showToast('All buses are already assigned to this depot or fully assigned', 'error');
        return;
    }

    const busOptions = unassignedBuses.map(b => {
        const route = b.route || allRoutes.find(r => r.id === b.routeId);
        const routeLabel = route ? route.name : 'No route';
        return `<option value="${b.id}">[${b.id.slice(-6).toUpperCase()}] ${routeLabel}</option>`;
    }).join('');

    const formHTML = `
        <div class="form-group">
            <label class="form-label">Select Bus to Assign *</label>
            <select id="assignBusSelect" class="form-control" size="8" style="height: auto;">
                ${busOptions}
            </select>
        </div>
        <p style="font-size: 12px; color: var(--color-text-muted); margin-top: 8px;">
            ${unassignedBuses.length} bus${unassignedBuses.length !== 1 ? 'es' : ''} available. Buses already assigned to this depot are excluded.
        </p>
    `;

    renderModal('Assign Bus to Depot', formHTML, async (form, closeModal) => {
        const busId = document.getElementById('assignBusSelect').value;
        if (!busId) { showToast('Please select a bus', 'error'); return; }

        try {
            await api.buses.update(busId, { depotId: selectedDepotId });
            showToast('Bus assigned to depot');
            closeModal();
            await loadAll();
            if (selectedDepotId) selectDepot(selectedDepotId);
        } catch (err) {
            showToast(err.error || 'Failed to assign bus', 'error');
        }
    });
}

function openBusEditModal(bus) {
    const routeOptions = allRoutes.map(r =>
        `<option value="${r.id}" ${bus.routeId === r.id ? 'selected' : ''}>${r.name}</option>`
    ).join('');

    const formHTML = `
        <input type="hidden" id="editBusId" value="${bus.id}">

        <div class="form-group">
            <label class="form-label">Bus ID</label>
            <input type="text" class="form-control" value="${bus.id.slice(-6).toUpperCase()} (${bus.id})" disabled>
        </div>

        <div class="form-group">
            <label class="form-label">Assigned Route</label>
            <select id="editBusRoute" class="form-control">
                <option value="">— No Route —</option>
                ${routeOptions}
            </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label class="form-label">Latitude</label>
                <input type="number" id="editBusLat" class="form-control" value="${bus.latitude}" step="0.000001">
            </div>
            <div class="form-group">
                <label class="form-label">Longitude</label>
                <input type="number" id="editBusLng" class="form-control" value="${bus.longitude}" step="0.000001">
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Status</label>
            <select id="editBusStatus" class="form-control">
                <option value="RUNNING" ${bus.status === 'RUNNING' ? 'selected' : ''}>Running</option>
                <option value="DELAYED" ${bus.status === 'DELAYED' ? 'selected' : ''}>Delayed</option>
                <option value="OUT_OF_SERVICE" ${bus.status === 'OUT_OF_SERVICE' ? 'selected' : ''}>Out of Service</option>
            </select>
        </div>

        <div class="form-group">
            <label class="form-label">Next Stop</label>
            <input type="text" id="editBusNextStop" class="form-control" value="${bus.nextStopName || ''}" placeholder="e.g. Gulan Street">
        </div>
    `;

    renderModal('Edit Bus', formHTML, async (form, closeModal) => {
        const data = {
            routeId: document.getElementById('editBusRoute').value || null,
            latitude: parseFloat(document.getElementById('editBusLat').value) || bus.latitude,
            longitude: parseFloat(document.getElementById('editBusLng').value) || bus.longitude,
            status: document.getElementById('editBusStatus').value,
            nextStopName: document.getElementById('editBusNextStop').value.trim() || null
        };

        try {
            await api.buses.update(bus.id, data);
            showToast('Bus updated');
            closeModal();
            await loadAll();
            if (selectedDepotId) {
                selectDepot(selectedDepotId);
                if (selectedBusId) selectBus(selectedBusId);
            }
        } catch (err) {
            showToast(err.error || 'Failed to update bus', 'error');
        }
    });
}

async function unassignBus(busId) {
    try {
        await api.buses.update(busId, { depotId: null });
        showToast('Bus removed from depot');
        closeBusDetail();
        await loadAll();
        if (selectedDepotId) selectDepot(selectedDepotId);
    } catch (err) {
        showToast(err.error || 'Failed to unassign bus', 'error');
    }
}

// ─── Helpers ──────────────────────────────────────────────────────
function timeSince(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
