import { api } from './api.js';
import { renderStatusPill, renderModal, showToast, initGlobalUI, confirmModal } from './shared.js';
import './auth.js';

let allRoutes = [];
let allStops = [];
let map;
let currentTileLayer;
let drawMode = null; // null or 'route'
let selectedRouteId = null;
let activePolyline = null;
let highlightPolyline = null;
let routeOutlinePolyline = null;
let waypointMarkers = [];
let unsavedChanges = null;    // array of [lat, lng] for currently drawn path
let allBuses = [];
let activeBusPoller = null;
let busMarkers = [];
let mapStyles = [
    { name: 'Street', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '&copy; OSM &copy; CARTO' },
    { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri' },
    { name: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '&copy; OSM &copy; CARTO' }
];
let currentStyleIdx = 0;
let backgroundStopsLayer = L.layerGroup(); 

document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    initMap();
    loadAll();

    // Event Listeners
    const globalSearch = document.getElementById('searchInput');
    const sidebarSearch = document.getElementById('routesSidebarSearch');
    
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            if (sidebarSearch) sidebarSearch.value = e.target.value;
            filterRoutes(e.target.value);
        });
    }
    
    if (sidebarSearch) {
        sidebarSearch.addEventListener('input', (e) => {
            if (globalSearch) globalSearch.value = e.target.value;
            filterRoutes(e.target.value);
        });
    }

    document.getElementById('mapRouteSelector').addEventListener('change', (e) => selectRoute(e.target.value));
    
    // Toolbar buttons
    document.getElementById('drawRouteBtn').addEventListener('click', toggleDrawRouteMode);
    document.getElementById('clearPathBtn').addEventListener('click', clearPath);
    document.getElementById('saveMapBtn').addEventListener('click', saveMapChanges);
    document.getElementById('exportMapBtn').addEventListener('click', exportMap);
    document.getElementById('mapStyleBtn').addEventListener('click', toggleMapStyle);
    document.getElementById('fitAllBtn').addEventListener('click', fitAllStops);
    document.getElementById('centerErbilBtn').addEventListener('click', () => {
        if(map) map.flyTo([36.1901, 44.0091], 13, { animate: true, duration: 1.5 });
    });
    
    // Focus Mode
    document.getElementById('focusModeBtn').addEventListener('click', () => toggleFocusMode());
    
    // Check localStorage for focus mode preference
    if (localStorage.getItem('erbil_focus_mode') === 'true') {
        toggleFocusMode(true);
    }
});

// ========== MAP INITIALIZATION ==========
function initMap() {
    // Smooth zoom configs
    map = L.map('routeMapBuilder', {
        zoomControl: false, // We will manually place it
        zoomAnimation: true,
        wheelPxPerZoomLevel: 60,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        wheelDebounceTime: 40
    }).setView([36.1901, 44.0091], 13);
    
    // Move zoom control to bottom right so it doesn't overlap overlays
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    setTileLayer(currentStyleIdx);

    // Removed markerClusterGroup to clean up map clutter

    map.on('click', onMapClick);
    map.on('contextmenu', (e) => {
        // Prevent default browser context menu on map
    });
    
    setTimeout(() => hideLoader(), 500);
}

function setTileLayer(idx) {
    if (currentTileLayer) map.removeLayer(currentTileLayer);
    const style = mapStyles[idx];
    currentTileLayer = L.tileLayer(style.url, {
        attribution: style.attr,
        subdomains: 'abcd',
        maxZoom: 20
    });
    
    // Re-add and push to back
    currentTileLayer.addTo(map);
    currentTileLayer.bringToBack();
}

function toggleMapStyle() {
    currentStyleIdx = (currentStyleIdx + 1) % mapStyles.length;
    setTileLayer(currentStyleIdx);
}

// ========== LOADER ==========
function showLoader() { document.getElementById('mapLoader').style.display = 'flex'; }
function hideLoader() { document.getElementById('mapLoader').style.display = 'none'; }

// ========== FOCUS MODE ==========
function toggleFocusMode(force = null) {
    const workspace = document.getElementById('mapWorkspace');
    const btn = document.getElementById('focusModeBtn');
    const overlay = document.getElementById('focusModeOverlay');
    
    let isFocusing = force !== null ? force : !workspace.classList.contains('focus-mode');
    
    if (isFocusing) {
        workspace.classList.add('focus-mode');
        btn.innerHTML = '<span class="material-icons" style="font-size: 20px; color: var(--color-text-dark);">fullscreen_exit</span>';
        overlay.style.display = 'block';
        localStorage.setItem('erbil_focus_mode', 'true');
    } else {
        workspace.classList.remove('focus-mode');
        btn.innerHTML = '<span class="material-icons" style="font-size: 20px; color: var(--color-text-dark);">fullscreen</span>';
        overlay.style.display = 'none';
        localStorage.setItem('erbil_focus_mode', 'false');
    }
    
    setTimeout(() => { if (map) map.invalidateSize(); }, 350);
}

// ========== DATA LOADING ==========
async function loadAll() {
    try {
        const [routes, stops] = await Promise.all([
            api.routes.list(),
            api.stops.list()
        ]);
        allRoutes = routes;
        allStops = stops;
        
        populateRouteSelector();
        renderRouteList(allRoutes);
        updateStats();

        startBusPoller();
    } catch (err) {
        showToast('Failed to load data', 'error');
        console.error(err);
    }
}

function updateStats() {
    const totalRuns = allRoutes.filter(r => r.status === 'RUNNING').length;
    document.getElementById('statsSummary').innerHTML = `
        <span style="display:inline-block; margin-right: 12px;"><strong>${allRoutes.length}</strong> Total Routes</span>
        <span style="display:inline-block; margin-right: 12px;"><strong>${allStops.length}</strong> Total Stops</span>
        <span style="display:inline-block; color: var(--color-teal);">${totalRuns} Running</span>
    `;
}

function filterRoutes(query) {
    const q = query.toLowerCase();
    const filtered = allRoutes.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.nameKurdish.toLowerCase().includes(q)
    );
    renderRouteList(filtered);
}

// ========== SIDEBAR ROUTE LIST ==========
function renderRouteList(routes) {
    const container = document.getElementById('routeCardsList');
    if (!routes.length) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #9CA3AF;">No routes match your search.</div>';
        return;
    }
    
    container.innerHTML = routes.map(r => `
        <div class="route-card ${selectedRouteId === r.id ? 'selected' : ''}" onclick="selectRoute('${r.id}')" id="card-${r.id}">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
                <div class="route-color-swatch" style="background-color: ${r.colorHex};"></div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">${r.name}</div>
                    <div style="color: var(--color-text-muted); font-size: 12px; margin-bottom: 8px;" dir="rtl">${r.nameKurdish}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 12px; color: var(--color-text-muted); font-weight: 600;">
                            ${r._count?.buses || 0} buses
                        </span>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            ${renderStatusPill(r.status)}
                            <button class="icon-btn edit-route-btn" data-id="${r.id}" title="Edit Route" onclick="event.stopPropagation(); openRouteModal('${r.id}')" style="padding: 4px; margin-left: 8px; color: var(--color-teal); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 16px;">edit</span></button>
                            <button class="icon-btn delete-route-btn" data-id="${r.id}" title="Delete Route" onclick="event.stopPropagation(); deleteRoute('${r.id}')" style="padding: 4px; color: var(--color-red); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 16px;">delete</span></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function populateRouteSelector() {
    const sel = document.getElementById('mapRouteSelector');
    sel.innerHTML = '<option value="">-- All Routes --</option>' +
        allRoutes.map(r => `<option value="${r.id}">● ${r.name}</option>`).join('');
}

window.selectRoute = selectRoute;
function selectRoute(routeId) {
    // If selecting currently selected route, deselect it (if clicked from sidebar)
    if (String(selectedRouteId) === String(routeId)) {
        // deselect
        routeId = "";
    }
    
    selectedRouteId = routeId ? (isNaN(routeId) ? routeId : parseInt(routeId, 10)) : null; // Handle potential int/string ids
    
    // Update Dropdown
    document.getElementById('mapRouteSelector').value = selectedRouteId || "";
    
    // Update Draw Mode UI
    if (drawMode) toggleDrawRouteMode(); // turn drawing off on switch
    unsavedChanges = null;
    document.getElementById('saveMapBtn').disabled = true;
    
    // Update selected class manually to preserve search filter DOM
    document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
    if (selectedRouteId) {
        const activeCard = document.getElementById(`card-${selectedRouteId}`);
        if (activeCard) activeCard.classList.add('selected');
    }
    
    if (!selectedRouteId) {
        // Restoring to All Routes view
        document.getElementById('activeRouteStopsSection').style.display = 'none';
        document.getElementById('focusOverlayTitle').textContent = 'All Routes';
        document.getElementById('focusOverlaySubtitle').textContent = 'Showing all network stops';
        const inst = document.getElementById('mapInstructions');
        if (inst) inst.textContent = 'Select a route, then click "Draw Route Path" to start adding waypoints.';
        
        clearActiveRoutePolylines();
        fitAllStops();
        renderBuses();
    } else {
        // Focused on one route
        const route = allRoutes.find(r => String(r.id) === String(selectedRouteId));
        if (!route) return;
        
        document.getElementById('focusOverlayTitle').textContent = route.name;
        document.getElementById('focusOverlaySubtitle').textContent = route.nameKurdish;
        const inst = document.getElementById('mapInstructions');
        if (inst) inst.textContent = `Route "${route.name}" active. Use "Draw Path" to edit line.`;
        
        renderActiveRoutePanel(route);
        drawActiveRouteOnMap(route);
        renderBuses();
    }
}

function renderActiveRoutePanel(route) {
    const section = document.getElementById('activeRouteStopsSection');
    const title = document.getElementById('activeRouteStopsTitle');
    const list = document.getElementById('activeRouteStopsList');
    
    section.style.display = 'block';
    
    // Get stops belonging to this route via schedules (heuristic based on existing schema)
    // Actually, backend returns stops with lat/lng. For a real system we'd parse route.waypoints 
    // or filter allStops by those linked via schedules.
    // Let's parse waypoints to list them as stops for the mockup UI.
    let wps = [];
    try {
        wps = JSON.parse(route.waypoints || '[]');
        if (typeof wps === 'string') wps = JSON.parse(wps);
    } catch(e) {}
    if (!Array.isArray(wps)) wps = [];
    
    title.textContent = `Path Waypoints (${wps.length})`;
    
    if (wps.length === 0) {
        list.innerHTML = `<div style="padding: 12px; font-size: 12px; color: var(--color-text-muted); font-style: italic;">No path drawn yet. Click "Draw Route Path" to add waypoints.</div>`;
    } else {
        list.innerHTML = wps.map((wp, i) => `
            <div class="stop-list-item" onclick="flyToWP(${wp[0]}, ${wp[1]})">
                <div class="stop-list-num">${i + 1}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">Waypoint ${i + 1}</div>
                    <div style="font-family: monospace; font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">${wp[0].toFixed(5)}, ${wp[1].toFixed(5)}</div>
                </div>
            </div>
        `).join('');
    }
}

window.flyToWP = (lat, lng) => {
    if (map) map.flyTo([lat, lng], 16, { animate: true, duration: 1.0 });
};

// ========== MAP RENDERING ==========
// (Background stops removed as per user request to reduce clutter)

function clearActiveRoutePolylines() {
    if (activePolyline) { map.removeLayer(activePolyline); activePolyline = null; }
    if (highlightPolyline) { map.removeLayer(highlightPolyline); highlightPolyline = null; }
    if (routeOutlinePolyline) { map.removeLayer(routeOutlinePolyline); routeOutlinePolyline = null; }
    waypointMarkers.forEach(m => map.removeLayer(m));
    waypointMarkers = [];
}

function drawActiveRouteOnMap(route) {
    clearActiveRoutePolylines();
    
    let wps = [];
    try {
        wps = JSON.parse(route.waypoints || '[]');
        if (typeof wps === 'string') wps = JSON.parse(wps);
    } catch(e) {}
    
    unsavedChanges = Array.isArray(wps) ? [...wps] : [];
    
    let warningColor = null;
    let baseColor = route.colorHex || '#1877F2';
    
    if (route.status === 'DELAYED') {
        warningColor = '#FF9800';
    } else if (route.status === 'OUT_OF_SERVICE') {
        warningColor = '#EF4444';
    }
    
    renderDrawnPath(baseColor, false, warningColor);
    
    if (wps.length > 1) {
        const bounds = L.latLngBounds(wps);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
}

function renderDrawnPath(color, isDrawing, warningColor = null) {
    clearActiveRoutePolylines();
    
    if (!unsavedChanges || unsavedChanges.length === 0) return;

    // Draw outline polyline for premium look
    routeOutlinePolyline = L.polyline(unsavedChanges, {
        color: '#1f2937', 
        weight: warningColor ? 8 : 6,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);
    
    // Draw base polyline
    activePolyline = L.polyline(unsavedChanges, {
        color: color,
        weight: warningColor ? 6 : 4,
        opacity: 1.0,
        dashArray: isDrawing ? '8 6' : null,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);
    
    // Draw dashed highlight polyline overlay if requested
    if (warningColor && !isDrawing) {
        highlightPolyline = L.polyline(unsavedChanges, {
            color: warningColor,
            weight: 6,
            opacity: 1.0,
            dashArray: '12 18',
            lineCap: 'butt',
            lineJoin: 'round'
        }).addTo(map);
    }
    
    // Draw markers
    unsavedChanges.forEach((pt, i) => {
        const m = L.circleMarker(pt, {
            radius: isDrawing ? 6 : 8,
            fillColor: color,
            color: '#fff',
            weight: 2,
            fillOpacity: 1,
            draggable: isDrawing // Need custom drag logic for circle markers if we want this, Leaflet CircleMarkers aren't naturally draggable. 
            // We use standard markers with custom icons during draw mode for drag support
        });
        
        if (isDrawing) {
            // Use standard marker for draggability
            const icon = L.divIcon({
                html: `<div style="background: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>`,
                className: '',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });
            const dragM = L.marker(pt, { icon, draggable: true }).addTo(map);
            dragM.bindTooltip(`WP ${i+1}`, { direction: 'top', permanent: false });
            
            dragM.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                unsavedChanges[i] = [pos.lat, pos.lng];
                renderDrawnPath(color, true); // re-render
                document.getElementById('saveMapBtn').disabled = false;
            });
            
            dragM.on('contextmenu', (e) => {
                // Right click remove
                unsavedChanges.splice(i, 1);
                renderDrawnPath(color, true);
                document.getElementById('saveMapBtn').disabled = false;
            });
            
            waypointMarkers.push(dragM);
        } else {
            // standard circle
            m.addTo(map);
            m.bindTooltip(`WP ${i+1}`, { direction: 'top' });
            waypointMarkers.push(m);
        }
    });
}

// ========== DRAW MODE ============
function toggleDrawRouteMode() {
    if (!selectedRouteId) {
        showToast('Please select a route first', 'error');
        return;
    }
    
    const btn = document.getElementById('drawRouteBtn');
    const banner = document.getElementById('drawInstructionsBanner');
    const route = allRoutes.find(r => String(r.id) === String(selectedRouteId));
    
    if (drawMode === 'route') {
        // TURN OFF
        drawMode = null;
        btn.classList.remove('active');
        btn.innerHTML = '<span class="material-icons" style="font-size: 16px;">timeline</span> Draw Route Path';
        banner.style.display = 'none';
        document.getElementById('mapCardContainer').style.cursor = '';
        renderDrawnPath(route.colorHex, false);
    } else {
        // TURN ON
        drawMode = 'route';
        btn.classList.add('active');
        btn.innerHTML = '<span class="material-icons" style="font-size: 16px;">close</span> Stop Drawing';
        banner.style.display = 'block';
        document.getElementById('mapCardContainer').style.cursor = 'crosshair';
        
        if (!unsavedChanges) unsavedChanges = [];
        renderDrawnPath(route.colorHex, true);
    }
}

function onMapClick(e) {
    if (drawMode === 'route' && selectedRouteId) {
        const route = allRoutes.find(r => String(r.id) === String(selectedRouteId));
        unsavedChanges.push([e.latlng.lat, e.latlng.lng]);
        renderDrawnPath(route.colorHex, true);
        document.getElementById('saveMapBtn').disabled = false;
    }
}

function clearPath() {
    if (!selectedRouteId) {
        showToast('Select a route to clear its path.', 'error');
        return;
    }
    
    confirmModal('Are you sure you want to clear all waypoints for this route? This cannot be undone.', () => {
        unsavedChanges = [];
        const route = allRoutes.find(r => String(r.id) === String(selectedRouteId));
        renderDrawnPath(route.colorHex, drawMode === 'route');
        document.getElementById('saveMapBtn').disabled = false;
    });
}

async function saveMapChanges() {
    if (!selectedRouteId || !unsavedChanges) return;
    
    const route = allRoutes.find(r => String(r.id) === String(selectedRouteId));
    
    try {
        document.getElementById('saveMapBtn').innerHTML = '<span class="material-icons spin">refresh</span>';
        
        const updateData = {
            name: route.name,
            nameKurdish: route.nameKurdish,
            colorHex: route.colorHex,
            status: route.status,
            description: route.description,
            isFavorite: route.isFavorite,
            waypoints: unsavedChanges
        };

        await api.routes.update(selectedRouteId, updateData);
        showToast('Route path saved ✅');
        
        // Refresh
        document.getElementById('saveMapBtn').innerHTML = '<span class="material-icons" style="font-size: 16px;">save</span> Save Path';
        document.getElementById('saveMapBtn').disabled = true;
        
        // Disable draw mode
        if (drawMode) toggleDrawRouteMode();
        
        await loadAll();
        // reselect
        selectRoute(selectedRouteId);
        
    } catch (err) {
        showToast('Failed to save path', 'error');
        document.getElementById('saveMapBtn').innerHTML = '<span class="material-icons" style="font-size: 16px;">save</span> Save Path';
    }
}

// ========== UTILS ==========
function fitAllStops() {
    if (!map || allStops.length === 0) return;
    const lats = allStops.map(s => s.latitude);
    const lngs = allStops.map(s => s.longitude);
    const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
    );
    map.fitBounds(bounds, { padding: [20, 20] });
}

function exportMap() {
    showToast('Exporting map view to PNG...');
    const container = document.getElementById('routeMapBuilder');
    // Using html2canvas
    if (window.html2canvas) {
        window.html2canvas(container, {
            useCORS: true,
            allowTaint: true
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `erbil-bus-map-${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error(err);
            showToast('Failed to export map', 'error');
        });
    } else {
        showToast('html2canvas library missing', 'error');
    }
}

// ========== BUS TRACKING ==========
function startBusPoller() {
    if (activeBusPoller) clearInterval(activeBusPoller);
    fetchAndRenderBuses();
    activeBusPoller = setInterval(fetchAndRenderBuses, 5000);
}

async function fetchAndRenderBuses() {
    try {
        allBuses = await api.buses.list();
        if (map) renderBuses();
    } catch (e) {
        console.error('Error fetching buses', e);
    }
}

function renderBuses() {
    // Clear old markers
    busMarkers.forEach(m => map.removeLayer(m));
    busMarkers = [];

    const activeRouteStr = selectedRouteId ? String(selectedRouteId) : null;
    
    allBuses.forEach(bus => {
        let opacity = 1;
        
        // Dim buses belonging to other routes
        if (activeRouteStr && String(bus.routeId) !== activeRouteStr) {
            opacity = 0.15;
        }

        const color = bus.route?.colorHex || '#333';
        
        let routeNum = 'B';
        if (bus.route && bus.route.name) {
            const match = bus.route.name.match(/\d+/);
            if (match) routeNum = match[0];
        }
        
        const busIcon = L.divIcon({
            html: `
            <div style="background-color: white; border: 3px solid ${color}; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); opacity: ${opacity}; transition: opacity 0.3s ease;">
                <span style="font-size: 13px; font-weight: 800; color: ${color};">${routeNum}</span>
            </div>`,
            className: 'custom-bus-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Add sliding animation transition for map tracking
        const m = L.marker([bus.latitude, bus.longitude], {
            icon: busIcon,
            zIndexOffset: opacity === 1 ? 2000 : 0
        }).addTo(map);

        if (m._icon) m._icon.style.transition = 'transform 1.0s linear'; // Smooth GPS drift interpolater 

        m.bindTooltip(`<b>Route: ${bus.route?.name || 'Unknown'}</b><br/>Bus ID: ${bus.id.slice(0,6)}<br/>Status: ${bus.status}<br/><i>Click to view route path</i>`, { direction: 'top' });
        
        // Add click listener to select the route when the bus is clicked
        m.on('click', () => {
             if (window.selectRoute) window.selectRoute(bus.routeId);
        });

        // Hover to show temporary route polyline
        let tempPolyline = null;
        let tempHighlightPolyline = null;
        let tempOutlinePolyline = null;
        m.on('mouseover', () => {
            if (activeRouteStr) return; // Do not draw if a route is firmly selected
            const route = allRoutes.find(r => String(r.id) === String(bus.routeId));
            if (route && route.waypoints) {
                try {
                    let wps = JSON.parse(route.waypoints);
                    if (typeof wps === 'string') wps = JSON.parse(wps);
                    if (Array.isArray(wps) && wps.length > 1) {
                        let warningColor = null;
                        if (route.status === 'DELAYED') {
                            warningColor = '#FF9800';
                        } else if (route.status === 'OUT_OF_SERVICE') {
                            warningColor = '#EF4444';
                        }

                        tempOutlinePolyline = L.polyline(wps, {
                            color: '#1f2937', weight: warningColor ? 8 : 7, opacity: 0.8, lineCap: 'round', lineJoin: 'round'
                        }).addTo(map);
                        
                        tempPolyline = L.polyline(wps, {
                            color: color,
                            weight: warningColor ? 6 : 5,
                            opacity: 1.0,
                            dashArray: warningColor ? null : '8 6',
                            lineCap: 'round', lineJoin: 'round'
                        }).addTo(map);

                        if (warningColor) {
                            tempHighlightPolyline = L.polyline(wps, {
                                color: warningColor, weight: 6, opacity: 1.0, dashArray: '12 18', lineCap: 'butt', lineJoin: 'round'
                            }).addTo(map);
                        }
                    }
                } catch(e) {}
            }
        });

        m.on('mouseout', () => {
            if (tempPolyline) {
                map.removeLayer(tempPolyline);
                tempPolyline = null;
            }
            if (tempHighlightPolyline) {
                map.removeLayer(tempHighlightPolyline);
                tempHighlightPolyline = null;
            }
            if (tempOutlinePolyline) {
                map.removeLayer(tempOutlinePolyline);
                tempOutlinePolyline = null;
            }
        });
        
        busMarkers.push(m);
    });
}

// ========== ROUTE CRUD MODAL ==========
window.openRouteModal = (id = null) => {
    const modal = document.getElementById('routeModal');
    const title = document.getElementById('routeModalTitle');
    const form = document.getElementById('routeForm');
    
    form.reset();
    document.getElementById('routeId').value = '';
    
    if (id) {
        title.textContent = 'Edit Route';
        const route = allRoutes.find(r => String(r.id) === String(id));
        if (route) {
            document.getElementById('routeId').value = route.id;
            document.getElementById('routeName').value = route.name;
            document.getElementById('routeNameKurdish').value = route.nameKurdish;
            document.getElementById('routeColorHex').value = route.colorHex || '#1877F2';
            document.getElementById('routeStatus').value = route.status || 'RUNNING';
            document.getElementById('routeDescription').value = route.description || '';
        }
    } else {
        title.textContent = 'Add New Route';
    }
    
    modal.classList.add('active');
};

window.closeRouteModal = () => {
    document.getElementById('routeModal').classList.remove('active');
};

// Init event listeners for Modal if elements exist
document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addRouteBtn');
    if (addBtn) addBtn.addEventListener('click', () => openRouteModal());
    
    const cancelBtn = document.getElementById('cancelRouteBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeRouteModal);
    
    const closeBtn = document.getElementById('closeRouteModalBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeRouteModal);
    
    const saveBtn = document.getElementById('saveRouteBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const id = document.getElementById('routeId').value;
            const data = {
                name: document.getElementById('routeName').value,
                nameKurdish: document.getElementById('routeNameKurdish').value,
                colorHex: document.getElementById('routeColorHex').value,
                status: document.getElementById('routeStatus').value,
                description: document.getElementById('routeDescription').value
            };
            
            if (!data.name || !data.nameKurdish) {
                showToast('Please fill all required fields', 'error');
                return;
            }
            
            const originalBtnText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<span class="material-icons spin">refresh</span>';
            saveBtn.disabled = true;
            
            try {
                if (id) {
                    await api.routes.update(id, data);
                    showToast('Route updated successfully ✅');
                } else {
                    await api.routes.create(data);
                    showToast('Route created successfully ✅');
                }
                closeRouteModal();
                await loadAll();
            } catch (err) {
                showToast(err.message || 'Failed to save route', 'error');
            } finally {
                saveBtn.innerHTML = originalBtnText;
                saveBtn.disabled = false;
            }
        });
    }
});

window.deleteRoute = (id) => {
    confirmModal('Are you sure you want to delete this route? This will cascade delete associated schedules and unset buses.', async () => {
        try {
            await api.routes.delete(id);
            showToast('Route deleted successfully 🗑️');
            if (String(selectedRouteId) === String(id)) selectRoute(null);
            await loadAll();
        } catch (err) {
            showToast(err.message || 'Failed to delete route', 'error');
        }
    });
};
