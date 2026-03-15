import { api } from './api.js';
import { renderModal, renderDataTable, showToast, initGlobalUI } from './shared.js';
import './auth.js';

let allSchedules = [];
let allRoutes = [];
let allStops = [];
let allBuses = [];

document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    loadDependencies().then(loadSchedules);

    document.getElementById('addScheduleBtn').addEventListener('click', () => openScheduleModal());
    document.getElementById('searchInput').addEventListener('input', (e) => filterSchedules(e.target.value));
});

async function loadDependencies() {
    try {
        const [r, s, b] = await Promise.all([
            api.routes.list(),
            api.stops.list(),
            api.buses.list()
        ]);
        allRoutes = r;
        allStops = s;
        allBuses = b;
    } catch (err) {
        console.error('Failed to load dependencies', err);
    }
}

async function loadSchedules() {
    try {
        allSchedules = await api.schedules.list();
        renderTable(allSchedules);
    } catch (err) {
        showToast('Failed to load schedules', 'error');
    }
}

function filterSchedules(query) {
    if (!query) return renderTable(allSchedules);
    const q = query.toLowerCase();
    const filtered = allSchedules.filter(s => {
        const rName = s.route ? s.route.name.toLowerCase() : '';
        const stName = s.stop ? s.stop.name.toLowerCase() : '';
        return rName.includes(q) || stName.includes(q) || s.arrivalTime.includes(q);
    });
    renderTable(filtered);
}

function renderTable(schedules) {
    const container = document.getElementById('schedulesTableContainer');
    const columns = ['Route', 'Stop', 'Bus ID', 'Arrival Time', 'Realtime Badge', 'Actions'];
    
    window.editSchedule = (id) => {
        const sched = allSchedules.find(s => s.id === id);
        if (sched) openScheduleModal(sched);
    };

    window.promptDeleteSchedule = (id) => {
        if (confirm('Delete this schedule?')) {
            executeDeleteSchedule(id);
        }
    };

    window.executeDeleteSchedule = async (id) => {
        try {
            await api.schedules.delete(id);
            showToast('Schedule deleted');
            loadSchedules();
        } catch (err) {
            showToast('Failed to delete schedule', 'error');
        }
    };

    const rowsHTML = schedules.map(s => {
        const busId = s.bus ? s.bus.id.substring(s.bus.id.length - 6).toUpperCase() : '-';
        const realtimeBadge = s.isRealtime ? 
            `<span class="status-pill status-RUNNING" style="position: relative; padding-left: 20px;">
                <span style="position: absolute; left: 6px; top: 6px; width: 6px; height: 6px; background: var(--color-green); border-radius: 50%; box-shadow: 0 0 0 2px rgba(16,185,129,0.3); animation: pulse 1.5s infinite;"></span>
                LIVE
            </span>` : 
            `<span class="status-pill status-OUT_OF_SERVICE" style="color: var(--color-text-muted); background: var(--color-input-bg); border-color: transparent;">STATIC</span>`;

        return `
        <tr>
            <td style="font-weight: 600;">${s.route ? s.route.name : 'Unknown'}</td>
            <td>${s.stop ? s.stop.name : 'Unknown'}</td>
            <td style="font-family: monospace; color: var(--color-text-muted);">${busId}</td>
            <td style="font-weight: 600; font-family: monospace; font-size: 15px;">${s.arrivalTime}</td>
            <td>${realtimeBadge}</td>
            <td class="actions">
                <button class="action-btn edit" onclick="editSchedule('${s.id}')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="action-btn delete" onclick="promptDeleteSchedule('${s.id}')">
                    <span class="material-icons">delete</span>
                </button>
            </td>
        </tr>
    `}).join('');

    container.innerHTML = `<style>
        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
    </style>` + renderDataTable(columns, rowsHTML);
}

function openScheduleModal(schedule = null) {
    const isEdit = !!schedule;
    const title = isEdit ? 'Edit Schedule' : 'Add Schedule';
    
    const d = schedule || { routeId: '', stopId: '', busId: '', arrivalTime: '08:00', isRealtime: false };
    
    const routeOpts = allRoutes.map(r => `<option value="${r.id}" ${d.routeId === r.id ? 'selected' : ''}>${r.name}</option>`).join('');
    const stopOpts = allStops.map(s => `<option value="${s.id}" ${d.stopId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');
    const busOpts = allBuses.map(b => `<option value="${b.id}" ${d.busId === b.id ? 'selected' : ''}>${b.id.substring(b.id.length-6).toUpperCase()} (${b.route ? b.route.name : 'Unassigned'})</option>`).join('');

    const formHTML = `
        <input type="hidden" id="schedId" value="${d.id || ''}">
        
        <div class="form-group">
            <label class="form-label" for="schedRouteId">Route</label>
            <select id="schedRouteId" class="form-control" required>
                <option value="">-- Select Route --</option>
                ${routeOpts}
            </select>
        </div>
        
        <div class="form-group">
            <label class="form-label" for="schedStopId">Stop</label>
            <select id="schedStopId" class="form-control" required>
                <option value="">-- Select Stop --</option>
                ${stopOpts}
            </select>
        </div>
        
        <div class="form-group">
            <label class="form-label" for="schedBusId">Assign Bus (Optional)</label>
            <select id="schedBusId" class="form-control">
                <option value="">-- None --</option>
                ${busOpts}
            </select>
        </div>
        
        <div class="flex-between gap-4">
            <div class="form-group" style="flex: 1;">
                <label class="form-label" for="schedTime">Arrival Time</label>
                <input type="time" id="schedTime" class="form-control" value="${d.arrivalTime}" required>
            </div>
        </div>

        <div class="form-group flex-between" style="background: var(--color-input-bg); padding: 12px 16px; border-radius: var(--radius-btn);">
            <div>
                <div style="font-weight: 600; font-size: 14px;">Realtime Tracking</div>
                <div style="font-size: 12px; color: var(--color-text-muted);">Enable live GPS tracking badge for this schedule</div>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="schedRealtime" ${d.isRealtime ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
    `;

    renderModal(title, formHTML, async (form, closeModal) => {
        const data = {
            routeId: document.getElementById('schedRouteId').value,
            stopId: document.getElementById('schedStopId').value,
            busId: document.getElementById('schedBusId').value || null,
            arrivalTime: document.getElementById('schedTime').value,
            isRealtime: document.getElementById('schedRealtime').checked
        };
        
        if (!data.routeId || !data.stopId || !data.arrivalTime) {
            showToast('Please fill required fields', 'error');
            return;
        }

        try {
            const btn = document.getElementById('modalSaveBtn');
            const originalText = btn.innerText;
            btn.innerHTML = '<span class="material-icons spin">refresh</span>';
            btn.disabled = true;

            const schedId = document.getElementById('schedId').value;
            if (schedId) {
                await api.schedules.update(schedId, data);
                showToast('Schedule updated');
            } else {
                await api.schedules.create(data);
                showToast('Schedule created');
            }
            closeModal();
            loadSchedules();
        } catch (err) {
            showToast('Failed to save schedule', 'error');
            const btn = document.getElementById('modalSaveBtn');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}
