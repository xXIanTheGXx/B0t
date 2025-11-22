document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([20, 0], 2);

    // Dark theme tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    const markers = L.markerClusterGroup();

    fetch('/api/map')
        .then(res => res.json())
        .then(data => {
            data.features.forEach(feature => {
                const [lon, lat] = feature.geometry.coordinates;
                const props = feature.properties;

                const marker = L.marker([lat, lon]);
                marker.bindPopup(`
                    <b>${props.ip}:${props.port}</b><br>
                    Ver: ${props.version}<br>
                    Players: ${props.players}<br>
                    Loc: ${props.city}, ${props.country}
                `);
                markers.addLayer(marker);
            });
            map.addLayer(markers);
        })
        .catch(err => console.error('Failed to load map data:', err));
});
