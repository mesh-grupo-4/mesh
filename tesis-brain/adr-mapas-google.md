# ADR — Mapas, rutas y búsqueda con Google Maps Platform

> **Decisión de arquitectura** · Proyecto Final 2026 · UTN FRC · Grupo 4 · Curso 5K1
> Estado: **aceptada** · Fecha: 08/10/2026
> Reemplaza: la decisión "Mapas: OpenStreetMap exclusivamente" de [[reglas-de-negocio]] §6.5
> Relacionado: [[reglas-de-negocio]], [[us-compartir-ruta]], [[us-paradas-voluntarias]]

---

## Contexto

Hasta esta decisión el proyecto usaba solo servicios basados en OpenStreetMap:

- **Mapa**: Leaflet embebido en un WebView con teselas de `tile.openstreetmap.org`.
- **Búsqueda de lugares**: Nominatim, con un throttle obligatorio de 1 request/segundo global.
- **Cálculo de rutas**: demos públicos de OSRM y Valhalla.

Funcionaba, pero los demos públicos no tienen garantía de disponibilidad, Nominatim busca mal
los puntos de interés (estaciones de servicio, comercios) y el mapa en WebView es menos fluido
que uno nativo.

## Decisión

| Necesidad | Servicio de Google | Respaldo |
|---|---|---|
| Mapa | Maps SDK for Android/iOS (`react-native-maps`, componente `MeshMapView`) | Apple Maps en iOS si el build no tiene key de iOS |
| Sugerencias mientras se escribe (todos los buscadores de lugares) | Places API (New) — Autocomplete + Place Details (solo `location`) | Text Search → Nominatim |
| Búsqueda de lugares por texto completo | Places API (New) — Text Search | Nominatim |
| Nombre de un punto del mapa | Geocoding API | Nominatim |
| Cálculo de rutas | Routes API — Compute Routes (Essentials) | OSRM → Valhalla |
| Sugerir paradas sobre la ruta (planificación) | Places API (New) — Text Search con *search along route* | Sin respaldo (503 `LUGARES_NO_DISPONIBLE`) |
| Lugares cerca mío (en vivo) | Places API (New) — Nearby Search | Sin respaldo |

- **Las APIs web (Places, Geocoding, Routes) se llaman solo desde el backend** con
  `GOOGLE_MAPS_API_KEY`. La key nunca llega al dispositivo. Sin key, el backend se comporta
  igual que antes (solo OSM). Los contratos REST (`/api/geocoding/*`, `/api/routing/calcular`)
  no cambiaron, salvo un campo agregado: `/api/routing/calcular` devuelve `proveedor`
  (`google` | `osrm` | `valhalla`).
- **Autocompletado (09/11/2026)**: los buscadores de lugares de la app (destino del Viaje YA,
  origen/destino/paradas al planificar, lugar de una alerta, zona en Explorar) sugieren desde la
  segunda letra con `GET /api/geocoding/autocompletar` (hook `useSugerenciasLugares`). Las
  sugerencias de Google traen `placeId` sin coordenadas; al elegir una se piden con
  `GET /api/geocoding/lugares/{placeId}`. El dispositivo genera un **token de sesión** (UUID) que
  viaja en todo el tipeo y en el detalle final, para que Google cobre la sesión como una sola
  consulta. Si Autocomplete falla o no hay key, el mismo endpoint devuelve resultados de Text
  Search / Nominatim, que ya vienen con coordenadas. Si se conoce la posición del usuario se manda
  como sesgo de cercanía (50 km); solo se usa para esa consulta y no se guarda ni se publica (RN-111).
- **Tiempo estimado (RN-023)**: si la ruta la calculó Google, el planificador usa su
  `duracion_seg` tal cual (ya respeta auto / bici / a pie). Si vino de un respaldo OSM, la
  recalcula con la velocidad esperada de la actividad, porque el demo de OSRM usa el grafo
  de auto para cualquier perfil.
- **El mapa usa keys propias del build** (`GOOGLE_MAPS_ANDROID_API_KEY`,
  `GOOGLE_MAPS_IOS_API_KEY`, leídas en `frontend/app.config.ts`), restringidas por package/bundle.
- **Fallback automático**: cualquier error de Google (key inválida, cuota agotada, timeout,
  sin ruta para ese modo) pasa al proveedor OSM siguiente. La planificación nunca queda
  bloqueada por Google.

## Consecuencias

- **Costo**: dentro de la cuota gratuita mensual por SKU para el volumen de la tesis
  (Routes Essentials 10.000, Places Text Search Pro 5.000, Geocoding 10.000; Autocomplete y Place Details Essentials tienen
  su propia cuota por SKU). Requiere un
  proyecto de Google Cloud con facturación activa. El mapa nativo en el celular no consume cuota.
- **Builds**: la key del mapa se embebe en el binario nativo; hace falta un build
  (`expo run:android` / EAS) para que tome la key configurada.
- **Atribución**: el logo de Google lo dibuja el SDK. Se quitaron las etiquetas
  "© OpenStreetMap".
- **Sugerencias de lugares** (`/api/lugares/en-ruta`, `/api/lugares/cercanos`): por categoría de parada
  RN-022 (`combustible`, `gastronomia`, `descanso`, `sanitario`). Al planificar, el lugar elegido se
  inserta como parada donde menos alarga el recorrido. En vivo, "Cerca mío" dibuja una guía hasta el
  lugar; la posición viaja al backend solo para esa búsqueda y no se publica al grupo (RN-111).
  En un viaje grupal el lugar también se comparte: quien puede crear alertas usa "Vamos todos" (abre
  la alerta ya armada con el lugar) y el resto "Proponer al grupo" (pedido de parada con el lugar; al
  aprobarlo, al líder se le abre esa alerta). Lo que se publica es la ubicación del lugar, nunca la de
  la persona. "Solo yo" mantiene la guía personal. Por eso la alerta ya no busca lugares por texto:
  solo se marca un punto en el mapa para lo que no está en las categorías.
- **Fuera de alcance por ahora**: Roads API (ajuste del recorrido a la calle) y Navigation SDK.
  Fleet Engine se descartó: exige contrato y apunta a flotas con despachante, no a grupos de pares.
- **Versión de `react-native-maps` fijada en 1.29.11** (06/11/2026), por encima de la 1.27.2 que
  recomienda Expo SDK 57. La 1.27.2 tiene un bug nativo en Android (`MapView.safeAddFeature` pisa
  con `set` en vez de insertar, y al desmontar la pantalla solo repone lo que quedó registrado): los
  marcadores de integrantes desaparecían al volver de Alertas u otra pantalla. Corregido upstream en
  1.29.0 (PR #5795). **No** bajarla con `npx expo install --fix`; el aviso de `expo doctor` es esperado.
