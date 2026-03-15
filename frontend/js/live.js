import { api } from './api.js';
import { initGlobalUI, showToast } from './shared.js';
import './auth.js';

let map;
let busMarkers = {};
let stopMarkers = [];
let refreshInterval;

document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    initMap();
    loadLiveMapData();
    
    // Auto-refresh buses every 5 seconds for smoother tracking
    refreshInterval = setInterval(updateBusesSilent, 5000);
});

function initMap() {
    // Erbil center coordinates
    map = L.map('liveMap').setView([36.1901, 44.0091], 13);

    // Modern bright map style matching app vibes
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
}

async function loadLiveMapData() {
    try {
        const [stops, buses] = await Promise.all([
            api.stops.list(),
            api.buses.list()
        ]);

        // Draw Stops as small subtle dots
        stops.forEach(stop => {
            const marker = L.circleMarker([stop.latitude, stop.longitude], {
                radius: 5,
                fillColor: "#ffffff",
                color: "#94a3b8",
                weight: 2,
                opacity: 0.8,
                fillOpacity: 1
            }).addTo(map);
            
            marker.bindPopup(`<b style="font-size: 14px;">${stop.name}</b>`, { className: 'bus-popup' });
            stopMarkers.push(marker);
        });

        // Initial buses draw
        renderBuses(buses);
    } catch (err) {
        showToast('Failed to load map data', 'error');
        console.error(err);
    }
}

async function updateBusesSilent() {
    try {
        // Spin the live indicator symbol slightly
        const ind = document.getElementById('liveIndicator');
        if (ind) {
            ind.style.transform = 'rotate(180deg)';
            ind.style.transition = 'transform 0.5s ease';
            setTimeout(() => { ind.style.transform = 'rotate(0deg)'; }, 500);
        }

        const buses = await api.buses.list();
        renderBuses(buses);
    } catch (err) {
        console.error('Failed to silent update buses on map', err);
    }
}

function renderBuses(buses) {
    buses.forEach(b => {
        const color = b.route ? b.route.colorHex : '#1877F2';
        
        // Custom HTML marker for Bus with its route color
        const iconHtml = `
            <div class="bus-marker" style="background-color: ${color}; width: 36px; height: 36px;">
                <span class="material-icons" style="font-size: 20px;">directions_bus</span>
            </div>
        `;
        
        const customIcon = L.divIcon({
            html: iconHtml,
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -20]
        });

        const routeName = b.route ? b.route.name : 'Unknown Route';
        const statusStr = b.status === 'RUNNING' ? 'Running' : b.status === 'DELAYED' ? 'Delayed' : 'Out of Service';
        const nextStopStr = b.nextStopName ? `<br><span style="font-size: 13px; color: #64748b;">Next: ${b.nextStopName}</span>` : '';
        
        const popupContent = `
            <div style="text-align: center; min-width: 120px;">
                <b style="font-size: 15px; color: ${color};">${routeName}</b><br>
                <span style="font-size: 13px; color: #475569; font-family: monospace; font-weight: bold;">[${b.id.substring(b.id.length-6).toUpperCase()}]</span><br>
                <span style="font-size: 13px; font-weight: bold; margin-top: 4px; display: inline-block;">Status: ${statusStr}</span>
                ${nextStopStr}
            </div>
        `;

        if (busMarkers[b.id]) {
            // Animate to new position via setLatLng
            busMarkers[b.id].setLatLng([b.latitude, b.longitude]);
            busMarkers[b.id].setIcon(customIcon);
            busMarkers[b.id].setPopupContent(popupContent);
        } else {
            // Create new marker
            const marker = L.marker([b.latitude, b.longitude], { icon: customIcon }).addTo(map);
            marker.bindPopup(popupContent, { className: 'bus-popup' });
            busMarkers[b.id] = marker;
        }
    });
    
    // Remove old markers if a bus was deleted
    const currentIds = buses.map(b => b.id);
    Object.keys(busMarkers).forEach(id => {
        if (!currentIds.includes(id)) {
            map.removeLayer(busMarkers[id]);
            delete busMarkers[id];
        }
    });
}
