import { LEAFLET_CSS, LEAFLET_JS } from './vendor/leafletSource'

/**
 * Mapa embebido: Leaflet + teselas OSM/CARTO (sin SDK de Google/Mapbox).
 * Leaflet mismo se empaqueta localmente (`./vendor/leafletSource.ts`, generado
 * desde el paquete npm) en vez de cargarse desde unpkg.com: la app se usa en
 * zonas de mala señal, donde depender de un CDN externo para ver el mapa es frágil.
 * Comunicación RN -> WebView vía `injectJavaScript` llamando a `window.__mesh.*`.
 * Comunicación WebView -> RN vía `ReactNativeWebView.postMessage` (JSON).
 */

export type LeafletTile = {
  urlTemplate: string
  maximumZ: number
  flipY: boolean
  filter?: 'dark'
}

type BuildHtmlArgs = {
  centerLat: number
  centerLng: number
  zoom: number
  tile: LeafletTile
  interactive: boolean
}

export function buildLeafletHtml({ centerLat, centerLng, zoom, tile, interactive }: BuildHtmlArgs): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>${LEAFLET_CSS}</style>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #e5e7eb; }
    #map { height: 100%; width: 100%; }
    .leaflet-control-attribution { display: none; }
    .mesh-marker { background: transparent; border: none; }
    .leaflet-tile-pane.tile-filter-dark { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>${LEAFLET_JS}</script>
  <script>
    var map = L.map('map', {
      zoomControl: ${interactive},
      dragging: ${interactive},
      touchZoom: ${interactive},
      doubleClickZoom: ${interactive},
      scrollWheelZoom: ${interactive},
      boxZoom: ${interactive},
      keyboard: ${interactive},
      tap: ${interactive},
      attributionControl: false,
    }).setView([${centerLat}, ${centerLng}], ${zoom});

    var tileLayer = L.tileLayer(${JSON.stringify(tile.urlTemplate)}, {
      maxZoom: ${tile.maximumZ},
      tms: ${tile.flipY},
    }).addTo(map);

    var markersLayer = L.layerGroup().addTo(map);
    var userLocLayer = null;
    var polyLayers = [];

    function clearPolylines() {
      polyLayers.forEach(function (layer) { map.removeLayer(layer); });
      polyLayers = [];
    }

    function applyTileFilter(filter) {
      var pane = map.getPane('tilePane');
      if (pane) pane.classList.toggle('tile-filter-dark', filter === 'dark');
    }
    applyTileFilter(${JSON.stringify(tile.filter ?? null)});

    function postToNative(obj) {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(obj));
        }
      } catch (e) {}
    }

    window.__mesh = {
      setTileLayer: function (urlTemplate, maxZoom, flipY, filter) {
        map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(urlTemplate, { maxZoom: maxZoom, tms: flipY }).addTo(map);
        applyTileFilter(filter || null);
      },
      setMarkers: function (list) {
        markersLayer.clearLayers();
        (list || []).forEach(function (m) {
          var size = m.size || [48, 48];
          var anchor = m.anchor || [size[0] / 2, size[1] / 2];
          var icon = L.divIcon({
            className: 'mesh-marker',
            html: m.html,
            iconSize: size,
            iconAnchor: anchor,
          });
          var marker = L.marker([m.lat, m.lng], {
            icon: icon,
            zIndexOffset: m.zIndexOffset || 0,
          }).addTo(markersLayer);
          if (m.popup) marker.bindPopup(m.popup);
        });
      },
      setPolyline: function (coords, color, width) {
        clearPolylines();
        if (coords && coords.length > 1) {
          polyLayers.push(L.polyline(coords, { color: color, weight: width, opacity: 0.88 }).addTo(map));
        }
      },
      setPolylines: function (list) {
        clearPolylines();
        (list || []).forEach(function (pl) {
          if (!pl.coords || pl.coords.length < 2) return;
          polyLayers.push(L.polyline(pl.coords, {
            color: pl.color,
            weight: pl.width || 4,
            opacity: pl.opacity != null ? pl.opacity : 0.88,
            dashArray: pl.dashed ? '8 10' : null,
          }).addTo(map));
        });
      },
      fitBounds: function (coords, padding, animated) {
        if (!coords || coords.length < 2) return;
        var bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, {
          paddingTopLeft: [padding.left, padding.top],
          paddingBottomRight: [padding.right, padding.bottom],
          animate: !!animated,
        });
      },
      animateTo: function (lat, lng, zoom) {
        map.setView([lat, lng], zoom == null ? map.getZoom() : zoom, { animate: true });
      },
      panTo: function (lat, lng) {
        map.panTo([lat, lng], { animate: true });
      },
      setUserLocation: function (lat, lng) {
        if (userLocLayer) {
          map.removeLayer(userLocLayer);
          userLocLayer = null;
        }
        if (lat == null || lng == null) return;
        // Color de acento de la app (igual en claro/oscuro, ver constants/Colors.ts)
        // en vez del azul genérico de mapas comerciales, que desentonaba con el resto de la UI.
        userLocLayer = L.layerGroup().addTo(map);
        L.circleMarker([lat, lng], {
          radius: 14,
          fillColor: '#d76655',
          fillOpacity: 0.18,
          color: 'transparent',
          weight: 0,
        }).addTo(userLocLayer);
        L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: '#d76655',
          fillOpacity: 1,
          color: '#ffffff',
          weight: 2.5,
        }).addTo(userLocLayer);
      },
      clearUserLocation: function () {
        if (userLocLayer) {
          map.removeLayer(userLocLayer);
          userLocLayer = null;
        }
      },
    };

    map.on('moveend', function () {
      var c = map.getCenter();
      postToNative({ type: 'regionChangeComplete', lat: c.lat, lng: c.lng });
    });

    // 'dragstart' solo lo dispara un arrastre real del usuario (nunca panTo/
    // animateTo/setView programáticos): es la señal para pausar el "seguirme".
    map.on('dragstart', function () {
      postToNative({ type: 'userDrag' });
    });

    postToNative({ type: 'ready' });
  </script>
</body>
</html>`
}
