const topoMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
        const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
        const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' });

        const map = L.map('map', { center: [12.8797, 121.7740], zoom: 6, layers: [topoMap] });
        L.control.scale({position: 'bottomleft', metric: true, imperial: false}).addTo(map);

        const baseMaps = { "Topographic Map": topoMap, "Satellite Imagery": satelliteMap, "Street Map": streetMap };
        const overlayMaps = {}; 
        const layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);

        let landslideLayer = L.featureGroup().addTo(map);
        layerControl.addOverlay(landslideLayer, "Landslide Points");

        // GLOBAL DATA STORES
        let activeGeoJsonLeafletLayers = []; 
        let allGeoJsonOverlays = [];         
        let layerStylesConfig = []; 
        let csvGeoJsonData = { type: "FeatureCollection", features: [] }; 

        // 2. MULTI-LAYER STYLING LOGIC
        function loadSelectedLayerStyles() {
            let val = document.getElementById('layerSelector').value;
            if (val === "new") return; 

            let index = parseInt(val);
            let s = layerStylesConfig[index];

            document.getElementById('geoLineColor').value = s.lineCol;
            document.getElementById('geoFillColor').value = s.fillCol;
            document.getElementById('geoOpacity').value = s.opac;
            document.getElementById('opacityVal').innerText = s.opac;

            document.getElementById('legend-geojson-box').style.background = s.fillCol;
            document.getElementById('legend-geojson-box').style.borderColor = s.lineCol;
        }

        function updateLiveGeoJsonStyles() {
            let val = document.getElementById('layerSelector').value;
            const lineCol = document.getElementById('geoLineColor').value;
            const fillCol = document.getElementById('geoFillColor').value;
            const opac = parseFloat(document.getElementById('geoOpacity').value);

            document.getElementById('legend-geojson-box').style.background = fillCol;
            document.getElementById('legend-geojson-box').style.borderColor = lineCol;

            if (val === "new") return;

            let index = parseInt(val);
            layerStylesConfig[index].lineCol = lineCol;
            layerStylesConfig[index].fillCol = fillCol;
            layerStylesConfig[index].opac = opac;

            activeGeoJsonLeafletLayers[index].setStyle({ color: lineCol, fillColor: fillCol, opacity: 0.9, fillOpacity: opac });

            if (allGeoJsonOverlays[index].features) {
                allGeoJsonOverlays[index].features.forEach(f => {
                    if (f.properties) {
                        f.properties['stroke'] = lineCol;
                        f.properties['fill'] = fillCol;
                        f.properties['fill-opacity'] = opac;
                    }
                });
            } else if (allGeoJsonOverlays[index].type === "Feature" && allGeoJsonOverlays[index].properties) {
                allGeoJsonOverlays[index].properties['stroke'] = lineCol;
                allGeoJsonOverlays[index].properties['fill'] = fillCol;
                allGeoJsonOverlays[index].properties['fill-opacity'] = opac;
            }

            let iconSpan = document.getElementById(`layer-icon-${index}`);
            if(iconSpan) { iconSpan.style.color = fillCol; }
        }

        function updateLiveCsvStyles() {
            const markerCol = document.getElementById('csvMarkerColor').value;
            landslideLayer.eachLayer(layer => { layer.setStyle({ fillColor: markerCol, color: markerCol }); });
            csvGeoJsonData.features.forEach(f => { if (f.properties) { f.properties['marker-color'] = markerCol; } });
            document.getElementById('legend-csv-circle').style.background = markerCol;
            document.getElementById('legend-csv-circle').style.borderColor = markerCol;
        }

        // 3. GPS Location
        let userMarker;
        function locateUser() { map.locate({setView: true, maxZoom: 15}); }
        map.on('locationfound', function(e) {
            if (userMarker) { map.removeLayer(userMarker); }
            userMarker = L.circleMarker(e.latlng, { radius: 8, fillColor: '#3498db', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map);
            userMarker.bindPopup("<b>📍 You are here</b>").openPopup();
        });
        map.on('locationerror', function(e) { alert("Could not find your location."); });

        // 4. GeoJSON Processing Engine
        let geojsonCounter = 1;

        function processGeoJsonData(data, sourceName) {
            const lineCol = document.getElementById('geoLineColor').value;
            const fillCol = document.getElementById('geoFillColor').value;
            const opac = parseFloat(document.getElementById('geoOpacity').value);
            const currentIndex = activeGeoJsonLeafletLayers.length;

            if (data.features) {
                data.features.forEach(f => {
                    if(!f.properties) f.properties = {};
                    f.properties['stroke'] = lineCol;
                    f.properties['fill'] = fillCol;
                    f.properties['stroke-opacity'] = 0.9;
                    f.properties['fill-opacity'] = opac;
                    f.properties['name'] = sourceName;
                });
            } else if (data.type === "Feature") {
                if(!data.properties) data.properties = {};
                data.properties['stroke'] = lineCol;
                data.properties['fill'] = fillCol;
                data.properties['stroke-opacity'] = 0.9;
                data.properties['fill-opacity'] = opac;
                data.properties['name'] = sourceName;
            }
            
            allGeoJsonOverlays.push(data); 
            layerStylesConfig.push({ lineCol, fillCol, opac, name: sourceName });

            const newGeoLayer = L.geoJSON(data, {
                style: function (feature) {
                    return { color: lineCol, fillColor: fillCol, weight: 2, opacity: 0.9, fillOpacity: opac };
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties) {
                        let popupText = "<div class='popup-title'>🗺️ GeoJSON Feature</div>";
                        for (let key in feature.properties) {
                            if(key !== 'stroke' && key !== 'fill' && !key.includes('opacity') && key !== 'name' && key !== 'description') {
                                popupText += `<div class='popup-row'><strong>${key}:</strong> ${feature.properties[key]}</div>`;
                            }
                        }
                        feature.properties['description'] = popupText; 
                        layer.bindPopup(`<div class="custom-popup">${popupText}</div>`);
                    }
                }
            }).addTo(map);

            activeGeoJsonLeafletLayers.push(newGeoLayer); 
            
            let layerName = `<span id="layer-icon-${currentIndex}" style="color:${fillCol}">⬛</span> GeoJSON (${sourceName})`;
            layerControl.addOverlay(newGeoLayer, layerName);
            
            let selector = document.getElementById('layerSelector');
            let newOption = document.createElement('option');
            newOption.value = currentIndex;
            newOption.innerHTML = `${geojsonCounter}. ${sourceName}`;
            selector.appendChild(newOption);
            selector.value = currentIndex;

            geojsonCounter++;
            map.fitBounds(newGeoLayer.getBounds(), { padding: [50, 50] });
        }

        function addGeoJsonUrl() {
            const urlInput = document.getElementById('geojsonUrl');
            const url = urlInput.value.trim();
            if (!url) { alert("Please enter a valid GeoJSON URL."); return; }

            fetch(url)
                .then(res => { if (!res.ok) throw new Error("Network response was not OK"); return res.json(); })
                .then(data => {
                    processGeoJsonData(data, `URL Layer`);
                    urlInput.value = ''; 
                })
                .catch(error => { alert("Error loading GeoJSON: " + error.message); });
        }

        document.getElementById('geojsonFileInput').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = JSON.parse(event.target.result);
                    processGeoJsonData(data, file.name);
                } catch(err) { alert("Invalid GeoJSON file."); }
            };
            reader.readAsText(file);
            e.target.value = ''; 
        });

        // 5. CSV File Upload Processing
        document.getElementById('csvFileInput').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            Papa.parse(file, { header: true, dynamicTyping: true, skipEmptyLines: true, complete: function(results) { processLandslideData(results.data); } });
            e.target.value = ''; 
        });

        function processLandslideData(data) {
            landslideLayer.clearLayers(); 
            csvGeoJsonData.features = []; 

            let totalCount = 0; let totalAreaSqm = 0; let maxRain = 0;
            const markerCol = document.getElementById('csvMarkerColor').value;

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

                    csvGeoJsonData.features.push({
                        type: "Feature",
                        properties: { name: `Landslide: ${row.Barangay}`, description: popupContent, 'marker-color': markerCol, 'marker-size': 'small' },
                        geometry: { type: "Point", coordinates: [row.Longitude, row.Latitude] }
                    });

                    let marker = L.circleMarker([row.Latitude, row.Longitude], {
                        radius: 6, fillColor: markerCol, color: markerCol, weight: 1, opacity: 1, fillOpacity: 0.8
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

        // 6. MAP LEGEND
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            const initCsvCol = document.getElementById('csvMarkerColor').value;
            const initGeoLine = document.getElementById('geoLineColor').value;
            const initGeoFill = document.getElementById('geoFillColor').value;

            div.innerHTML += '<h4>Map Legend</h4>';
            div.innerHTML += `<i id="legend-csv-circle" class="legend-circle" style="background: ${initCsvCol}; border-color: ${initCsvCol};"></i> Landslide Zones (CSV)<br>`;
            div.innerHTML += `<i id="legend-geojson-box" class="legend-box" style="background: ${initGeoFill}; border-color: ${initGeoLine}; opacity: 0.7;"></i> Selected GeoJSON<br>`;
            div.innerHTML += '<i class="legend-circle" style="background: #3498db; border-color: #fff; border-width: 2px;"></i> GPS Location<br>';
            return div;
        };
        legend.addTo(map);

        // 7. ROBUST EXPORT ENGINE (GeoJSON & CSV Independent)
        function exportToKMZ() {
            let combinedFeatures = [];

            // 1. Add CSV points if any exist
            if (csvGeoJsonData && csvGeoJsonData.features.length > 0) {
                combinedFeatures = combinedFeatures.concat(csvGeoJsonData.features);
            }

            // 2. Add GeoJSON layers if any exist (handles both Collections and single Features)
            allGeoJsonOverlays.forEach(layer => {
                if (layer.features) { 
                    combinedFeatures = combinedFeatures.concat(layer.features); 
                } else if (layer.type === "Feature") {
                    combinedFeatures.push(layer);
                }
            });

            if (combinedFeatures.length === 0) {
                alert("No data to export! Please upload a CSV or load a GeoJSON file first.");
                return;
            }

            let btn = document.getElementById('kmz-btn');
            btn.innerText = "⏳ Generating KMZ...";

            let finalGeoJson = { type: "FeatureCollection", features: combinedFeatures };

            try {
                let kmlString = tokml(finalGeoJson, { name: 'name', description: 'description', simplestyle: true });
                let zip = new JSZip();
                zip.file("doc.kml", kmlString);
                zip.generateAsync({type:"blob"}).then(function(content) {
                    let link = document.createElement('a');
                    link.href = URL.createObjectURL(content);
                    link.download = "LIGTAS_AGAD_MAP_DATA.kmz";
                    link.click();
                    btn.innerText = "📥 Download Map as KMZ";
                });
            } catch (error) {
                alert("Error generating KMZ file: " + error.message);
                btn.innerText = "📥 Download Map as KMZ";
            }
        }

        function printMapToPDF() {
            document.getElementById('sidebar').style.display = 'none';
            map.invalidateSize(); 
            setTimeout(() => {
                window.print();
                document.getElementById('sidebar').style.display = 'flex';
                map.invalidateSize();
            }, 800);
        }