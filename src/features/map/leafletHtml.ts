/**
 * HTML autonomo con Leaflet + tile raster OpenStreetMap (senza registrazione).
 * È usato sia dentro react-native-webview (native) sia dentro un <iframe> (web),
 * così la mappa si vede su tutte le piattaforme, anteprima web inclusa.
 *
 * Protocollo messaggi:
 *  - app → mappa: { type:'setData', markers, route:[[lat,lng]], routeColor, center, fit }
 *  - mappa → app: { type:'ready' } | { type:'mapPress', lat, lng } | { type:'markerPress', id }
 *
 * Nota: attribuzione OSM obbligatoria. Le tile OSM pubbliche hanno limiti d'uso: ok per
 * sviluppo/MVP, in produzione conviene un provider di tile dedicato.
 */
export function buildLeafletHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #e9ecef; }
  .pin {
    display:flex; align-items:center; justify-content:center;
    width:28px; height:28px; border-radius:50% 50% 50% 0;
    transform: rotate(-45deg); border:2px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,.35); font-weight:700;
  }
  .pin > span { transform: rotate(45deg); color:#fff; font-size:13px; font-family: -apple-system, Roboto, sans-serif; }
  .leaflet-container { font-family: -apple-system, Roboto, sans-serif; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  function post(msg){
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(s); }
    else if (window.parent && window.parent !== window) { window.parent.postMessage(s, '*'); }
  }

  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([41.9028, 12.4964], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);
  var routeLayer = L.layerGroup().addTo(map);

  map.on('click', function(e){ post({ type:'mapPress', lat:e.latlng.lat, lng:e.latlng.lng }); });

  function makeIcon(color, index){
    var label = index > 0 ? String(index) : '';
    return L.divIcon({
      className:'',
      html: '<div class="pin" style="background:'+color+'"><span>'+label+'</span></div>',
      iconSize:[28,28], iconAnchor:[14,28], popupAnchor:[0,-28]
    });
  }

  function render(d){
    markerLayer.clearLayers();
    routeLayer.clearLayers();
    var latlngs = [];
    (d.markers || []).forEach(function(m){
      var mk = L.marker([m.lat, m.lng], { icon: makeIcon(m.color, m.index), title: m.label });
      mk.on('click', function(){ post({ type:'markerPress', id:m.id }); });
      mk.addTo(markerLayer);
      latlngs.push([m.lat, m.lng]);
    });
    if ((d.route || []).length > 1) {
      L.polyline(d.route, { color: d.routeColor || '#3A31E0', weight: 4, opacity: 0.85 }).addTo(routeLayer);
    }
    if (d.fit && latlngs.length > 0) {
      if (latlngs.length === 1) { map.setView(latlngs[0], 15); }
      else { map.fitBounds(L.latLngBounds(latlngs), { padding:[48,48], maxZoom:16 }); }
    } else if (d.center) {
      map.setView([d.center.lat, d.center.lng], 13);
    }
  }

  function onMsg(e){
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && data.type === 'setData') render(data);
    } catch (err) {}
  }
  window.addEventListener('message', onMsg);
  document.addEventListener('message', onMsg);
  // Per il percorso injectJavaScript di react-native-webview.
  window.__setData = render;

  post({ type:'ready' });
</script>
</body>
</html>`;
}
