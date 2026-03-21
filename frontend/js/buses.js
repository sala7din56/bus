import { api } from './api.js';
import { renderStatusPill, renderModal, renderDataTable, showToast, initGlobalUI } from './shared.js';
import './auth.js';

let allBuses = [];
let allRoutes = [];
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    loadDependencies().then(loadBuses);

    document.getElementById('addBusBtn').addEventListener('click', () => openBusModal());
    document.getElementById('searchInput').addEventListener('input', (e) => filterBuses(e.target.value));

    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
        const indicator = document.getElementById('refreshIndicator');
        if (indicator) {
            indicator.style.opacity = '1';
            indicator.classList.add('spin');
            
            // fetch silently
            api.buses.list().then(buses => {
                allBuses = buses;
                const query = document.getElementById('searchInput').value;
                filterBuses(query);
                
                setTimeout(() => {
                    indicator.classList.remove('spin');
                    indicator.style.opacity = '0';
                }, 500);
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
        window.allStops = stops; // Make available for modal
        window.allDepots = depots; // Make available for modal/table
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

function renderTable(buses) {
    const container = document.getElementById('busesTableContainer');
    const columns = ['Bus ID', 'Route', 'Depot', 'Position', 'Status', 'Next Stop', 'Last Updated', 'Actions'];
    
    window.editBus = (id) => {
        const bus = allBuses.find(b => b.id === id);
        if (bus) openBusModal(bus);
    };

    window.promptDeleteBus = (id) => {
        if (confirm('Delete this bus?')) {
            executeDeleteBus(id);
        }
    };

    window.executeDeleteBus = async (id) => {
        try {
            await api.buses.delete(id);
            showToast('Bus deleted');
            loadBuses();
        } catch (err) {
            showToast('Failed to delete bus', 'error');
        }
    };

    const rowsHTML = buses.map(b => {
        const routeDisplay = b.route ? `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="color-swatch" style="width: 12px; height: 12px; background-color: ${b.route.colorHex};"></span>
                ${b.route.name}
            </div>
        ` : '<span style="color: var(--color-text-muted)">Unassigned</span>';

        const depot = (window.allDepots || []).find(dp => dp.id === b.depotId);
        const depotDisplay = depot ? `<span style="font-size: 13px; font-weight: 500;"><span class="material-icons" style="font-size: 14px; vertical-align: middle; color: ${depot.colorHex || 'var(--color-primary)'}">garage</span> ${depot.name}</span>` : '<span style="color: var(--color-text-muted)">—</span>';

        return `
        <tr>
            <td style="font-family: monospace; font-weight: 600; color: var(--color-text-muted);">${b.id.substring(b.id.length - 6).toUpperCase()}</td>
            <td style="font-weight: 600;">${routeDisplay}</td>
            <td>${depotDisplay}</td>
            <td style="font-family: monospace; color: var(--color-text-muted); font-size: 13px;">${b.latitude.toFixed(4)}°N, ${b.longitude.toFixed(4)}°E</td>
            <td>${renderStatusPill(b.status)}</td>
            <td>${b.nextStopName || '-'}</td>
            <td style="color: var(--color-text-muted); font-size: 13px;">${timeSince(b.lastUpdated)}</td>
            <td class="actions">
                <button class="action-btn edit" onclick="editBus('${b.id}')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="action-btn delete" onclick="promptDeleteBus('${b.id}')">
                    <span class="material-icons">delete</span>
                </button>
            </td>
        </tr>
    `}).join('');

    container.innerHTML = renderDataTable(columns, rowsHTML);
}

function openBusModal(bus = null) {
    const isEdit = !!bus;
    const title = isEdit ? 'Edit Bus' : 'Add Bus';
    
    const d = bus || { routeId: '', depotId: '', latitude: 36.1910, longitude: 44.0085, status: 'RUNNING', nextStopName: '' };
    
    const routeOptions = allRoutes.map(r => 
        `<option value="${r.id}" ${d.routeId === r.id ? 'selected' : ''}>${r.name}</option>`
    ).join('');

    // Transform text box to dropdown
    const stopOptions = (window.allStops || []).map(s => 
        `<option value="${s.name}" ${d.nextStopName === s.name ? 'selected' : ''}>${s.name}</option>`
    ).join('');

    const formHTML = `
        <input type="hidden" id="busId" value="${d.id || ''}">
        
        <div style="display: flex; gap: 12px;">
            <div class="form-group" style="flex: 1;">
                <label class="form-label" for="busRouteId">Assigned Route</label>
                <select id="busRouteId" class="form-control" required>
                    <option value="">-- Select Route --</option>
                    ${routeOptions}
                </select>
            </div>
            <div class="form-group" style="flex: 1;">
                <label class="form-label" for="busDepotId">Assigned Depot</label>
                <select id="busDepotId" class="form-control">
                    <option value="">-- No Depot --</option>
                    ${(window.allDepots || []).map(dp => `<option value="${dp.id}" ${d.depotId === dp.id ? 'selected' : ''}>${dp.name}</option>`).join('')}
                </select>
            </div>
        </div>
        
        <div class="flex-between gap-4">
            <div class="form-group" style="flex: 1;">
                <label class="form-label" for="busLat">Latitude</label>
                <input type="number" id="busLat" class="form-control" value="${d.latitude}" step="0.000001" required>
            </div>
            <div class="form-group" style="flex: 1;">
                <label class="form-label" for="busLng">Longitude</label>
                <input type="number" id="busLng" class="form-control" value="${d.longitude}" step="0.000001" required>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label" for="busStatus">Status</label>
            <select id="busStatus" class="form-control">
                <option value="RUNNING" ${d.status === 'RUNNING' ? 'selected' : ''}>Running</option>
                <option value="DELAYED" ${d.status === 'DELAYED' ? 'selected' : ''}>Delayed</option>
                <option value="OUT_OF_SERVICE" ${d.status === 'OUT_OF_SERVICE' ? 'selected' : ''}>Out of Service</option>
            </select>
        </div>

        <div class="form-group flex-between gap-4">
            <div style="flex: 1;">
                <label class="form-label" for="busNextStop">Next Stop / Location Focus</label>
                <select id="busNextStop" class="form-control">
                    <option value="">-- No Next Stop Selected --</option>
                    ${stopOptions}
                </select>
            </div>
        </div>
    `;

    renderModal(title, formHTML, async (form, closeModal) => {
        const data = {
            routeId: document.getElementById('busRouteId').value,
            depotId: document.getElementById('busDepotId').value || null,
            latitude: parseFloat(document.getElementById('busLat').value),
            longitude: parseFloat(document.getElementById('busLng').value),
            status: document.getElementById('busStatus').value,
            nextStopName: document.getElementById('busNextStop').value || null
        };
        
        if (!data.routeId) {
            showToast('Please select a route', 'error');
            return;
        }

        try {
            const btn = document.getElementById('modalSaveBtn');
            const originalText = btn.innerText;
            btn.innerHTML = '<span class="material-icons spin">refresh</span>';
            btn.disabled = true;

            const busId = document.getElementById('busId').value;
            if (busId) {
                await api.buses.update(busId, data);
                showToast('Bus updated');
            } else {
                await api.buses.create(data);
                showToast('Bus created');
            }
            closeModal();
            loadBuses();
        } catch (err) {
            showToast('Failed to save bus', 'error');
            const btn = document.getElementById('modalSaveBtn');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}
