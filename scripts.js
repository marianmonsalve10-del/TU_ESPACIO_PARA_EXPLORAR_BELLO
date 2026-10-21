 var map = L.map('map', {
  zoomControl: false,
  preferCanvas: true
}).setView([6.337, -75.558], 13);

L.control.zoom({ position: 'bottomleft' }).addTo(map);
L.control.scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 110 }).addTo(map);
var coordinateReadout;
var coordinateControl = L.control({ position: 'bottomleft' });
coordinateControl.onAdd = function () {
  coordinateReadout = L.DomUtil.create('div', 'map-coordinate-control');
  coordinateReadout.setAttribute('role', 'status');
  coordinateReadout.setAttribute('aria-live', 'off');
  coordinateReadout.setAttribute('aria-label', 'Coordenadas geográficas bajo el cursor');
  return coordinateReadout;
};
coordinateControl.addTo(map);
function mostrarCoordenadas(latlng) {
  if (!coordinateReadout || !latlng) return;
  coordinateReadout.textContent = 'Lat ' + latlng.lat.toFixed(5) + ' · Lon ' + latlng.lng.toFixed(5);
}
mostrarCoordenadas(map.getCenter());
map.on('mousemove', function (event) { mostrarCoordenadas(event.latlng); });

var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
var mapLegend = document.getElementById('mapLegend');
var mapLegendContent = document.getElementById('mapLegendContent');
var polygonDrawHandler = null;
var measurementDrawHandler = null;
var measurementMode = null;
var measurementCompleted = false;
var measureDistanceBtn = document.getElementById('measureDistanceBtn');
var measureAreaBtn = document.getElementById('measureAreaBtn');
var measureDistanceUnit = document.getElementById('measureDistanceUnit');
var measureAreaUnit = document.getElementById('measureAreaUnit');
var measureMessage = document.getElementById('measureMessage');
function actualizarBotonDibujo(activo) {
  if (!drawPolygonBtn) return;
  drawPolygonBtn.textContent = activo ? 'Cancelar polígono' : 'Crear polígono';
  drawPolygonBtn.setAttribute('aria-pressed', activo ? 'true' : 'false');
  drawPolygonBtn.title = activo ? 'Cancela el dibujo actual' : 'Dibuja un polígono sobre el mapa';
  drawPolygonBtn.classList.toggle('drawing', activo);
}
map.on(L.Draw.Event.CREATED, function (event) {
  var measurementLabel = null;
  if (measurementMode) {
    measurementCompleted = true;
    event.layer._measurementType = measurementMode;
    var color = measurementMode === 'distance' ? '#168b91' : '#d76a3d';
    event.layer.setStyle({ color: color, weight: 3, fillColor: color, fillOpacity: .18 });
    var result = calcularMedicion(event.layer, measurementMode);
    measurementLabel = result.label;
    event.layer.bindTooltip(measurementLabel, { permanent: true, direction: 'center', className: 'measurement-tooltip' });
    if (measureMessage) measureMessage.textContent = result.message;
  }
  drawnItems.addLayer(event.layer);
  if (measurementLabel) event.layer.openTooltip();
  actualizarBotonBorrar();
  actualizarLeyendaMapa();
});
map.on(L.Draw.Event.DELETED, function () {
  actualizarBotonBorrar();
  actualizarLeyendaMapa();
});
map.on(L.Draw.Event.EDITED, function (event) {
  event.layers.eachLayer(function (layer) {
    if (!layer._measurementType) return;
    var result = calcularMedicion(layer, layer._measurementType);
    if (layer.getTooltip()) layer.setTooltipContent(result.label);
    if (measureMessage) measureMessage.textContent = result.message;
  });
  actualizarLeyendaMapa();
});
map.on(L.Draw.Event.DRAWSTART, function (event) {
  if (event.layerType === 'polygon' && !measurementMode) actualizarBotonDibujo(true);
});
map.on(L.Draw.Event.DRAWSTOP, function () {
  actualizarBotonDibujo(false);
  polygonDrawHandler = null;
  if (measurementMode && !measurementCompleted && measureMessage) measureMessage.textContent = 'Medición cancelada.';
  measurementDrawHandler = null;
  measurementMode = null;
  measurementCompleted = false;
  [measureDistanceBtn, measureAreaBtn].forEach(function (button) {
    if (button) {
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
    }
  });
});
if (L.drawLocal && L.drawLocal.draw && L.drawLocal.draw.handlers) {
  var polygonTooltip = L.drawLocal.draw.handlers.polygon.tooltip;
  var polylineTooltip = L.drawLocal.draw.handlers.polyline.tooltip;
  polygonTooltip.start = 'Haz clic para comenzar a dibujar el contorno.';
  polygonTooltip.cont = 'Haz clic para añadir un punto.';
  polygonTooltip.end = 'Haz clic en el primer punto o haz doble clic para terminar.';
  polylineTooltip.start = 'Haz clic para comenzar a medir la distancia.';
  polylineTooltip.cont = 'Haz clic para continuar; haz doble clic para terminar.';
  polylineTooltip.end = 'Haz doble clic para terminar la medición.';
}

var drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems,
    remove: true
  },
  draw: {
    polygon: {
      allowIntersection: false,
      showArea: true,
      shapeOptions: {
        color: '#8adbff',
        weight: 2,
        fillColor: '#4aa6ff',
        fillOpacity: 0.2
      }
    },
    polyline: {
      shapeOptions: {
        color: '#8adbff',
        weight: 3
      }
    },
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false,
    polyline: {
      showLength: true,
      metric: true,
      feet: false,
      shapeOptions: {
        color: '#8adbff',
        weight: 3
      }
    }
  }
});
map.addControl(drawControl);

var drawPolygonBtn = document.getElementById('drawPolygonBtn');
var clearPolygonsBtn = document.getElementById('clearPolygonsBtn');
function actualizarBotonBorrar() {
  if (clearPolygonsBtn) clearPolygonsBtn.disabled = drawnItems.getLayers().length === 0;
}

function formatearDistancia(metros) {
  var number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
  var unidad = measureDistanceUnit ? measureDistanceUnit.value : 'm';
  var factores = { m: 1, km: 1000, mi: 1609.344 };
  return number.format(metros / factores[unidad]) + ' ' + unidad;
}

function formatearArea(metrosCuadrados) {
  var number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
  var unidad = measureAreaUnit ? measureAreaUnit.value : 'm2';
  var factores = { m2: 1, ha: 10000, km2: 1000000, ac: 4046.8564224 };
  var etiquetas = { m2: 'm²', ha: 'ha', km2: 'km²', ac: 'ac' };
  return number.format(metrosCuadrados / factores[unidad]) + ' ' + etiquetas[unidad];
}

function calcularMedicion(layer, tipo) {
  var latlngs = layer.getLatLngs();
  if (tipo === 'distance') {
    var total = 0;
    for (var i = 1; i < latlngs.length; i += 1) total += latlngs[i - 1].distanceTo(latlngs[i]);
    var distancia = formatearDistancia(total);
    return { label: distancia, message: 'Distancia medida: ' + distancia + '.' };
  }
  var anilloExterior = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
  var area = L.GeometryUtil.geodesicArea(anilloExterior);
  var areaFormateada = formatearArea(area);
  return { label: areaFormateada, message: 'Área medida: ' + areaFormateada + '.' };
}

function actualizarUnidadesMedicion() {
  drawnItems.eachLayer(function (layer) {
    if (!layer._measurementType) return;
    var result = calcularMedicion(layer, layer._measurementType);
    if (layer.getTooltip()) layer.setTooltipContent(result.label);
  });
  if (measureMessage) {
    var mediciones = drawnItems.getLayers().filter(function (layer) { return !!layer._measurementType; });
    var ultima = mediciones[mediciones.length - 1];
    if (ultima) measureMessage.textContent = calcularMedicion(ultima, ultima._measurementType).message;
  }
}
if (measureDistanceUnit) measureDistanceUnit.addEventListener('change', actualizarUnidadesMedicion);
if (measureAreaUnit) measureAreaUnit.addEventListener('change', actualizarUnidadesMedicion);

function iniciarMedicion(tipo, boton) {
  if (measurementDrawHandler) {
    if (measurementMode === tipo) {
      measurementDrawHandler.disable();
      return;
    }
    measurementDrawHandler.disable();
  }
  if (polygonDrawHandler) polygonDrawHandler.disable();
  measurementMode = tipo;
  measurementCompleted = false;
  var options = tipo === 'distance'
    ? drawControl.options.draw.polyline
    : drawControl.options.draw.polygon;
  measurementDrawHandler = tipo === 'distance'
    ? new L.Draw.Polyline(map, Object.assign({}, options, { showLength: true, metric: true }))
    : new L.Draw.Polygon(map, Object.assign({}, options, { showArea: true }));
  if (measureDistanceBtn) measureDistanceBtn.classList.toggle('active', tipo === 'distance');
  if (measureAreaBtn) measureAreaBtn.classList.toggle('active', tipo === 'area');
  if (boton) boton.setAttribute('aria-pressed', 'true');
  if (measureMessage) measureMessage.textContent = tipo === 'distance'
    ? 'Traza la ruta sobre el mapa; termina con doble clic.'
    : 'Marca el contorno del área; termina con doble clic.';
  measurementDrawHandler.enable();
}

if (measureDistanceBtn) measureDistanceBtn.addEventListener('click', function () { iniciarMedicion('distance', this); });
if (measureAreaBtn) measureAreaBtn.addEventListener('click', function () { iniciarMedicion('area', this); });

function agregarFilaLeyenda(contenedor, nombre, colorLinea, colorRelleno, geometria) {
  var row = document.createElement('div');
  row.className = 'map-legend-row';
  var symbol = document.createElement('span');
  symbol.className = 'map-legend-symbol';
  if (/^(Multi)?LineString$/.test(geometria || '') || (!colorRelleno && !/^(Multi)?Point$/.test(geometria || ''))) symbol.classList.add('is-line');
  if (/^(Multi)?Point$/.test(geometria || '')) symbol.classList.add('is-point');
  symbol.style.setProperty('--legend-stroke', colorLinea || colorRelleno || '#52758e');
  symbol.style.setProperty('--legend-fill', colorRelleno || colorLinea || '#52758e');
  var label = document.createElement('span');
  label.textContent = nombre;
  row.append(symbol, label);
  contenedor.appendChild(row);
}

function actualizarLeyendaMapa() {
  if (!mapLegend || !mapLegendContent) return;
  mapLegendContent.replaceChildren();
  var capasActivas = Object.keys(capas).filter(function (name) { return map.hasLayer(capas[name]); });
  capasActivas.forEach(function (name) {
    var layer = capas[name];
    var section = document.createElement('section');
    section.className = 'map-legend-layer';
    var heading = document.createElement('h3');
    heading.textContent = name;
    section.appendChild(heading);
    if (layer._classification) {
      var classifiedFeature = (layer._attributeFeatures || []).find(function (item) { return item.geometry; });
      var classifiedGeometry = classifiedFeature && classifiedFeature.geometry.type;
      layer._classification.groups.forEach(function (group, index) {
        agregarFilaLeyenda(section, group.label, layer._classification.colors[index], layer._classification.colors[index], classifiedGeometry);
      });
    } else {
      var style = layer._styleFunction ? layer._styleFunction() : {};
      var feature = (layer._attributeFeatures || []).find(function (item) { return item.geometry; });
      var geometry = feature && feature.geometry.type;
      agregarFilaLeyenda(section, 'Elementos', style.color, style.fillColor, geometry);
    }
    mapLegendContent.appendChild(section);
  });
  if (drawnItems.getLayers().length) {
    var drawingSection = document.createElement('section');
    drawingSection.className = 'map-legend-layer';
    var drawingHeading = document.createElement('h3');
    drawingHeading.textContent = 'Dibujos y mediciones';
    drawingSection.appendChild(drawingHeading);
    var manualLayers = drawnItems.getLayers();
    if (manualLayers.some(function (item) { return !item._measurementType && item instanceof L.Polygon; })) agregarFilaLeyenda(drawingSection, 'Polígono dibujado', '#8adbff', '#4aa6ff', 'Polygon');
    if (manualLayers.some(function (item) { return !item._measurementType && !(item instanceof L.Polygon); })) agregarFilaLeyenda(drawingSection, 'Línea dibujada', '#8adbff', null, 'LineString');
    if (manualLayers.some(function (item) { return item._measurementType === 'distance'; })) agregarFilaLeyenda(drawingSection, 'Distancia medida', '#168b91', null, 'LineString');
    if (manualLayers.some(function (item) { return item._measurementType === 'area'; })) agregarFilaLeyenda(drawingSection, 'Área medida', '#d76a3d', '#d76a3d', 'Polygon');
    mapLegendContent.appendChild(drawingSection);
  }
  if (capasActivas.length === 0 && drawnItems.getLayers().length === 0) {
    var emptyMessage = document.createElement('p');
    emptyMessage.className = 'map-legend-empty';
    emptyMessage.textContent = 'Activa una capa o dibuja un polígono para ver aquí sus símbolos y colores.';
    mapLegendContent.appendChild(emptyMessage);
  }
  mapLegend.hidden = false;
}
if (drawPolygonBtn) {
  drawPolygonBtn.addEventListener('click', function () {
    if (polygonDrawHandler) {
      polygonDrawHandler.disable();
      return;
    }
    if (measurementDrawHandler) measurementDrawHandler.disable();
    polygonDrawHandler = new L.Draw.Polygon(map, drawControl.options.draw.polygon);
    polygonDrawHandler.enable();
  });
}
if (clearPolygonsBtn) {
  clearPolygonsBtn.addEventListener('click', function () {
    if (polygonDrawHandler) polygonDrawHandler.disable();
    if (measurementDrawHandler) measurementDrawHandler.disable();
    drawnItems.clearLayers();
    actualizarBotonBorrar();
    actualizarLeyendaMapa();
  });
}

var OpenStreetMap_France = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap France | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
OpenStreetMap_France.addTo(map);

var Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

var Esri_WorldStreetMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
});

var basemaps = {
  'Mapa de calles': OpenStreetMap_France,
  'Imagen satelital': Esri_WorldImagery,
  'Mapa vial': Esri_WorldStreetMap
};

var capas = {};
var limitesRasters = L.latLngBounds();
var basemapList = document.getElementById('basemapList');

if (basemapList) {
  Object.keys(basemaps).forEach(function (basemapName, index) {
    var label = document.createElement('label');
    label.className = 'basemap-option';

    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'basemap';
    input.value = basemapName;
    input.checked = map.hasLayer(basemaps[basemapName]);
    input.setAttribute('aria-label', basemapName);
    input.addEventListener('change', function () {
      if (!input.checked) return;

      Object.keys(basemaps).forEach(function (name) {
        if (map.hasLayer(basemaps[name])) {
          map.removeLayer(basemaps[name]);
        }
      });
      basemaps[basemapName].addTo(map);
    });

    var text = document.createElement('span');
    text.textContent = basemapName;

    label.appendChild(input);
    label.appendChild(text);
    basemapList.appendChild(label);
  });
}

var placeSearchForm = document.getElementById('placeSearchForm');
var placeSearchInput = document.getElementById('placeSearchInput');
var placeSearchStatus = document.getElementById('placeSearchStatus');
var placeSearchResults = document.getElementById('placeSearchResults');
var geocoderEndpointInput = document.getElementById('geocoderEndpoint');
var saveGeocoderEndpoint = document.getElementById('saveGeocoderEndpoint');
var defaultGeocoderEndpoint = 'https://nominatim.openstreetmap.org/search';
var geocoderEndpointKey = 'geovisorBello.geocoderEndpoint';
var geocoderCache = new Map();
var lastGeocoderRequestAt = 0;
var searchResultMarker = null;
try {
  if (geocoderEndpointInput) geocoderEndpointInput.value = localStorage.getItem(geocoderEndpointKey) || defaultGeocoderEndpoint;
} catch (storageError) {
  if (geocoderEndpointInput) geocoderEndpointInput.value = defaultGeocoderEndpoint;
}

function mostrarEstadoBusqueda(mensaje, esError) {
  if (!placeSearchStatus) return;
  placeSearchStatus.textContent = mensaje || '';
  placeSearchStatus.classList.toggle('error', Boolean(esError));
}

function obtenerProveedorGeocodificacion() {
  var endpoint = geocoderEndpointInput && geocoderEndpointInput.value.trim();
  return endpoint || defaultGeocoderEndpoint;
}

async function consultarGeocodificador(consulta) {
  var endpoint = obtenerProveedorGeocodificacion();
  var cacheKey = endpoint + '|' + consulta.toLocaleLowerCase('es');
  if (geocoderCache.has(cacheKey)) return geocoderCache.get(cacheKey);
  var espera = 1100 - (Date.now() - lastGeocoderRequestAt);
  if (espera > 0) await new Promise(function (resolve) { window.setTimeout(resolve, espera); });
  lastGeocoderRequestAt = Date.now();
  var url = new URL(endpoint);
  var query = /bello/i.test(consulta) ? consulta : consulta + ', Bello, Antioquia, Colombia';
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'co');
  url.searchParams.set('accept-language', 'es');
  url.searchParams.set('viewbox', '-75.68,6.43,-75.47,6.25');
  url.searchParams.set('bounded', '1');
  var response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('El servicio respondió con el estado ' + response.status + '.');
  var results = await response.json();
  geocoderCache.set(cacheKey, results);
  return results;
}

function enfocarResultadoBusqueda(result) {
  var lat = Number(result.lat);
  var lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  if (searchResultMarker) map.removeLayer(searchResultMarker);
  searchResultMarker = L.circleMarker([lat, lon], {
    radius: 7,
    color: '#fff',
    weight: 2,
    fillColor: '#d76a3d',
    fillOpacity: 1
  }).addTo(map);
  var bounds = result.boundingbox && result.boundingbox.map(Number);
  if (bounds && bounds.length === 4 && bounds.every(Number.isFinite)) {
    map.flyToBounds([[bounds[0], bounds[2]], [bounds[1], bounds[3]]], { padding: [28, 28], maxZoom: 16 });
  } else {
    map.flyTo([lat, lon], Math.max(map.getZoom(), 16));
  }
  var resultPopup = document.createElement('span');
  resultPopup.textContent = result.display_name || 'Lugar encontrado';
  searchResultMarker.bindPopup(resultPopup).openPopup();
}

if (placeSearchForm) placeSearchForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  var query = placeSearchInput && placeSearchInput.value.trim();
  if (!query || query.length < 3) {
    mostrarEstadoBusqueda('Escribe al menos tres caracteres para buscar.', true);
    return;
  }
  var button = placeSearchForm.querySelector('[type="submit"]');
  if (button) button.disabled = true;
  if (placeSearchResults) placeSearchResults.replaceChildren();
  mostrarEstadoBusqueda('Buscando en Bello…');
  try {
    var results = await consultarGeocodificador(query);
    if (!results.length) {
      mostrarEstadoBusqueda('No encontramos resultados en el área de Bello. Prueba con el nombre del barrio o una dirección más completa.');
      return;
    }
    mostrarEstadoBusqueda(results.length === 1 ? 'Encontramos un lugar. Selecciónalo para centrar el mapa.' : 'Encontramos ' + results.length + ' lugares. Elige uno para centrar el mapa.');
    results.forEach(function (result) {
      var option = document.createElement('button');
      option.type = 'button';
      option.className = 'place-search-result';
      option.textContent = result.display_name || 'Lugar encontrado';
      option.addEventListener('click', function () {
        enfocarResultadoBusqueda(result);
        mostrarEstadoBusqueda('Mapa centrado en el lugar seleccionado.');
      });
      placeSearchResults.appendChild(option);
    });
  } catch (error) {
    console.error('No se pudo completar la búsqueda geográfica:', error);
    mostrarEstadoBusqueda('No se pudo consultar el servicio. Revisa tu conexión o el proveedor configurado.', true);
  } finally {
    if (button) button.disabled = false;
  }
});

if (saveGeocoderEndpoint) saveGeocoderEndpoint.addEventListener('click', function () {
  var endpoint = geocoderEndpointInput && geocoderEndpointInput.value.trim();
  try {
    var parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') throw new Error('Usa una dirección HTTPS para el proveedor.');
    if (!/\/search\/?$/.test(parsed.pathname)) throw new Error('Usa la ruta de búsqueda del servicio, por ejemplo /search.');
    localStorage.setItem(geocoderEndpointKey, parsed.toString());
    geocoderCache.clear();
    mostrarEstadoBusqueda('Proveedor de búsqueda guardado.');
  } catch (error) {
    mostrarEstadoBusqueda(error.message || 'Escribe una dirección válida para el servicio.', true);
  }
});

var layerList = document.getElementById('layerList');
var layerSearch = document.getElementById('layerSearch');

function normalizarTextoBusqueda(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

function actualizarResumenCapas(total, filtradas) {
  var layerCount = document.getElementById('layerCount');
  var activeLayerCount = document.getElementById('activeLayerCount');
  var cantidadActivas = Object.keys(capas).filter(function (name) { return map.hasLayer(capas[name]); }).length;
  if (layerCount) {
    layerCount.textContent = filtradas === total
      ? (total === 1 ? '1 capa' : total + ' capas')
      : filtradas + ' de ' + total + ' capas';
  }
  if (activeLayerCount) activeLayerCount.textContent = cantidadActivas === 1 ? '1 activa' : cantidadActivas + ' activas';
}

function prepararRenderizadoCapa(layer) {
  if (layer._mapFeaturesReady) return Promise.resolve(layer);
  if (layer._renderPromise) return layer._renderPromise;

  var features = layer._attributeFeatures || [];
  var cursor = 0;
  var batchSize = 120;
  layer.addTo(map);
  layer._renderPromise = new Promise(function (resolve, reject) {
    function dibujarLote() {
      try {
        var lote = features.slice(cursor, cursor + batchSize);
        if (lote.length) {
          layer.addLayer(L.geoJSON({ type: 'FeatureCollection', features: lote }, {
            onEachFeature: mostrarAtributos,
            style: layer._styleFunction,
            smoothFactor: 1.5
          }));
          cursor += lote.length;
          (window.requestAnimationFrame || function (callback) { window.setTimeout(callback, 0); })(dibujarLote);
          return;
        }
        layer._mapFeaturesReady = true;
        layer._renderPromise = null;
        resolve(layer);
      } catch (error) {
        map.removeLayer(layer);
        layer.clearLayers();
        layer._renderPromise = null;
        reject(error);
      }
    }
    dibujarLote();
  });
  return layer._renderPromise;
}

function actualizarListaCapas() {
  if (!layerList) return;

  layerList.innerHTML = '';
  var nombresCapas = Object.keys(capas);
  var consulta = normalizarTextoBusqueda(layerSearch && layerSearch.value);
  var nombresFiltrados = nombresCapas.filter(function (name) { return normalizarTextoBusqueda(name).indexOf(consulta) !== -1; });
  actualizarResumenCapas(nombresCapas.length, nombresFiltrados.length);
  actualizarLeyendaMapa();

  if (!nombresFiltrados.length) {
    var emptyState = document.createElement('p');
    emptyState.className = 'layer-empty';
    emptyState.textContent = consulta ? 'No hay capas que coincidan con esa búsqueda.' : 'Las capas aparecerán aquí cuando estén disponibles.';
    layerList.appendChild(emptyState);
    return;
  }

  nombresFiltrados.forEach(function (layerName) {
    var item = document.createElement('div');
    item.className = 'layer-item';

    var label = document.createElement('div');
    label.className = 'layer-label';

    var dot = document.createElement('span');
    dot.className = 'layer-dot';

    var text = document.createElement('span');
    text.textContent = layerName;

    label.appendChild(dot);
    label.appendChild(text);

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'layer-toggle';
    toggle.setAttribute('aria-label', 'Mostrar u ocultar ' + layerName);

    var layer = capas[layerName];
    if (layer && map.hasLayer(layer)) {
      toggle.classList.add('active');
    }

    toggle.addEventListener('click', function () {
      if (!layer || typeof layer.addTo !== 'function') return;
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
        toggle.classList.remove('active');
        actualizarResumenCapas(nombresCapas.length, nombresFiltrados.length);
        actualizarLeyendaMapa();
        return;
      }
      if (window.location.protocol === 'file:') {
        alert('Para cargar las capas, inicia el geovisor con Iniciar_Geovisor.bat. No abras index.html directamente como archivo.');
        return;
      }
      toggle.disabled = true;
      toggle.classList.add('loading');
      toggle.title = 'Cargando capa…';
      asegurarCargaCapa(layer).then(function () {
        return prepararRenderizadoCapa(layer);
      }).then(function () {
        actualizarListaCapas();
      }).catch(function (error) {
        console.error('No se pudo cargar la capa ' + layerName + ':', error);
        alert('No se pudo cargar la capa «' + layerName + '». Comprueba que el visor esté abierto desde un servidor local y que el archivo ZIP exista.');
      }).finally(function () {
        toggle.disabled = false;
        toggle.classList.remove('loading');
        toggle.title = '';
      });
    });

    var tableButton = document.createElement('button');
    tableButton.type = 'button';
    tableButton.className = 'attribute-table-button';
    tableButton.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="2.5" y="3.5" width="15" height="13" rx="1.5"></rect><path d="M2.5 8h15M7.5 8v8.5M12.5 8v8.5"></path></svg>';
    tableButton.title = 'Abrir tabla de atributos';
    tableButton.setAttribute('aria-label', 'Abrir tabla de atributos de ' + layerName);
    tableButton.addEventListener('click', function () {
      abrirTablaAtributos(layerName, layer);
    });

    var downloadButton = document.createElement('button');
    downloadButton.type = 'button';
    downloadButton.className = 'layer-download-button';
    downloadButton.setAttribute('aria-label', 'Descargar shapefile de ' + layerName);
    downloadButton.title = 'Descargar capa como Shapefile (.shp dentro de ZIP)';
    downloadButton.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2.8v9.1m0 0 3.4-3.4M10 11.9 6.6 8.5M3.5 13.2v3.3h13v-3.3"></path></svg>';
    downloadButton.addEventListener('click', function () {
      if (!layer || !window.shpwrite || typeof window.shpwrite.zip !== 'function') {
        alert('No está disponible el generador de archivos Shapefile. Comprueba tu conexión y vuelve a cargar el visor.');
        return;
      }
      downloadButton.disabled = true;
      downloadButton.title = 'Preparando Shapefile…';
      asegurarCargaCapa(layer).then(function () {
        var features = (layer._attributeFeatures || []).filter(function (feature) {
          return feature && feature.geometry && feature.geometry.coordinates;
        });
        if (!features.length) throw new Error('La capa no contiene geometrías para exportar.');
        var collection = { type: 'FeatureCollection', features: features };
        var baseName = nombreArchivoShapefile(layerName);
        return Promise.resolve(window.shpwrite.zip(collection, {
          folder: baseName,
          filename: baseName,
          outputType: 'blob'
        })).then(function (archivo) {
          var blob = archivo instanceof Blob ? archivo : new Blob([archivo], { type: 'application/zip' });
          var urlTemporal = URL.createObjectURL(blob);
          var enlace = document.createElement('a');
          enlace.href = urlTemporal;
          enlace.download = baseName + '.zip';
          document.body.appendChild(enlace);
          enlace.click();
          enlace.remove();
          setTimeout(function () { URL.revokeObjectURL(urlTemporal); }, 1000);
        });
      }).catch(function (error) {
        console.error('No se pudo exportar la capa ' + layerName + ':', error);
        alert(error.message || 'No se pudo generar el Shapefile de esta capa.');
      }).finally(function () {
        downloadButton.disabled = false;
        downloadButton.title = 'Descargar capa como Shapefile (.shp dentro de ZIP)';
      });
    });

    item.appendChild(label);
    item.appendChild(downloadButton);
    item.appendChild(tableButton);
    item.appendChild(toggle);
    layerList.appendChild(item);
  });
}

if (layerSearch) layerSearch.addEventListener('input', actualizarListaCapas);

function abrirTablaAtributos(nombre, layer) {
  if (window.location.protocol === 'file:') {
    alert('Para leer los archivos de atributos, inicia el geovisor con Iniciar_Geovisor.bat. No abras index.html directamente como archivo.');
    return;
  }
  var modal = document.getElementById('attributeTableModal');
  var title = document.getElementById('attributeTableTitle');
  var content = document.getElementById('attributeTableContent');
  if (!modal || !title || !content) return;

  title.textContent = 'Atributos: ' + nombre;
  content.textContent = 'Cargando atributos…';
  modal.hidden = false;
  document.getElementById('closeAttributeTable').focus();
  asegurarCargaCapa(layer).then(function () {
    if (!modal.hidden) renderizarTablaAtributos(nombre, layer, content);
  }).catch(function (error) {
    console.error('No se pudo cargar la tabla de ' + nombre + ':', error);
    if (!modal.hidden) content.textContent = 'No se pudieron cargar los atributos. Revisa que el archivo ZIP esté disponible.';
  });
}

function renderizarTablaAtributos(nombre, layer, content) {
  content.replaceChildren();
  var features = layer._attributeFeatures || [];
  if (!features.length) {
    content.textContent = 'Esta capa no tiene registros de atributos disponibles.';
    return;
  }

  var fields = [];
  features.forEach(function (feature) {
    Object.keys(feature.properties || {}).forEach(function (field) {
      if (fields.indexOf(field) === -1) fields.push(field);
    });
  });
  if (!fields.length) {
    content.textContent = 'Los elementos de esta capa no contienen atributos.';
    return;
  }

  var pageSize = 100;
  var page = 0;
  var table = document.createElement('table');
  table.className = 'attribute-table';
  var thead = table.createTHead();
  var headerRow = thead.insertRow();
  fields.forEach(function (field) {
    var th = document.createElement('th');
    th.scope = 'col';
    th.textContent = field;
    headerRow.appendChild(th);
  });
  var tbody = table.createTBody();
  var footer = document.createElement('div');
  footer.className = 'attribute-table-footer';
  var status = document.createElement('span');
  var previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = 'Anterior';
  var next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Siguiente';
  function drawPage() {
    tbody.replaceChildren();
    var start = page * pageSize;
    features.slice(start, start + pageSize).forEach(function (feature) {
      var row = tbody.insertRow();
      fields.forEach(function (field) {
        var cell = row.insertCell();
        var value = (feature.properties || {})[field];
        cell.textContent = value === null || value === undefined ? '' : String(value);
      });
    });
    status.textContent = 'Registros ' + (start + 1) + '–' + Math.min(start + pageSize, features.length) + ' de ' + features.length;
    previous.disabled = page === 0;
    next.disabled = start + pageSize >= features.length;
  }
  previous.addEventListener('click', function () { page -= 1; drawPage(); });
  next.addEventListener('click', function () { page += 1; drawPage(); });
  footer.appendChild(status);
  footer.appendChild(previous);
  footer.appendChild(next);
  content.appendChild(table);
  content.appendChild(footer);
  drawPage();
}

function cerrarTablaAtributos() {
  var modal = document.getElementById('attributeTableModal');
  if (modal) modal.hidden = true;
}

document.getElementById('closeAttributeTable').addEventListener('click', cerrarTablaAtributos);
document.getElementById('attributeTableModal').addEventListener('click', function (event) {
  if (event.target === this) cerrarTablaAtributos();
});

var welcomeModal = document.getElementById('welcomeModal');
var closeWelcomeBtn = document.getElementById('closeWelcomeBtn');
var openGuideBtn = document.getElementById('openGuideBtn');
var welcomeStep = document.getElementById('welcomeStep');
var guideStep = document.getElementById('guideStep');
var showGuideBtn = document.getElementById('showGuideBtn');
function mostrarPasoGuia() { if (welcomeStep) welcomeStep.hidden = true; if (guideStep) guideStep.hidden = false; }
function mostrarPasoBienvenida() { if (welcomeStep) welcomeStep.hidden = false; if (guideStep) guideStep.hidden = true; }

function cerrarBienvenida() {
  if (welcomeModal) welcomeModal.hidden = true;
}

if (welcomeModal) {
  welcomeModal.hidden = false;
  mostrarPasoBienvenida();
  welcomeModal.addEventListener('click', function (event) {
    if (event.target === welcomeModal) cerrarBienvenida();
  });
}
if (closeWelcomeBtn) closeWelcomeBtn.addEventListener('click', cerrarBienvenida);
if (showGuideBtn) showGuideBtn.addEventListener('click', mostrarPasoGuia);
if (openGuideBtn) openGuideBtn.addEventListener('click', function () {
  if (welcomeModal) welcomeModal.hidden = false;
  mostrarPasoGuia();
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    cerrarTablaAtributos();
    if (welcomeModal && !welcomeModal.hidden) cerrarBienvenida();
    if (measurementDrawHandler) measurementDrawHandler.disable();
    else if (polygonDrawHandler) polygonDrawHandler.disable();
  }
});

function actualizarContadorCapas() {
  var count = Object.keys(capas).length;
  var target = document.getElementById('layerCount');
  if (target) {
    target.textContent = String(count);
  }
  actualizarListaCapas();
}

function mostrarAtributos(feature, layer) {
  var propiedades = feature.properties || {};
  var contenido = document.createElement('article');
  contenido.className = 'feature-card';
  var header = document.createElement('header');
  header.className = 'feature-card-header';
  var title = document.createElement('h3');
  var titleKey = Object.keys(propiedades).find(function (key) { return /^(nombre|name|barrio|vereda|comuna|sector)/i.test(key) && propiedades[key] !== null && propiedades[key] !== ''; });
  title.textContent = titleKey ? String(propiedades[titleKey]) : 'Información del elemento';
  header.appendChild(title);
  var subtitle = document.createElement('p');
  subtitle.textContent = 'Atributos de la capa';
  header.appendChild(subtitle);
  contenido.appendChild(header);

  var fields = Object.entries(propiedades).filter(function (entry) { return entry[1] !== null && entry[1] !== undefined && entry[1] !== ''; });
  var details = document.createElement('dl');
  details.className = 'feature-details';
  fields.slice(0, 40).forEach(function (entry) {
    var term = document.createElement('dt');
    term.textContent = entry[0].replace(/_/g, ' ');
    var value = document.createElement('dd');
    value.textContent = typeof entry[1] === 'object' ? JSON.stringify(entry[1]) : String(entry[1]);
    details.append(term, value);
  });
  if (!fields.length) {
    var empty = document.createElement('p');
    empty.textContent = 'Este elemento no tiene atributos disponibles.';
    contenido.appendChild(empty);
  } else {
    contenido.appendChild(details);
    if (fields.length > 40) {
      var note = document.createElement('p');
      note.textContent = 'Se muestran los primeros 40 atributos. Consulta la tabla para verlos todos.';
      contenido.appendChild(note);
    }
  }
  layer.bindPopup(contenido, { maxWidth: 380, maxHeight: 460 });
}

function asegurarCargaCapa(capa) {
  if (capa._loadPromise) return capa._loadPromise;
  if (capa._attributesReady) return Promise.resolve(capa);
  capa._loadPromise = capa._loadData().then(function () {
    capa._attributesReady = true;
    return capa;
  }).catch(function (error) {
    capa._loadPromise = null;
    throw error;
  });
  return capa._loadPromise;
}

function nombreArchivoShapefile(nombre) {
  return String(nombre || 'capa').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'capa';
}

function cargarZipShapefile(rutaZip, nombre, estilo) {
  var capa = L.featureGroup();
  var estiloCapa = estilo || function () {
    return {
      color: '#8adbff',
      weight: 2,
      fillColor: '#4aa6ff',
      fillOpacity: 0.12,
      opacity: 0.8
    };
  };

  capas[nombre] = capa;
  capa._attributeFeatures = [];
  capa._collections = [];
  capa._styleFunction = estiloCapa;
  capa._originalStyleFunction = estiloCapa;
  capa._mapFeaturesReady = false;
  capa._attributesReady = false;
  actualizarContadorCapas();
  capa._loadData = function () {
    var urlShapefile = new URL(rutaZip, document.baseURI).toString();
    return shp(urlShapefile).then(function (datos) {
      var colecciones = datos && datos.type === 'FeatureCollection'
        ? [datos]
        : Array.isArray(datos) ? datos : Object.values(datos || {});

      colecciones.forEach(function (coleccion) {
        if (!coleccion || coleccion.type !== 'FeatureCollection') return;
        capa._collections.push(coleccion);
        capa._attributeFeatures = capa._attributeFeatures.concat(coleccion.features || []);
      });
      return capa;
    });
  };

  return capa;
}

cargarZipShapefile('dta/Nueva carpeta/Area_Predios_Quitasol_PCA.zip', 'Área de predios Quitasol PCA', function () {
  return {
    color: '#f4a261',
    weight: 1.5,
    fillColor: '#f4a261',
    fillOpacity: 0.16,
    opacity: 0.9
  };
});

cargarZipShapefile('dta/Nueva carpeta/BARRIOS_COMUNA.zip', 'Barrios por comuna', function () {
  return {
    color: '#e76f51',
    weight: 1.5,
    fillColor: '#e76f51',
    fillOpacity: 0.12,
    opacity: 0.85
  };
});

cargarZipShapefile('dta/Nueva carpeta/COMUNAS.zip', 'Comunas', function () {
  return {
    color: '#2a9d8f',
    weight: 2,
    fillColor: '#2a9d8f',
    fillOpacity: 0.1,
    opacity: 0.9
  };
});

// Vías de Bello viene como shapefile comprimido; shpjs espera el ZIP completo.
cargarZipShapefile('dta/Vias_Bello_2019.zip', 'Vías de Bello 2019', function () {
  return {
    color: '#f4d35e',
    weight: 2,
    opacity: 0.9
  };
});

cargarZipShapefile('dta/Centros_Poblados_Bello.zip', 'Centros poblados de Bello', function () {
  return {
    color: '#8e44ad',
    weight: 2,
    fillColor: '#c39bd3',
    fillOpacity: 0.65,
    opacity: 0.9
  };
});

cargarZipShapefile('dta/Veredas_Bello.zip', 'Veredas de Bello', function () {
  return {
    color: '#27ae60',
    weight: 2,
    fillColor: '#58d68d',
    fillOpacity: 0.12,
    opacity: 0.9
  };
});

cargarZipShapefile('dta/Cobertura_Bello_2016_2017/Cobertura_Bello_2016_2017.zip', 'Cobertura de Bello 2016-2017', function () {
  return {
    color: '#d4ac0d',
    weight: 1,
    fillColor: '#f4d03f',
    fillOpacity: 0.28,
    opacity: 0.85
  };
});

cargarZipShapefile('dta/Drenaje_Doble_Bello/Drenaje_Doble_Bello.zip', 'Drenaje doble de Bello', function () {
  return {
    color: '#2471a3',
    weight: 2,
    opacity: 0.9
  };
});

cargarZipShapefile('dta/Drenaje_Sencillo_Bello/Drenaje_Sencillo_Bello.zip', 'Drenaje sencillo de Bello', function () {
  return {
    color: '#48c9b0',
    weight: 1,
    opacity: 0.9
  };
});

var resultSequence = 0;
var categoricalPalette = ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#1f78b4', '#b15928', '#6a3d9a', '#fb9a99', '#33a02c'];
var sequentialPalettes = {
  blue: ['#f1f7fb', '#dceaf3', '#c5dceb', '#a5cde0', '#7fb9d4', '#58a4c8', '#348bb7', '#176f9e', '#084d77'],
  red: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef4533', '#cb181d', '#a50f15', '#67000d'],
  green: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#4caf62', '#2f8f4e', '#18743b', '#075528'],
  orange: ['#fff7ec', '#fee8c8', '#fdd49e', '#fdbb74', '#f99d4c', '#ed7d28', '#d95f0e', '#b84206', '#7f2704'],
  diverging: ['#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b']
};

function colorHslAHex(hue, saturation, lightness) {
  var s = saturation / 100, l = lightness / 100;
  var chroma = (1 - Math.abs(2 * l - 1)) * s;
  var section = hue / 60;
  var x = chroma * (1 - Math.abs(section % 2 - 1));
  var rgb = section < 1 ? [chroma, x, 0] : section < 2 ? [x, chroma, 0] : section < 3 ? [0, chroma, x] : section < 4 ? [0, x, chroma] : section < 5 ? [x, 0, chroma] : [chroma, 0, x];
  var match = l - chroma / 2;
  return '#' + rgb.map(function (value) { return Math.round((value + match) * 255).toString(16).padStart(2, '0'); }).join('');
}

function coloresClasificacion(cantidad, method, field) {
  if (method === 'unique') {
    return Array.from({ length: cantidad }, function (_, index) {
      if (index < categoricalPalette.length) return categoricalPalette[index];
      var hue = (index * 137.508) % 360;
      return colorHslAHex(hue, 58, 46);
    });
  }
  var nombreCampo = String(field || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  var paletteName = /cambio|variaci|diferencia|balance|anomal/.test(nombreCampo) ? 'diverging'
    : /riesgo|amenaza|suscept|vulnerab|peligro|critic/.test(nombreCampo) ? 'red'
      : /veget|bosque|cobertura|verde|arbol/.test(nombreCampo) ? 'green'
        : /lluvia|precipit|agua|dren|caudal/.test(nombreCampo) ? 'blue'
          : /temperat|calor|incendio/.test(nombreCampo) ? 'orange' : 'blue';
  var palette = sequentialPalettes[paletteName];
  return Array.from({ length: cantidad }, function (_, index) {
    var position = cantidad < 2 ? 0 : Math.round(index * (palette.length - 1) / (cantidad - 1));
    return palette[position];
  });
}
var analysisMessage = document.getElementById('analysisMessage');
var turfLoadPromise = null;

function asegurarTurf() {
  if (window.turf) return Promise.resolve(window.turf);
  if (turfLoadPromise) return turfLoadPromise;
  turfLoadPromise = new Promise(function (resolve, reject) {
    function cargar(url, respaldo) {
      var script = document.createElement('script');
      script.src = url;
      script.onload = function () {
        if (window.turf) resolve(window.turf);
        else if (respaldo) cargar(respaldo, null);
        else reject(new Error('El motor de análisis se descargó, pero no pudo inicializarse.'));
      };
      script.onerror = function () {
        if (respaldo) cargar(respaldo, null);
        else reject(new Error('No se pudo cargar Turf.js. Revisa tu conexión a internet e inténtalo de nuevo.'));
      };
      document.head.appendChild(script);
    }
    cargar('https://cdn.jsdelivr.net/npm/@turf/turf@7.2.0/turf.min.js', 'https://unpkg.com/@turf/turf@7.2.0/turf.min.js');
  }).catch(function (error) { turfLoadPromise = null; throw error; });
  return turfLoadPromise;
}

function avisarAnalisis(message, isError) {
  if (!analysisMessage) return;
  analysisMessage.textContent = message;
  analysisMessage.classList.toggle('error', Boolean(isError));
}

function llenarSelectoresAnalisis() {
  ['bufferLayer', 'classLayer'].forEach(function (id) {
    var select = document.getElementById(id);
    if (!select) return;
    var selected = select.value;
    select.replaceChildren();
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecciona una capa';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    Object.keys(capas).forEach(function (name) {
      var option = document.createElement('option'); option.value = name; option.textContent = name; select.appendChild(option);
    });
    if (Object.prototype.hasOwnProperty.call(capas, selected)) select.value = selected;
  });
}

function crearCapaResultado(nombre, features) {
  resultSequence += 1;
  var finalName = nombre + ' (' + resultSequence + ')';
  var group = L.featureGroup();
  var collection = { type: 'FeatureCollection', features: features };
  group._attributeFeatures = features;
  group._collections = [collection];
  group._styleFunction = function () { return { color: '#7c3aed', weight: 2, fillColor: '#a78bfa', fillOpacity: .35 }; };
  group._mapFeaturesReady = true;
  group._attributesReady = true;
  group.addLayer(L.geoJSON(collection, { style: group._styleFunction, onEachFeature: mostrarAtributos }));
  capas[finalName] = group;
  llenarSelectoresAnalisis();
  group.addTo(map);
  actualizarListaCapas();
  var bounds = group.getBounds(); if (bounds.isValid()) map.fitBounds(bounds.pad(.12), { maxZoom: 16 });
  return finalName;
}

function areaFeature(geometry) { return turf.area({ type: 'Feature', properties: {}, geometry: geometry }); }

document.getElementById('runBuffer').addEventListener('click', async function () {
  var runButton = this; runButton.disabled = true;
  try {
    avisarAnalisis('Preparando el motor de análisis…');
    await asegurarTurf();
    var name = document.getElementById('bufferLayer').value;
    var distance = Number(document.getElementById('bufferDistance').value);
    var unit = document.getElementById('bufferUnit').value;
    if (!name || !Number.isFinite(distance) || distance <= 0) throw new Error('Selecciona una capa e introduce una distancia mayor que cero.');
    avisarAnalisis('Cargando entidades y calculando áreas de influencia…');
    var source = await asegurarCargaCapa(capas[name]);
    var input = source._attributeFeatures || [];
    if (!input.length) throw new Error('La capa seleccionada no contiene entidades.');
    var buffered = [];
    var erroresGeometria = 0;
    for (var start = 0; start < input.length; start += 100) {
      var lote = input.slice(start, start + 100);
      lote.forEach(function (feature, loteIndex) {
        try {
          if (!feature.geometry) return;
          var result = turf.buffer(feature, distance, { units: unit, steps: 8 });
          if (!result) return;
          result.properties = Object.assign({}, feature.properties || {}, { buffer_origen: start + loteIndex + 1, distancia_buffer: distance, unidad_buffer: unit, area_m2: Math.round(areaFeature(result.geometry) * 100) / 100 });
          buffered.push(result);
        } catch (geometryError) { erroresGeometria += 1; }
      });
      avisarAnalisis('Calculando áreas de influencia: ' + Math.min(start + lote.length, input.length) + ' de ' + input.length + ' entidades…');
      await new Promise(function (resolve) { (window.requestAnimationFrame || function (callback) { window.setTimeout(callback, 0); })(resolve); });
    }
    if (!buffered.length) throw new Error('No se generaron polígonos. Comprueba que la capa tenga geometrías válidas.');
    if (document.getElementById('bufferDissolve').value === 'dissolve') {
      var dissolved = buffered.length === 1 ? buffered[0] : turf.union(turf.featureCollection(buffered));
      if (!dissolved) throw new Error('No fue posible unir las áreas de influencia.');
      dissolved.properties = { entidades_origen: buffered.length, distancia_buffer: distance, unidad_buffer: unit, area_m2: Math.round(areaFeature(dissolved.geometry) * 100) / 100 };
      buffered = [dissolved];
    }
    var resultName = crearCapaResultado('Área de influencia de ' + name, buffered);
    var cantidadAreas = buffered.length === 1 ? '1 área de influencia' : buffered.length + ' áreas de influencia';
    avisarAnalisis((buffered.length === 1 ? 'Se creó ' : 'Se crearon ') + cantidadAreas + ' en «' + resultName + '». Área total: ' + (buffered.reduce(function (sum, f) { return sum + (f.properties.area_m2 || 0); }, 0) / 10000).toFixed(2) + ' ha.' + (erroresGeometria ? ' Se omitieron ' + erroresGeometria + ' geometrías inválidas.' : ''));
  } catch (error) { console.error(error); avisarAnalisis(error.message || 'No se pudo crear el área de influencia.', true); }
  finally { runButton.disabled = false; }
});

function actualizarCamposClasificacion() {
  var layer = capas[document.getElementById('classLayer').value];
  var select = document.getElementById('classField'); if (!select) return;
  select.replaceChildren();
  var fields = [];
  (layer && layer._attributeFeatures || []).forEach(function (feature) { Object.keys(feature.properties || {}).forEach(function (key) { if (fields.indexOf(key) === -1) fields.push(key); }); });
  fields.forEach(function (field) { var option = document.createElement('option'); option.value = field; option.textContent = field; select.appendChild(option); });
}

function aplicarEstiloClasificacion(layer, field, groups, colors, method) {
  layer._styleFunction = function (feature) {
    var value = feature.properties && feature.properties[field]; var index = groups.findIndex(function (group) { return method === 'unique' ? String(value) === String(group.value) : Number(value) >= group.min && (Number(value) <= group.max || group === groups[groups.length - 1]); });
    var color = colors[Math.max(0, index) % colors.length];
    return { color: color, weight: 1.4, fillColor: color, fillOpacity: .55, opacity: .9 };
  };
  recorrerEntidadesEstilizables(layer, function (featureLayer) {
    var style = layer._styleFunction(featureLayer.feature);
    if (style) featureLayer.setStyle(style);
  });
}

function recorrerEntidadesEstilizables(layer, callback) {
  if (!layer) return;
  if (layer.feature && typeof layer.setStyle === 'function') callback(layer);
  if (typeof layer.eachLayer === 'function') layer.eachLayer(function (child) { recorrerEntidadesEstilizables(child, callback); });
}

document.getElementById('classLayer').addEventListener('change', async function () {
  var layer = capas[this.value];
  try {
    if (layer && !layer._attributesReady) avisarAnalisis('Cargando atributos de «' + this.value + '»…');
    if (layer) await asegurarCargaCapa(layer);
    actualizarCamposClasificacion();
    if (layer) avisarAnalisis('Capa lista. Elige el campo que quieres clasificar.');
  } catch (error) { avisarAnalisis(error.message || 'No se pudo cargar esa capa para clasificar.', true); }
});
document.getElementById('applyClassification').addEventListener('click', async function () {
  try {
    avisarAnalisis('Cargando datos y preparando la clasificación…');
    var name = document.getElementById('classLayer').value; var layer = capas[name];
    if (!layer) throw new Error('Selecciona una capa.');
    await asegurarCargaCapa(layer); actualizarCamposClasificacion();
    // La clasificación también debe mostrar la capa si solo se cargaron sus atributos desde el selector.
    if (layer._mapFeaturesReady) layer.addTo(map);
    else await prepararRenderizadoCapa(layer);
    var field = document.getElementById('classField').value; if (!field) throw new Error('Elige un campo que tenga atributos.');
    var method = document.getElementById('classMethod').value; var values = (layer._attributeFeatures || []).map(function (f) { return f.properties && f.properties[field]; }).filter(function (v) { return v !== null && v !== undefined && v !== ''; });
    var groups = [];
    if (method === 'unique') {
      var unique = Array.from(new Set(values.map(String)));
      if (unique.length > 50) throw new Error('Este campo tiene más de 50 valores únicos; elige un campo más acotado.');
      groups = unique.map(function (value) { return { value: value, label: value }; });
    } else {
      var numbers = values.map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
      if (!numbers.length) throw new Error('El campo seleccionado no contiene valores numéricos.');
      var count = Math.max(2, Math.min(12, Number(document.getElementById('classCount').value) || 5)); var min = numbers[0], max = numbers[numbers.length - 1];
      for (var i = 0; i < count; i += 1) {
        var lower = method === 'equal' ? min + (max - min) * i / count : numbers[Math.floor((numbers.length - 1) * i / count)];
        var upper = method === 'equal' ? min + (max - min) * (i + 1) / count : numbers[Math.floor((numbers.length - 1) * (i + 1) / count)];
        if (i === count - 1) upper = max;
        groups.push({ min: lower, max: upper, label: lower.toLocaleString() + ' – ' + upper.toLocaleString() });
      }
    }
    if (!groups.length) throw new Error('No hay valores para clasificar.');
    var colors = coloresClasificacion(groups.length, method, field);
    aplicarEstiloClasificacion(layer, field, groups, colors, method);
    var bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 16 });
    var legend = document.getElementById('classificationLegend'); legend.replaceChildren();
    layer._classification = { field: field, groups: groups, colors: colors, method: method };
    groups.forEach(function (group, i) {
      var row = document.createElement('div'); row.className = 'legend-row';
      var picker = document.createElement('input'); picker.type = 'color'; picker.className = 'legend-color-picker'; picker.value = colors[i]; picker.setAttribute('aria-label', 'Color para ' + group.label);
      picker.addEventListener('input', function () {
        colors[i] = picker.value;
        aplicarEstiloClasificacion(layer, field, groups, colors, method);
        actualizarLeyendaMapa();
      });
      var label = document.createElement('span'); label.textContent = group.label;
      row.append(picker, label); legend.appendChild(row);
    });
    actualizarLeyendaMapa();
    actualizarListaCapas();
    var nombreCampoNormalizado = String(field).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var tipoSimbologia = method === 'unique' ? 'colores categóricos' : /cambio|variaci|diferencia|balance|anomal/.test(nombreCampoNormalizado) ? 'escala divergente' : 'escala gradual de menor a mayor';
    avisarAnalisis('Clasificación aplicada a «' + name + '» usando ' + field + ' con ' + tipoSimbologia + '.');
  } catch (error) { avisarAnalisis(error.message || 'No se pudo clasificar la capa.', true); }
});
llenarSelectoresAnalisis();

var resetViewBtn = document.getElementById('resetViewBtn');
if (resetViewBtn) {
  resetViewBtn.addEventListener('click', function () {
    if (limitesRasters.isValid()) {
      map.fitBounds(limitesRasters.pad(0.2));
    } else {
      map.setView([6.337, -75.558], 13);
    }
  });
}

map.whenReady(function () {
  if (limitesRasters.isValid()) {
    map.fitBounds(limitesRasters.pad(0.2));
  }
});

    
