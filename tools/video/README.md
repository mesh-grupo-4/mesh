# Simulador de pantallas de Mesh para el video

`mesh-screens.html` reproduce las pantallas de Mesh con animaciones guionadas para
grabarlas con OBS. Un solo archivo, sin build, sin framework. Única dependencia
externa: **Leaflet por CDN**, para las teselas reales de OpenStreetMap.

```bash
# Abrilo directo en Chrome
open tools/video/mesh-screens.html

# O servilo, si preferís evitar cualquier restricción de file://
cd tools/video && python3 -m http.server 8777
# -> http://127.0.0.1:8777/mesh-screens.html
```

---

## Las cinco escenas

| Escena | `?scene=` | Dur. | Qué muestra |
|---|---|---|---|
| S1 | `planificar` | 11 s | Zoom al origen, trazado progresivo de la ruta, dos postas por tap, selector de horario, corte al QR con tres integrantes sumándose |
| S2 | `mapa-vivo` | 11 s | Los seis puntos avanzando, header con distancia y tiempo, chips de estado, paneo siguiendo al pelotón |
| S3 | `alertas` | 12 s | Continúa S2: Gonzalo se atrasa (ámbar), Franco se desvía (rojo), se abre el panel con las dos alertas |
| S4 | `cierre` | 10 s | Mapa con el recorrido completo, contadores desde cero, ranking y tarjetas tipo Wrapped |
| S5 | `recorrido-rapido` | 8 s | Cortes de 1,5 s: login, perfil, grupos, planificación, mapa |

## Parámetros

| Query string | Default | Qué hace |
|---|---|---|
| `?scene=ID` | `planificar` | Carga una escena puntual |
| `?frame=phone` | — | Pantalla dentro de un marco de celular sobre fondo de marca |
| `?frame=clean` | `clean` | Solo la pantalla, borde a borde, para enmascarar en edición |
| `?record=1` | off | Oculta los controles y el cursor, cuenta 3 segundos y arranca |
| `?loop=1` | off | Repite la escena indefinidamente |
| `?scale=N` | auto | Factor de escala CSS del render |
| `?rt=1` | off | Reloj de pared en vez de paso fijo — **no usar para grabar**, ver *Determinismo* |

Sin `?record` aparece el panel lateral: lista de escenas, play/pausa, scrubber y
tiempo transcurrido.

**Atajos:** `espacio` play/pausa · `← →` escena anterior/siguiente ·
`↑ ↓` saltar 1 s · `R` reiniciar.

---

## Configuración de OBS

### Resolución y fps

La pantalla es de **393 × 852 px lógicos**, renderizada a **3x** = **1179 × 2556 px**
reales. El simulador calcula solo la escala CSS necesaria según el DPR de tu monitor,
y te la muestra en el panel lateral (`render 3.00x (css 1.50 @ dpr 2)`).

| Tu pantalla | Escala CSS que aplica | Región de captura |
|---|---|---|
| Retina / HiDPI (DPR 2) | 1.5 | 590 × 1278 px de ventana |
| Monitor 1x (DPR 1) | 3.0 | 1179 × 2556 px de ventana |

En los dos casos salen los mismos 1179 × 2556 píxeles reales.

Si no te entra en el monitor, bajá la escala (`?scale=1`) y **no** compenses en OBS
escalando hacia arriba: es preferible grabar a 786 × 1704 nítidos que a 1179 × 2556
interpolados.

### Ajustes en OBS

1. **Configuración → Vídeo**
   - Resolución base y de salida: `1179 × 2556` (vertical) o `1920 × 1080` si vas a
     componer el celular sobre un fondo en edición.
   - FPS: **60**, fijo. El simulador anima a 60 fps.
2. **Fuente → Captura de ventana** apuntando a Chrome (no *Captura de pantalla*:
   evita la barra de menú y el cursor del sistema).
   - Método de captura: `Windows Graphics Capture` / `SCK` en macOS.
   - Destildar **Capturar cursor**.
3. **Recorte**: agregá el filtro *Recortar/Rellenar* sobre la fuente y ajustá hasta
   dejar solo la pantalla del celular. Con `?frame=clean` los bordes son rectos y el
   recorte es exacto.
4. **Salida**: MP4, x264, CRF 16-18, preajuste `slow`. Para un video de presentación
   conviene calidad alta: son menos de 60 segundos en total.
5. **Filtro de color**: ninguno. Los tokens ya están calibrados.

### Rutina de grabación

```
1. Abrí la escena SIN ?record y dejala correr una vez entera.
   Esto llena la caché de teselas de OpenStreetMap. Si grabás en frío,
   los primeros segundos salen con el mapa a medio cargar.
2. Verificá en el panel que diga 0 cuadros perdidos.
3. Recargá con ?record=1 y arrancá OBS durante la cuenta regresiva.
4. La escena corre una vez y se detiene sola en el último cuadro.
```

Para grabar varias tomas seguidas, agregá `&loop=1`.

---

## Determinismo

**La misma escena reproducida dos veces sale idéntica cuadro a cuadro.** Es la
premisa del archivo, y se sostiene sobre tres decisiones:

1. **Un solo `requestAnimationFrame`** que avanza un reloj propio. No hay
   `setTimeout` sueltos manejando animaciones.
2. **Paso fijo de 1/60 s**: el cuadro N siempre cae en `t = N/60`. No se mide el
   reloj de pared, así que un pico de carga no corre las cosas de lugar.
3. **`computar(escena, t)` es una función pura**: todo el estado visible sale de `t`.
   Hasta el "ruido" del GPS y la dispersión del pelotón salen de un hash
   `(integrante, tiempo)`, no de `Math.random()`.

La contracara del paso fijo: si el navegador pierde cuadros, la escena tarda más de
los 11 s nominales en reproducirse (el contenido es correcto, el tiempo real se
estira). Por eso el panel cuenta los cuadros perdidos — **grabá con 0**. Cerrá otras
pestañas y dejá la ventana en foco.

`?rt=1` cambia a reloj de pared: respeta la duración exacta a costa del determinismo.
Sirve para previsualizar, no para grabar.

Todas las animaciones usan solo `transform` y `opacity`. Ninguna dispara layout,
ni siquiera el scroll de S4 (que es un `translate3d`, no un `scrollTop`) ni el
trazado progresivo de la ruta (que es `stroke-dashoffset` sobre el path de Leaflet).

---

## Cómo editar el timing de una escena

Todo el guion vive en la constante **`SCENES`**, cerca del inicio del bloque de
scripts. Cambiar `t`, `dur` y `hasta` retoca el timing sin tocar una línea de lógica.

```js
{ id:'alertas', nombre:'S3 - Alertas automaticas', dur:12, pantalla:'s-live',
  acciones:[
    { t:0, dur:12, a:'vivo', desdeM:2410, ritmoM:105, desdeSeg:752, ritmoSeg:22,
      atraso:{ i:1, t0:2.0, t1:7.5, metros:210 },
      desvio:{ i:3, t0:6.0, t1:9.5, metros:145 } },
    { t:2.6, a:'estado', i:1, estado:'late' },
    { t:2.8, hasta:8.6, a:'toast', id:'atraso', tipo:'atraso',
      titulo:'Atraso', mensaje:'Gonzalo Ferraro va ~180 m atras del grupo',
      autor:'Alerta automatica' },
  ]}
```

Cada acción tiene una de estas tres formas:

| Forma | Cuándo se aplica |
|---|---|
| `{ t, a:'nombre', ... }` | Evento puntual: activo desde `t` hasta el final |
| `{ t, hasta, a:'nombre', ... }` | Activo solo en el intervalo `[t, hasta)` |
| `{ t, dur, a:'nombre', ... }` | Tween: el handler recibe un progreso `p` de 0 a 1 |

### Acciones disponibles

| `a` | Argumentos | Qué hace |
|---|---|---|
| `pantalla` | `pantalla`, `push` | Cambia de pantalla; `push:true` agrega la transición lateral |
| `mapa` | `mapa`, `desde`, `hasta` | Interpola centro y zoom (`{lat, lng, zoom}`) |
| `trazo` | `mapa` | Dibuja la polilínea progresivamente |
| `posta` | `n` | Muestra la posta `n` (pin en el mapa + fila en el sheet) |
| `snap` / `hoja` | `snap` / `desde`,`hasta` | Altura del bottom sheet / desplazamiento de su contenido |
| `ruedas` / `hora` | — | Mueve el selector de horario / actualiza el valor confirmado |
| `resumen` | — | Muestra distancia y tiempo estimado |
| `unirse` | `n` | Suma el integrante `n` a la lista de invitación |
| `vivo` | `desdeM`, `ritmoM`, `desdeSeg`, `ritmoSeg`, `atraso`, `desvio` | Simulación del mapa en vivo |
| `estado` | `i`, `estado` | Estado del integrante `i`: `late` (ámbar) u `off` (rojo) |
| `chip` | `chip`, `tono`, `txt` | Chip de estado del grupo; tonos `good` / `warn` / `bad` |
| `toast` | `id`, `tipo`, `titulo`, `mensaje`, `autor` | Alerta que baja sobre el mapa |
| `contador` | `n` | Contador del botón de alertas y contenido del panel |
| `tap` | `x`, `y` | Dispara el indicador de tap en coordenadas lógicas |
| `clase` | `sel`, `clase` | Agrega una clase CSS a un selector (paneles, scrim) |
| `contadores` | — | Anima los números del cierre desde cero |
| `scroll` | `desde`, `hasta` | Desplaza el contenido del cierre |

### Ajustar la velocidad del grupo

En la acción `vivo`, `ritmoM` son los metros que avanza el pelotón por segundo de
video. Con `ritmoM: 110` y `dur: 11` el grupo recorre 1210 m en la escena. `desdeM`
es el kilómetro donde arranca. **S3 continúa S2**: si cambiás S2, actualizá el
`desdeM` de S3 para que empalme (`desdeM_S3 = desdeM_S2 + ritmoM_S2 × dur_S2`).

### Recalcular coordenadas de un tap

Los `x, y` de `tap` están en píxeles lógicos de la pantalla de 393 × 852. La forma
rápida de medir: abrí la escena, pausá en el momento justo y en la consola:

```js
playing = false; buscar(6.9);
const st = document.getElementById('stage').getBoundingClientRect();
const sc = parseFloat(getComputedStyle(document.getElementById('stage')).transform.split(',')[3]);
const b = document.querySelector('#s-ruta .wp[data-wp="hora"]').getBoundingClientRect();
console.log('y logico =', Math.round((b.top - st.top) / sc + b.height / sc / 2));
```

---

## Fidelidad visual

Los tokens, radios, tamaños y textos salen de `frontend/`, no de una interpretación:

| Qué | De dónde |
|---|---|
| Paleta completa | `frontend/constants/Colors.ts`, rama `dark` |
| Botones, campos, badges, chips, avatares, TopBar | `frontend/components/MeshUI.tsx` |
| Marcador de integrante (caja 48, avatar 36, anillo 3) | `frontend/components/live/memberMarker.ts` |
| Pin de waypoint (25 × 41, ancla abajo) | `frontend/components/maps/pinMarker.ts` |
| Colores y emojis de alerta | `frontend/lib/alertasApi.ts` |
| Filtro oscuro de las teselas | `frontend/components/maps/leafletHtml.ts` |
| Bottom sheet, timeline de waypoints | `frontend/components/route-config/` |
| Panel de métricas, tarjetas de alerta | `frontend/components/live/`, `app/viaje/[viajeId]/alertas.tsx` |
| Logo | `frontend/assets/images/mesh-logo.png`, trazado a SVG (color plano `#fe3a0f`) |
| Iconos | Feather, la familia dominante del repo (126 usos), inline como SVG |

**Tipografías:** la app no tiene fuente de UI propia — usa la del sistema y carga
Space Mono solo para el logotipo, los badges y los eyebrows. Acá se embeben **Inter**
(el equivalente libre más cercano a SF Pro) y **Space Mono**, las dos con
`display=block` y con un `await document.fonts.ready` antes de arrancar la escena:
nunca se graba un cuadro con la tipografía de reserva.

### Dónde el simulador se aparta de la app

Cuatro desvíos deliberados, todos documentados:

1. **El mapa en vivo va en paleta oscura.** En la app, `live.tsx` y sus overlays
   (`TripMetricsPanel`, `ParadaActionsBar`, `AlertaBanner`, `AlertasButton`) usan
   colores claros hardcodeados (`#f3f4f6`, `#fff`, `#4338ca`) que no son los de Mesh.
   Reproducirlo tal cual cortaba de negro a gris claro entre S1 y S2. Acá está
   unificado en la paleta oscura, con el filtro de teselas que la app ya tiene.
2. **Cosas que la app todavía no tiene**, construidas desde los tokens existentes:
   el selector de horario dentro de configurar-ruta (hoy vive en `viaje/crear.tsx`),
   los chips de estado del grupo, la lista de integrantes sumándose en vivo al panel
   de invitación, las tarjetas tipo Wrapped y los contadores animados.
3. **El atraso pinta el marcador de ámbar.** En la app, `memberMarker.ts` solo
   colorea por parada (`#f59e0b`) o incidente (`#dc2626`); el atraso genera una
   alerta pero no cambia el punto. Para el video hacía falta que el cambio de estado
   se leyera de un vistazo, que es justamente lo que S3 tiene que mostrar.
4. **Colores de avatar asignados a mano.** El hash real de `AvatarFallback.tsx`
   colisiona con estos seis nombres: Pedro y Joaquín comparten `#6bcb77`, y Gonzalo
   y Manuel `#748ffc`. Como en S3 hay que distinguir a Gonzalo de un vistazo, los
   seis se asignaron a mano desde la misma paleta de 8 colores.

El bottom sheet a tope queda 36 px más abajo que el 88 % de la app, para que el
TopBar siga leyéndose en cámara.

**El QR es decorativo.** Tiene los patrones de detección y una trama determinista,
pero no codifica nada: no es escaneable. Generar un QR real habría implicado meter
un encoder completo en el archivo. Si necesitás que se escanee de verdad, reemplazá
el `<svg id="qr">` por una imagen generada aparte.

---

## Datos

**Los seis integrantes reales**, con iniciales y color fijo en todas las escenas:

| | | |
|---|---|---|
| Bautista Casoria | `BC` | `#ff6b6b` |
| Gonzalo Ferraro | `GF` | `#748ffc` |
| Pedro Gabrielli | `PG` | `#6bcb77` |
| Franco Giorda | `FG` | `#ff922b` |
| Joaquín Peñafort | `JP` | `#4a9eff` |
| Manuel Viale | `MV` | `#c77dff` |

**La ruta** es real: Parque Sarmiento → Lago del Parque → Bv. Chacabuco → Plaza
España, en Córdoba. Se calculó con OSRM perfil `walking` (el mismo que usa
`frontend/lib/osrm.ts` para running) y se simplificó con Douglas-Peucker a **104
vértices, 5,335 km**, con 5,5 m de error máximo. Vive en la constante `ROUTE` como
array de pares `[lat, lng]`. Las dos postas están en `POSTAS`, a 1,80 km y 3,48 km.

Para regenerarla, pedile a OSRM la ruta entre otros waypoints con
`overview=full&geometries=geojson`, simplificá y reemplazá `ROUTE`; `CUM` y `LARGO_M`
se recalculan solos al cargar.

---

## Si algo no anda

| Síntoma | Causa |
|---|---|
| El mapa queda gris | Sin internet, o el tile server de OSM rechazó los pedidos. Las teselas vienen de `tile.openstreetmap.org`. |
| Los primeros segundos salen con el mapa a medio cargar | Grabaste en frío. Corré la escena una vez antes, para llenar la caché de teselas. |
| El panel dice "cuadros perdidos" | Hay otra cosa consumiendo GPU. Cerrá pestañas y dejá la ventana en foco antes de grabar. |
| La tipografía se ve distinta | No cargó Google Fonts. Con internet debería resolverse; si necesitás grabar sin red, descargá los `.woff2` y embebelos en base64. |
| El celular no entra en el monitor | Bajá la escala con `?scale=1` y compensá recortando en OBS, no escalando hacia arriba. |
