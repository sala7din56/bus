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
        `;
        
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
