import { LEAFLET_CSS, LEAFLET_JS, LEAFLET_ROTATE_JS } from './vendor/leafletSource'

/**
 * Mapa embebido: Leaflet + teselas OSM/CARTO (sin SDK de Google/Mapbox).
 * Leaflet mismo se empaqueta localmente (`./vendor/leafletSource.ts`, generado
 * desde el paquete npm) en vez de cargarse desde unpkg.com: la app se usa en
 * zonas de mala señal, donde depender de un CDN externo para ver el mapa es frágil.
 * La rotación con dos dedos (CU-01) la aporta el plugin `leaflet-rotate`, empaquetado igual.
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
    .mesh-compass { display: none; }
    .mesh-compass a { display: flex; align-items: center; justify-content: center; }
    .mesh-compass svg { display: block; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>${LEAFLET_JS}</script>
  <script>${LEAFLET_ROTATE_JS}</script>
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
      // CU-01: rotación con dos dedos. El ángulo queda fijo al soltar; los
      // marcadores siguen derechos (rotateWithView es false por defecto).
      rotate: true,
      touchRotate: ${interactive},
      shiftKeyRotate: ${interactive},
      rotateControl: false,
      attributionControl: false,
    }).setView([${centerLat}, ${centerLng}], ${zoom});

    var tileLayer = L.tileLayer(${JSON.stringify(tile.urlTemplate)}, {
      maxZoom: ${tile.maximumZ},
      tms: ${tile.flipY},
    }).addTo(map);

    // Brújula: solo visible con el mapa rotado; al tocarla vuelve al norte.
    // Reemplaza al control de leaflet-rotate, cuyo ciclo de 3 estados
    // (táctil / brújula del dispositivo / bloqueado) no aplica acá.
    if (${interactive}) {
      var CompassControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function (m) {
          var box = L.DomUtil.create('div', 'leaflet-bar mesh-compass');
          var link = L.DomUtil.create('a', '', box);
          link.href = '#';
          link.title = 'Orientar al norte';
          link.setAttribute('role', 'button');
          link.innerHTML =
            '<svg width="22" height="22" viewBox="0 0 24 24">' +
            '<path d="M12 2l5 10H7z" fill="#d76655"/>' +
            '<path d="M12 22l5-10H7z" fill="#9ca3af"/></svg>';
          var arrow = link.firstChild;
          L.DomEvent.disableClickPropagation(box);
          L.DomEvent.on(link, 'click', function (e) {
            L.DomEvent.preventDefault(e);
            m.setBearing(0);
          });
          var sync = function () {
            var bearing = m.getBearing();
            box.style.display = bearing ? 'block' : 'none';
            arrow.style.transform = 'rotate(' + bearing + 'deg)';
          };
          m.on('rotate', sync);
          sync();
          return box;
        },
      });
      new CompassControl().addTo(map);
    }

    var markersLayer = L.layerGroup().addTo(map);
    /** id -> { marker, iconKey, zIndex, popup } de lo último que pintó setMarkers. */
    var markersById = {};
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
      // Reconcilia por id en vez de borrar y recrear: el marcador persiste entre
      // actualizaciones (base para animar su desplazamiento, CU-03) y no se
      // cierran los popups abiertos ni parpadean los íconos.
      setMarkers: function (list) {
        var vistos = {};
        (list || []).forEach(function (m) {
          vistos[m.id] = true;
          var size = m.size || [48, 48];
          var anchor = m.anchor || [size[0] / 2, size[1] / 2];
          var iconKey = m.html + '|' + size.join(',') + '|' + anchor.join(',');
          var zIndex = m.zIndexOffset || 0;
          var popup = m.popup || null;
          var icon = function () {
            return L.divIcon({
              className: 'mesh-marker',
              html: m.html,
              iconSize: size,
              iconAnchor: anchor,
            });
          };

          var actual = markersById[m.id];
          if (!actual) {
            var marker = L.marker([m.lat, m.lng], {
              icon: icon(),
              zIndexOffset: zIndex,
            }).addTo(markersLayer);
            if (popup) marker.bindPopup(popup);
            markersById[m.id] = { marker: marker, iconKey: iconKey, zIndex: zIndex, popup: popup };
            return;
          }

          var mk = actual.marker;
          var pos = mk.getLatLng();
          if (pos.lat !== m.lat || pos.lng !== m.lng) mk.setLatLng([m.lat, m.lng]);
          if (actual.iconKey !== iconKey) {
            mk.setIcon(icon());
            actual.iconKey = iconKey;
          }
          if (actual.zIndex !== zIndex) {
            mk.setZIndexOffset(zIndex);
            actual.zIndex = zIndex;
          }
          if (actual.popup !== popup) {
            if (!popup) mk.unbindPopup();
            else if (mk.getPopup()) mk.setPopupContent(popup);
            else mk.bindPopup(popup);
            actual.popup = popup;
          }
        });

        Object.keys(markersById).forEach(function (id) {
          if (vistos[id]) return;
          markersLayer.removeLayer(markersById[id].marker);
          delete markersById[id];
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
