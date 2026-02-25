// 1. Setup Base Map Types
        const topoMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
        const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
        const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' });

        const map = L.map('map', { center: [12.8797, 121.7740], zoom: 6, layers: [topoMap] });

        const baseMaps = { "Topographic Map": topoMap, "Satellite Imagery": satelliteMap, "Street Map": streetMap };
        const overlayMaps = {}; 
        const layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);

        let landslideLayer = L.featureGroup().addTo(map);
        layerControl.addOverlay(landslideLayer, "🔴 CSV Landslide Points");

        // GLOBAL DATA STORES FOR KMZ MERGING
        let allGeoJsonOverlays = []; 
        let csvGeoJsonData = { type: "FeatureCollection", features: [] }; 

        // 2. GPS Location Functionality
        let userMarker;
        function locateUser() { map.locate({setView: true, maxZoom: 15}); }
        map.on('locationfound', function(e) {
            if (userMarker) { map.removeLayer(userMarker); }
            userMarker = L.circleMarker(e.latlng, { radius: 8, fillColor: '#3498db', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map);
            userMarker.bindPopup("<b>📍 You are here</b>").openPopup();
        });
        map.on('locationerror', function(e) { alert("Could not find your location."); });

        // 3. Handle GeoJSON URL Overlays
        let geojsonCounter = 1;
        function addGeoJson() {
            const urlInput = document.getElementById('geojsonUrl');
            const url = urlInput.value.trim();
            if (!url) { alert("Please enter a valid GeoJSON URL."); return; }

            const selectedLineColor = document.getElementById('geoLineColor').value;
            const selectedFillColor = document.getElementById('geoFillColor').value;
            const selectedOpacity = parseFloat(document.getElementById('geoOpacity').value);

            fetch(url)
                .then(res => { if (!res.ok) throw new Error("Network response was not OK"); return res.json(); })
                .then(data => {
                    // Inject simplestyle-spec properties so tokml preserves colors in the KMZ export!
                    if (data.features) {
                        data.features.forEach(f => {
                            if(!f.properties) f.properties = {};
                            f.properties['stroke'] = selectedLineColor;
                            f.properties['fill'] = selectedFillColor;
                            f.properties['stroke-opacity'] = 0.9;
                            f.properties['fill-opacity'] = selectedOpacity;
                            f.properties['name'] = `GeoJSON Feature ${geojsonCounter}`;
                        });
                        allGeoJsonOverlays.push(data); // Store for KMZ export
                    }

                    const newGeoLayer = L.geoJSON(data, {
                        style: function (feature) {
                            return { color: selectedLineColor, fillColor: selectedFillColor, weight: 2, opacity: 0.9, fillOpacity: selectedOpacity };
                        },
                        onEachFeature: function (feature, layer) {
                            if (feature.properties) {
                                let popupText = "<div class='popup-title'>🗺️ GeoJSON Feature</div>";
                                for (let key in feature.properties) {
                                    if(key !== 'stroke' && key !== 'fill' && !key.includes('opacity')) {
                                        popupText += `<div class='popup-row'><strong>${key}:</strong> ${feature.properties[key]}</div>`;
                                    }
                                }
                                feature.properties['description'] = popupText; // Save HTML for Google Earth
                                layer.bindPopup(`<div class="custom-popup">${popupText}</div>`);
                            }
                        }
                    }).addTo(map);

                    let layerName = `<span style="color:${selectedFillColor}">⬛</span> GeoJSON Overlay ` + geojsonCounter;
                    layerControl.addOverlay(newGeoLayer, layerName);
                    geojsonCounter++;
                    map.fitBounds(newGeoLayer.getBounds(), { padding: [50, 50] });
                    urlInput.value = ''; 
                })
                .catch(error => { alert("Error loading GeoJSON: " + error.message); });
        }

        // 4. Handle CSV File Upload
        document.getElementById('csvFileInput').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            Papa.parse(file, { header: true, dynamicTyping: true, skipEmptyLines: true, complete: function(results) { processLandslideData(results.data); } });
        });

        // 5. Process the CSV Data
        function processLandslideData(data) {
            landslideLayer.clearLayers(); 
            csvGeoJsonData.features = []; // Clear old export data

            let totalCount = 0; let totalAreaSqm = 0; let maxRain = 0;

            data.forEach(row => {
                if (row.Latitude && row.Longitude) {
                    let areaHectares = (row.Area_sq_meters / 10000).toFixed(2);
                    totalAreaSqm += row.Area_sq_meters;
                    totalCount++;
                    if (row.Event_Rain_mm > maxRain) { maxRain = row.Event_Rain_mm; }

                    let popupContent = `
                        <div class="custom-popup">
                            <div class="popup-title">⚠️ Landslide Zone</div>
                            <div class="popup-row"><strong>Location:</strong> ${row.Province}, ${row.Municipality}</div>
                            <div class="popup-row"><strong>Barangay:</strong> ${row.Barangay}</div>
                            <div class="popup-row"><strong>Trigger Date:</strong> ${row.Estimated_Trigger_Date}</div>
                            <div class="popup-row"><strong>Area:</strong> ${areaHectares} Hectares</div>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 5px 0;">
                            <div class="popup-row"><strong>Event Rain:</strong> ${row.Event_Rain_mm ? row.Event_Rain_mm.toFixed(1) : 0} mm</div>
                            <div class="popup-row"><strong>Moisture:</strong> ${row.Antecedent_Rain_mm ? row.Antecedent_Rain_mm.toFixed(1) : 0} mm</div>
                        </div>
                    `;

                    // Store as valid GeoJSON for KMZ Export
                    csvGeoJsonData.features.push({
                        type: "Feature",
                        properties: {
                            name: `Landslide: ${row.Barangay}`,
                            description: popupContent,
                            'marker-color': '#e74c3c',
                            'marker-size': 'small'
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [row.Longitude, row.Latitude] // GeoJSON expects [Lon, Lat]
                        }
                    });

                    let marker = L.circleMarker([row.Latitude, row.Longitude], {
                        radius: 6, fillColor: "#FF7F11", color: "#FF7F11", weight: 1, opacity: 1, fillOpacity: 0.8
                    });

                    marker.bindPopup(popupContent);
                    landslideLayer.addLayer(marker);
                }
            });

            if (totalCount > 0) {
                document.getElementById('stats-container').style.display = 'block';
                document.getElementById('stat-count').innerText = totalCount.toLocaleString();
                document.getElementById('stat-area').innerText = (totalAreaSqm / 10000).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1});
                document.getElementById('stat-rain').innerText = maxRain.toFixed(1);
                map.fitBounds(landslideLayer.getBounds(), { padding: [50, 50] });
            }
        }

        // 6. MASTER ENGINE: Combine & Export to KMZ
        function exportToKMZ() {
            if (csvGeoJsonData.features.length === 0 && allGeoJsonOverlays.length === 0) {
                alert("No data layers to export! Please upload a CSV or load a GeoJSON first.");
                return;
            }

            let btn = document.getElementById('kmz-btn');
            btn.innerText = "⏳ Generating KMZ...";

            // Combine the arrays
            let combinedFeatures = [...csvGeoJsonData.features];
            allGeoJsonOverlays.forEach(layer => {
                if (layer.features) { combinedFeatures = combinedFeatures.concat(layer.features); }
            });

            let finalGeoJson = { type: "FeatureCollection", features: combinedFeatures };

            try {
                // Convert to KML String using tokml (simplestyle: true ensures colors carry over!)
                let kmlString = tokml(finalGeoJson, { name: 'name', description: 'description', simplestyle: true });

                // Zip the KML file into a KMZ archive
                let zip = new JSZip();
                zip.file("doc.kml", kmlString);
                zip.generateAsync({type:"blob"}).then(function(content) {
                    // Trigger silent download
                    let link = document.createElement('a');
                    link.href = URL.createObjectURL(content);
                    link.download = "LIGTAS_AGAD_COMBINED_LAYERS.kmz";
                    link.click();
                    btn.innerText = "📥 Combine & Download KMZ";
                });
            } catch (error) {
                alert("Error generating KMZ file: " + error.message);
                btn.innerText = "📥 Combine & Download KMZ";
            }
        }