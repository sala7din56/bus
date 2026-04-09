import { api } from './api.js';
import { renderStatusPill, renderModal, renderDataTable, showToast, initGlobalUI } from './shared.js';
import './auth.js';

let allBuses = [];
let allRoutes = [];
let refreshInterval = null;

// ── Multi-select helpers ──────────────────────────────────────
window.updateMultiSelectLabel = () => {
    const checked = [...document.querySelectorAll('.stop-checkbox:checked')].map(cb => cb.value);
    const label = document.getElementById('multiSelectLabel');
    if (!label) return;
    if (checked.length === 0) {
        label.innerHTML = '<span style="color:var(--color-text-muted)">Select stops on this route…</span>';
    } else {
        label.innerHTML = checked.map(n =>
            `<span class="ms-chip">${n}<span class="material-icons ms-chip-x" onclick="event.stopPropagation(); window.uncheckStop('${n.replace(/'/g, "\\'")}')">close</span></span>`
        ).join('');
    }
};

window.uncheckStop = (name) => {
    const cb = document.querySelector(`.stop-checkbox[value="${name}"]`);
    if (cb) { cb.checked = false; window.updateMultiSelectLabel(); }
};

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const dd = document.getElementById('busNextStopDropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
});

// Search inside dropdown
document.addEventListener('input', (e) => {
    if (e.target.id === 'stopSearchInput') {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#busNextStopDropdown .ms-option').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
        });
    }
});

// ── Page init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    loadDependencies().then(loadBuses);

    document.getElementById('addBusBtn').addEventListener('click', () => openBusModal());
    document.getElementById('searchInput').addEventListener('input', (e) => filterBuses(e.target.value));

    refreshInterval = setInterval(() => {
        const indicator = document.getElementById('refreshIndicator');
        if (indicator) {
            indicator.style.opacity = '1';
            indicator.classList.add('spin');
            api.buses.list().then(buses => {
                allBuses = buses;
                filterBuses(document.getElementById('searchInput').value);
                setTimeout(() => { indicator.classList.remove('spin'); indicator.style.opacity = '0'; }, 500);
            }).catch(e => console.error('Silent refresh failed', e));
        }
    }, 30000);
});

async function loadDependencies() {
    try {
        const [routes, stops, depots] = await Promise.all([
            api.routes.list(),
            api.stops.list(),
            api.depots.list()
        ]);
        allRoutes = routes;
        window.allStops = stops;
        window.allDepots = depots;
    } catch (err) {
        console.error('Failed to load dependencies', err);
    }
}

async function loadBuses() {
    try {
        allBuses = await api.buses.list();
        renderTable(allBuses);
    } catch (err) {
        showToast('Failed to load buses', 'error');
    }
}

function filterBuses(query) {
    if (!query) return renderTable(allBuses);
    const q = query.toLowerCase();
    const filtered = allBuses.filter(b => {
        const routeName = b.route ? b.route.name.toLowerCase() : '';
        return b.id.toLowerCase().includes(q) || routeName.includes(q) || (b.nextStopName || '').toLowerCase().includes(q);
    });
    renderTable(filtered);
}

function timeSince(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " min ago";
    return "just now";
}

// ── Table ─────────────────────────────────────────────────────
function renderTable(buses) {
    const container = document.getElementById('busesTableContainer');
    const columns = ['Bus ID', 'Route', 'Depot', 'Position', 'Status', 'Next Stops', 'Last Updated', 'Actions'];

    window.editBus = (id) => { const bus = allBuses.find(b => b.id === id); if (bus) openBusModal(bus); };
    window.promptDeleteBus = (id) => { if (confirm('Delete this bus?')) executeDeleteBus(id); };
    window.executeDeleteBus = async (id) => {
        try { await api.buses.delete(id); showToast('Bus deleted'); loadBuses(); }
        catch { showToast('Failed to delete bus', 'error'); }
    };

    const rowsHTML = buses.map(b => {
        const routeDisplay = b.route
            ? `<div style="display:flex;align-items:center;gap:8px"><span class="color-swatch" style="width:12px;height:12px;background:${b.route.colorHex}"></span>${b.route.name}</div>`
            : '<span style="color:var(--color-text-muted)">Unassigned</span>';

        const depot = (window.allDepots || []).find(dp => dp.id === b.depotId);
        const depotDisplay = depot
            ? `<span style="font-size:13px;font-weight:500"><span class="material-icons" style="font-size:14px;vertical-align:middle;color:${depot.colorHex || 'var(--color-primary)'}">garage</span> ${depot.name}</span>`
            : '<span style="color:var(--color-text-muted)">—</span>';

        const stopsHTML = b.nextStopName
            ? b.nextStopName.split(',').map(s => `<span class="stop-chip">${s.trim()}</span>`).join('')
            : '<span style="color:var(--color-text-muted)">—</span>';

        return `
        <tr>
            <td style="font-family:monospace;font-weight:600;color:var(--color-text-muted)">${b.id.substring(b.id.length - 6).toUpperCase()}</td>
            <td style="font-weight:600">${routeDisplay}</td>
            <td>${depotDisplay}</td>
            <td style="font-family:monospace;color:var(--color-text-muted);font-size:13px">${b.latitude.toFixed(4)}°N, ${b.longitude.toFixed(4)}°E</td>
            <td>${renderStatusPill(b.status)}</td>
            <td><div class="stop-chips-cell">${stopsHTML}</div></td>
            <td style="color:var(--color-text-muted);font-size:13px">${timeSince(b.lastUpdated)}</td>
            <td class="actions">
                <button class="action-btn edit" onclick="editBus('${b.id}')"><span class="material-icons">edit</span></button>
                <button class="action-btn delete" onclick="promptDeleteBus('${b.id}')"><span class="material-icons">delete</span></button>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = renderDataTable(columns, rowsHTML);
}

// ── Helpers: get stops for a given route ──────────────────────
function getStopsForRoute(routeId) {
    const route = allRoutes.find(r => r.id === routeId);
    if (!route) return [];

    // Prefer routeStops (ordered junction table), fall back to schedules
    if (route.routeStops && route.routeStops.length > 0) {
        return route.routeStops.map(rs => rs.stop);
    }
    if (route.schedules && route.schedules.length > 0) {
        const seen = new Set();
        return route.schedules.filter(s => s.stop && !seen.has(s.stop.id) && seen.add(s.stop.id)).map(s => s.stop);
    }
    return [];
}

function buildStopCheckboxes(stops, selectedStops) {
    if (!stops.length) {
        return `<div class="ms-empty">
            <span class="material-icons" style="font-size:32px;color:var(--color-text-muted);opacity:.5">wrong_location</span>
            <span>No stops assigned to this route</span>
        </div>`;
    }
    return stops.map(s => {
        const checked = selectedStops.includes(s.name) ? 'checked' : '';
        return `<label class="ms-option">
            <input type="checkbox" class="stop-checkbox" value="${s.name}" ${checked} onchange="window.updateMultiSelectLabel()">
            <span class="ms-option-name">${s.name}</span>
            ${s.nameKurdish ? `<span class="ms-option-sub">${s.nameKurdish}</span>` : ''}
        </label>`;
    }).join('');
}

// ── Modal ─────────────────────────────────────────────────────
function openBusModal(bus = null) {
    const isEdit = !!bus;
    const title = isEdit ? 'Edit Bus' : 'Add New Bus';
    const d = bus || { routeId: '', depotId: '', latitude: 36.1910, longitude: 44.0085, status: 'RUNNING', nextStopName: '' };
    const selectedStops = d.nextStopName ? d.nextStopName.split(',').map(s => s.trim()).filter(Boolean) : [];

    const routeOptions = allRoutes.map(r => {
        const color = r.colorHex || '#1877F2';
        return `<option value="${r.id}" ${d.routeId === r.id ? 'selected' : ''} data-color="${color}">${r.name}</option>`;
    }).join('');

    const depotOptions = (window.allDepots || []).map(dp =>
        `<option value="${dp.id}" ${d.depotId === dp.id ? 'selected' : ''}>${dp.name}</option>`
    ).join('');

    // Initial stops list based on currently-selected route
    const initialStops = d.routeId ? getStopsForRoute(d.routeId) : [];
    const initialCheckboxes = buildStopCheckboxes(initialStops, selectedStops);

    const formHTML = `
        <input type="hidden" id="busId" value="${d.id || ''}">

        <!-- Row 1: Route + Depot -->
        <div class="modal-row">
            <div class="form-group" style="flex:1">
                <label class="form-label"><span class="material-icons form-icon">route</span> Route</label>
                <select id="busRouteId" class="form-control" required>
                    <option value="">-- Select Route --</option>
                    ${routeOptions}
                </select>
            </div>
            <div class="form-group" style="flex:1">
                <label class="form-label"><span class="material-icons form-icon">garage</span> Depot</label>
                <select id="busDepotId" class="form-control">
                    <option value="">-- No Depot --</option>
                    ${depotOptions}
                </select>
            </div>
        </div>

        <!-- Row 2: Lat / Lng / Status -->
        <div class="modal-row" style="gap:10px">
            <div class="form-group" style="flex:1">
                <label class="form-label"><span class="material-icons form-icon">my_location</span> Latitude</label>
                <input type="number" id="busLat" class="form-control" value="${d.latitude}" step="0.000001" required>
            </div>
            <div class="form-group" style="flex:1">
                <label class="form-label"><span class="material-icons form-icon">my_location</span> Longitude</label>
                <input type="number" id="busLng" class="form-control" value="${d.longitude}" step="0.000001" required>
            </div>
            <div class="form-group" style="flex:1">
                <label class="form-label"><span class="material-icons form-icon">traffic</span> Status</label>
                <select id="busStatus" class="form-control">
                    <option value="RUNNING" ${d.status === 'RUNNING' ? 'selected' : ''}>Running</option>
                    <option value="DELAYED" ${d.status === 'DELAYED' ? 'selected' : ''}>Delayed</option>
                    <option value="OUT_OF_SERVICE" ${d.status === 'OUT_OF_SERVICE' ? 'selected' : ''}>Out of Service</option>
                </select>
            </div>
        </div>

        <!-- Row 3: Next Stops multi-select -->
        <div class="form-group">
            <label class="form-label"><span class="material-icons form-icon">pin_drop</span> Next Stops</label>
            <div id="busNextStopDropdown" class="multi-select-dropdown">
                <div class="ms-trigger form-control" onclick="document.getElementById('busNextStopDropdown').classList.toggle('open')">
                    <div id="multiSelectLabel" class="ms-label"><span style="color:var(--color-text-muted)">Select stops on this route…</span></div>
                    <span class="material-icons ms-arrow">expand_more</span>
                </div>
                <div class="ms-panel">
                    <div class="ms-search-wrap">
                        <span class="material-icons" style="font-size:16px;color:var(--color-text-muted)">search</span>
                        <input type="text" id="stopSearchInput" placeholder="Search stops…" class="ms-search">
                    </div>
                    <div id="stopCheckboxList" class="ms-list">
                        ${initialCheckboxes}
                    </div>
                    <div class="ms-footer">
                        <span id="stopCount" class="ms-count">${initialStops.length} stops</span>
                        <button type="button" class="ms-clear-btn" onclick="document.querySelectorAll('.stop-checkbox:checked').forEach(c=>c.checked=false); window.updateMultiSelectLabel();">Clear all</button>
                    </div>
                </div>
            </div>
            <div id="noRouteHint" class="ms-hint" style="display:${d.routeId ? 'none' : 'flex'}">
                <span class="material-icons" style="font-size:16px">info</span>
                Pick a route first to see its stops
            </div>
        </div>
    `;

    renderModal(title, formHTML, async (form, closeModal) => {
        const checked = [...document.querySelectorAll('.stop-checkbox:checked')].map(cb => cb.value);
        const data = {
            routeId: document.getElementById('busRouteId').value,
            depotId: document.getElementById('busDepotId').value || null,
            latitude: parseFloat(document.getElementById('busLat').value),
            longitude: parseFloat(document.getElementById('busLng').value),
            status: document.getElementById('busStatus').value,
            nextStopName: checked.length ? checked.join(', ') : null
        };

        if (!data.routeId) { showToast('Please select a route', 'error'); return; }

        try {
            const btn = document.getElementById('modalSaveBtn');
            const originalText = btn.innerText;
            btn.innerHTML = '<span class="material-icons spin">refresh</span>';
            btn.disabled = true;

            const busId = document.getElementById('busId').value;
            if (busId) { await api.buses.update(busId, data); showToast('Bus updated'); }
            else { await api.buses.create(data); showToast('Bus created'); }
            closeModal();
            loadBuses();
        } catch (err) {
            showToast('Failed to save bus', 'error');
            const btn = document.getElementById('modalSaveBtn');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // Update label for pre-selected stops (edit mode)
    window.updateMultiSelectLabel();

    // When route changes, rebuild stop checkboxes
    document.getElementById('busRouteId').addEventListener('change', (e) => {
        const routeId = e.target.value;
        const hint = document.getElementById('noRouteHint');
        const list = document.getElementById('stopCheckboxList');
        const countEl = document.getElementById('stopCount');

        if (!routeId) {
            list.innerHTML = buildStopCheckboxes([], []);
            hint.style.display = 'flex';
            countEl.textContent = '0 stops';
        } else {
            const stops = getStopsForRoute(routeId);
            list.innerHTML = buildStopCheckboxes(stops, []);
            hint.style.display = 'none';
            countEl.textContent = `${stops.length} stop${stops.length !== 1 ? 's' : ''}`;
        }
        window.updateMultiSelectLabel();
    });
}
