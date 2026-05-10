/**
 * Mapa embebido: Leaflet + teselas OSM (sin SDK de Google/Mapbox).
 * Comunicación: `postMessage` hacia RN; actualización vía `injectJavaScript` → `window.__meshApply`.
 */
export function buildLeafletRouteHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    #map { height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var polyLayer = null;
    var markerLayer = null;

    function postToNative(obj) {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(obj));
        }
      } catch (e) {}
    }

    function drawMarkers(waypoints) {
      if (!markerLayer) return;
      markerLayer.clearLayers();
      if (!waypoints || !waypoints.length) return;
      waypoints.forEach(function (w, i) {
        var color = i === 0 ? '#16a34a' : (i === waypoints.length - 1 ? '#dc2626' : '#ca8a04');
        L.circleMarker([w.lat, w.lng], { radius: 9, color: color, weight: 2, fillColor: '#fff', fillOpacity: 1 })
          .addTo(markerLayer)
          .bindPopup((w.label || ('Punto ' + (i + 1))).replace(/</g, ''));
      });
    }

    function drawRoute(lineLatLngs) {
      if (polyLayer) {
        map.removeLayer(polyLayer);
        polyLayer = null;
      }
      if (lineLatLngs && lineLatLngs.length > 1) {
        polyLayer = L.polyline(lineLatLngs, { color: '#2563eb', weight: 5, opacity: 0.88 }).addTo(map);
        try {
          map.fitBounds(polyLayer.getBounds(), { padding: [28, 28], maxZoom: 16 });
        } catch (e) {}
      }
    }

    window.__meshApply = function (data) {
      if (!data) return;
      drawMarkers(data.waypoints || []);
      drawRoute(data.routeLine || null);
    };

    document.addEventListener('DOMContentLoaded', function () {
      map = L.map('map', { zoomControl: true }).setView([-34.6037, -58.3816], 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      markerLayer = L.layerGroup().addTo(map);

      map.on('contextmenu', function (e) {
        postToNative({ type: 'longpress', lat: e.latlng.lat, lng: e.latlng.lng });
      });

      (function setupTouchLongPress() {
        var el = map.getContainer();
        var t = null;
        el.addEventListener('touchstart', function (e) {
          if (e.touches.length !== 1) return;
          var te = e.touches[0];
          t = setTimeout(function () {
            t = null;
            var rect = el.getBoundingClientRect();
            var x = te.clientX - rect.left;
            var y = te.clientY - rect.top;
            var p = map.containerPointToLatLng(L.point(x, y));
            postToNative({ type: 'longpress', lat: p.lat, lng: p.lng });
          }, 560);
        }, { passive: true });
        function cancel() {
          if (t) { clearTimeout(t); t = null; }
        }
        el.addEventListener('touchend', cancel, { passive: true });
        el.addEventListener('touchmove', cancel, { passive: true });
        el.addEventListener('touchcancel', cancel, { passive: true });
      })();

      postToNative({ type: 'ready' });
    });
  </script>
</body>
</html>`
}
