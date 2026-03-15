import { api } from './api.js';
import { renderStatusPill, renderModal, renderDataTable, showToast, initGlobalUI } from './shared.js';
import './auth.js'; // Ensure auth checks run

let allRoutes = [];

document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    loadRoutes();

    document.getElementById('addRouteBtn').addEventListener('click', () => openRouteModal());
    document.getElementById('searchInput').addEventListener('input', (e) => filterRoutes(e.target.value));
});

async function loadRoutes() {
    try {
        allRoutes = await api.routes.list();
        renderTable(allRoutes);
    } catch (err) {
        showToast('Failed to load routes', 'error');
    }
}

function filterRoutes(query) {
    if (!query) return renderTable(allRoutes);
    const q = query.toLowerCase();
    const filtered = allRoutes.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.nameKurdish.toLowerCase().includes(q)
    );
    renderTable(filtered);
}

function renderTable(routes) {
    const container = document.getElementById('routesTableContainer');
    const columns = ['Name', 'Kurdish Name', 'Color', 'Status', 'Description', 'Buses', 'Fav', 'Actions'];
    
    // Attach global window functions for inline onclick handlers
    window.editRoute = (id) => {
        const route = allRoutes.find(r => r.id === id);
        if (route) openRouteModal(route);
    };

    window.confirmDeleteRoute = (id) => {
        const tr = document.getElementById(`row-${id}`);
        const originalHTML = tr.innerHTML;
        tr.innerHTML = `
            <td colspan="8" style="background: rgba(239, 68, 68, 0.05); text-align: center;">
                <span style="font-weight: 600; color: var(--color-red); margin-right: 16px;">Are you sure?</span>
                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="executeDeleteRoute('${id}')">Confirm Delete</button>
                <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 12px;" onclick="cancelDeleteRoute('${id}')">Cancel</button>
            </td>
        `;
        tr.dataset.original = originalHTML;
    };

    window.cancelDeleteRoute = (id) => {
        const tr = document.getElementById(`row-${id}`);
        tr.innerHTML = tr.dataset.original;
    };

    window.executeDeleteRoute = async (id) => {
        try {
            await api.routes.delete(id);
            showToast('Route deleted');
            loadRoutes();
        } catch (err) {
            showToast('Failed to delete route', 'error');
        }
    };

    window.toggleFavorite = async (id) => {
        try {
            await api.routes.toggleFavorite(id);
            loadRoutes();
        } catch (err) {
            showToast('Failed to update favorite', 'error');
        }
    }

    const rowsHTML = routes.map(r => `
        <tr id="row-${r.id}" style="transition: all 0.2s ease;">
            <td style="font-weight: 600;">${r.name}</td>
            <td style="color: var(--color-text-muted);">${r.nameKurdish}</td>
            <td><span class="color-swatch" style="background-color: ${r.colorHex};"></span></td>
            <td>${renderStatusPill(r.status)}</td>
            <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.description || ''}">${r.description || '-'}</td>
            <td><span style="font-weight: 600; color: var(--color-text-muted);">${r._count ? r._count.buses : 0}</span></td>
            <td>
                <button class="action-btn" onclick="toggleFavorite('${r.id}')" style="color: ${r.isFavorite ? 'var(--color-teal)' : 'var(--color-text-muted)'}">
                    <span class="material-icons">${r.isFavorite ? 'star' : 'star_border'}</span>
                </button>
            </td>
            <td class="actions">
                <button class="action-btn edit" onclick="editRoute('${r.id}')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="action-btn delete" onclick="confirmDeleteRoute('${r.id}')">
                    <span class="material-icons">delete</span>
                </button>
            </td>
        </tr>
    `).join('');

    container.innerHTML = renderDataTable(columns, rowsHTML);
}

function openRouteModal(route = null) {
    const isEdit = !!route;
    const title = isEdit ? 'Edit Route' : 'Add Route';
    
    // Default values
    const d = route || {
        name: '', nameKurdish: '', colorHex: '#1877F2', status: 'RUNNING', description: '', isFavorite: false
    };

    const formHTML = `
        <input type="hidden" id="routeId" value="${d.id || ''}">
        
        <div class="form-group">
            <label class="form-label" for="routeName">Route Name (English)</label>
            <input type="text" id="routeName" class="form-control" value="${d.name}" required>
        </div>
        
        <div class="form-group">
            <label class="form-label" for="routeNameKurdish">Route Name (Kurdish)</label>
            <input type="text" id="routeNameKurdish" class="form-control" value="${d.nameKurdish}" required>
        </div>
        
        <div class="flex-between gap-4">
            <div class="form-group" style="flex: 1;">
                <label class="form-label" for="routeColor">Color Hex</label>
                <!-- the user requested styled color picker -->
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="color" id="routeColor" value="${d.colorHex}" 
                        style="width: 44px; height: 44px; padding: 0; border: none; border-radius: 8px; cursor: pointer; background: transparent;">
                    <input type="text" id="routeColorText" class="form-control" value="${d.colorHex}" readonly style="flex: 1;">
                </div>
            </div>
            
            <div class="form-group" style="flex: 1;">
                <label class="form-label" for="routeStatus">Status</label>
                <select id="routeStatus" class="form-control">
                    <option value="RUNNING" ${d.status === 'RUNNING' ? 'selected' : ''}>Running</option>
                    <option value="DELAYED" ${d.status === 'DELAYED' ? 'selected' : ''}>Delayed</option>
                    <option value="OUT_OF_SERVICE" ${d.status === 'OUT_OF_SERVICE' ? 'selected' : ''}>Out of Service</option>
                </select>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label" for="routeDesc">Description</label>
            <textarea id="routeDesc" class="form-control" rows="3">${d.description || ''}</textarea>
        </div>
        
        <div class="form-group flex-between" style="background: var(--color-input-bg); padding: 12px 16px; border-radius: var(--radius-btn);">
            <div>
                <div style="font-weight: 600; font-size: 14px;">Favorite Route</div>
                <div style="font-size: 12px; color: var(--color-text-muted);">Pin this route to the top of lists</div>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="routeFav" ${d.isFavorite ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
    `;

    renderModal(title, formHTML, async (form, closeModal) => {
        // Sync color picker to text
        const colorInput = document.getElementById('routeColor');
        document.getElementById('routeColorText').value = colorInput.value;
        colorInput.addEventListener('input', (e) => {
            document.getElementById('routeColorText').value = e.target.value;
        });

        const data = {
            name: document.getElementById('routeName').value,
            nameKurdish: document.getElementById('routeNameKurdish').value,
            colorHex: document.getElementById('routeColor').value,
            status: document.getElementById('routeStatus').value,
            description: document.getElementById('routeDesc').value,
            isFavorite: document.getElementById('routeFav').checked
        };
        
        if (!data.name || !data.nameKurdish) {
            showToast('Please fill required fields', 'error');
            return;
        }

        try {
            const btn = document.getElementById('modalSaveBtn');
            const originalText = btn.innerText;
            btn.innerHTML = '<span class="material-icons spin">refresh</span>';
            btn.disabled = true;

            const routeId = document.getElementById('routeId').value;
            if (routeId) {
                await api.routes.update(routeId, data);
                showToast('Route updated');
            } else {
                await api.routes.create(data);
                showToast('Route created');
            }
            closeModal();
            loadRoutes();
        } catch (err) {
            showToast('Failed to save route', 'error');
            const btn = document.getElementById('modalSaveBtn');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // Color sync setup after render
    setTimeout(() => {
        const colorInput = document.getElementById('routeColor');
        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                const txt = document.getElementById('routeColorText');
                if (txt) txt.value = e.target.value.toUpperCase();
            });
        }
    }, 100);
}
