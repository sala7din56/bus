import { api } from './api.js';
import { renderStatCard, renderStatusPill, renderDataTable, initGlobalUI, animateCountUps } from './shared.js';

document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    loadDashboard();
});

async function loadDashboard() {
    try {
        const stats = await api.dashboard.stats();
        
        // Render Stat Cards
        const statsGrid = document.getElementById('statsGrid');
        statsGrid.classList.remove('skeleton');
        statsGrid.innerHTML = `
            <a href="routes.html" style="text-decoration: none; color: inherit; display: block;">
                ${renderStatCard('route', 'blue', 'Routes', stats.totalRoutes, 'Total bus routes')}
            </a>
            <a href="buses.html" style="text-decoration: none; color: inherit; display: block;">
                ${renderStatCard('directions_bus', 'green', 'Buses', stats.activeBuses, 'Currently active')}
            </a>
            <a href="routes.html" style="text-decoration: none; color: inherit; display: block;">
                ${renderStatCard('place', 'teal', 'Stops', stats.totalStops, 'Transit stops')}
            </a>
            <a href="schedules.html" style="text-decoration: none; color: inherit; display: block;">
                ${renderStatCard('schedule', 'orange', 'Delayed', stats.delayedBuses, 'Buses delayed')}
            </a>
            <a href="drivers.html" style="text-decoration: none; color: inherit; display: block;">
                ${renderStatCard('badge', 'navy', 'Drivers', stats.totalDrivers || 0, 'Total payroll')}
            </a>
        `;
        
        const alertsContainer = document.getElementById('dashboardAlerts');
        if (alertsContainer && stats.licensesExpiringSoon > 0) {
            alertsContainer.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-red); color: var(--color-red); padding: 16px; border-radius: var(--radius-btn); display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="material-icons">warning</span>
                        <span style="font-weight: 600;">Action Required: ${stats.licensesExpiringSoon} driver license(s) expiring within 30 days!</span>
                    </div>
                    <a href="drivers.html?filter=expiring" class="btn" style="background: var(--color-red); color: white; padding: 6px 12px; font-size: 13px;">View Renewals</a>
                </div>
            `;
        }
        
        // Init counter animation
        animateCountUps();

        // Render Recent Routes Table
        const tableContainer = document.getElementById('recentRoutesTable');
        
        if (!stats.recentRoutes || stats.recentRoutes.length === 0) {
            tableContainer.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--color-text-muted);">
                    <span class="material-icons" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">route</span>
                    <h3>No recent routes</h3>
                </div>`;
            return;
        }

        const columns = ['#', 'Route Name', 'Kurdish Name', 'Color', 'Status'];
        
        const rowsHTML = stats.recentRoutes.map((route, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td style="font-weight: 600;">${route.name}</td>
                <td style="color: var(--color-text-muted);">${route.nameKurdish}</td>
                <td><span class="color-swatch" style="background-color: ${route.colorHex};"></span></td>
                <td>${renderStatusPill(route.status)}</td>
            </tr>
        `).join('');
        
        tableContainer.innerHTML = renderDataTable(columns, rowsHTML);

    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}
