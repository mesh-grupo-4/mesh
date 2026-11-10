# US — Explorar recorridos publicados por la comunidad (SCRUM-62)

> **Estado:** implementada (backend + frontend + ayuda en línea).
> **Epic:** **E10** — Red social de recorridos (publicar, explorar, valorar). Tier Deseable.
> **OpenAPI:** `backend/openapi/paths/recorridos-publicados.yaml` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-081 (visibles para todos), RN-084 (importables como base de un viaje), RN-086 (la plantilla es una copia independiente), RN-070 (nunca velocidad).
> **Relacionadas:** [[us-publicar-recorrido]] (SCRUM-61), [[us-valorar-recorridos]] (SCRUM-63, aporta la valoración que muestra cada recorrido), [[us-compartir-ruta]] (plantillas de ruta).

---

## La US

| US | Como… | Quiero… | Para… |
|---|---|---|---|
| **SCRUM-62** | usuario | explorar recorridos publicados por otros | descubrir rutas nuevas e importarlas a mi planificación |

### Criterios de aceptación

- Se pueden filtrar recorridos por tipo de actividad y zona geográfica.
- Cada recorrido muestra autor, distancia, tipo de actividad y valoración de la comunidad.
- El usuario puede importar un recorrido como base para un viaje nuevo.

---

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **Zona = dónde arranca el recorrido** | Al publicar se guarda el primer punto de la traza (`inicio_lat`/`inicio_lng`); el filtro devuelve los recorridos cuyo inicio cae dentro de un radio (`ST_DWithin` sobre `geography`, en PostGIS) | Es la lectura más útil de "recorridos en esta zona" (dónde hay que ir para hacerlo) y alcanza con un punto. Cálculo espacial en la base, como pide la arquitectura |
| **Centro + radio, no "provincia/ciudad" fija** | `lat` + `lng` + `radioKm` (1–200, default 25). La app ofrece "Cerca mío" (GPS del dispositivo) o "Elegir lugar" (sugerencias mientras se escribe vía `/api/geocoding/autocompletar`, proxiadas por el backend) y radios de 10/25/50/100 km | No requiere mantener un catálogo de zonas ni geocodificar al publicar. La búsqueda de lugares ya existía y respeta la regla de no exponer la key de Google al dispositivo |
| **Importar = plantilla en "Mis rutas"** | `POST /recorridos-publicados/{id}/importaciones` crea una `RutaPlantilla` (la misma entidad que un link de ruta importado) y la app abre "Crear viaje" con `plantillaId`. Responde con el mismo contrato `ImportacionRuta` (200 si ya existía, 201 si se creó) | Reusa entero el flujo que ya existe para crear un viaje desde una plantilla (incluido el ghost tracking contra plantillas, RN-073). La ruta además queda guardada para usarla otra vez |
| **La traza pasa a ser el trazado planificado** | Los tramos se unen en un solo `LineString`; primer y último punto son origen y destino; sin paradas. `distancia_planeada_m` = longitud de ese trazado (PostGIS), `tiempo_estimado_seg` = tiempo en movimiento del autor | Un recorrido publicado es una traza GPS, no una ruta con postas. El usuario puede ajustar origen, destino y paradas en "Configurar ruta" después de crear el viaje |
| **Copia independiente (RN-086)** | `ruta_plantilla.recorrido_publicado_id` es `ON DELETE SET NULL`; despublicar no toca la plantilla | Mismo criterio que el link de ruta: lo importado es del receptor |
| **Idempotente por (usuario, recorrido)** | Único `(usuario_id, recorrido_publicado_id)`; ante carrera concurrente (P2002) se devuelve la plantilla del otro request | Tocar dos veces "Usar como base" no duplica rutas guardadas |
| **Buscador por texto** | `q` busca en nombre, comentario y nombre del autor, sin distinguir mayúsculas ni acentos (`translate` + `strpos` en SQL) y se combina con los demás filtros | "cordoba" tiene que encontrar "Córdoba". No hace falta sumar la extensión `unaccent` |
| **Guardar = corazón** | Cada tarjeta de Explorar y el detalle tienen un corazón: marcarlo guarda la ruta (mismo `importar`; desde la tarjeta se lleva el checklist si lo hay) y desmarcarlo la quita, previa confirmación (`DELETE /api/rutas-plantilla/{id}`). El listado y el detalle traen `mi_plantilla_id` (id de la plantilla propia o `null`) para pintar el corazón ya marcado. En Guardadas todas las rutas aparecen con el corazón puesto; desmarcarlo pide confirmación y la saca de la lista | Guardar y "Usar como base" son intenciones distintas. El corazón es el gesto habitual de "guardar" y muestra el estado sin entrar al detalle |
| **El checklist se elige al guardar** | `guardarChecklist` en el cuerpo de la importación. Al repetir el guardado se aplica la última elección. Al crear un viaje con la plantilla, los ítems entran como `personal` | Mismo criterio que importar el checklist de otro viaje: no obliga al grupo |
| **La reputación destaca, la valoración ordena** | Cada recorrido del listado trae `reputacion_autor` (antigüedad, racha vigente, insignias, `nivel`). `nivel` suma puntos por racha (hitos 3/5/10), antigüedad (6/12 meses), insignias (3/5) y raras (1/2): desde 2 es `destacado`, desde 5 `leyenda`. Un recorrido es "Muy recomendado" con 80 % o más y al menos 3 votos | La reputación del autor solo resalta la tarjeta. El orden lo define la valoración del recorrido: muy recomendados primero, después por fecha (RN-082, ver [[us-valorar-recorridos]]) |
| **Insignias raras** | Lista fija en `recorridos-publicados.reputacion.ts`: `media_maraton`, `centurion_bici`, `trekker_resistente` | El criterio no depende de cuántos usuarios haya. Ninguna de moto o auto se destaca como rara (RN-070) y ningún cálculo usa velocidad |
| **Moto también se importa** | Se puede explorar e importar un recorrido en moto | Es una referencia de ruta, no una comparación de rendimiento: no hay velocidad ni orden por rendimiento (RN-070) |

---

## Modelo de datos

- `recorrido_publicado`: + `inicio_lat`, `inicio_lng` (nullable; backfill desde `segmentos` en la migración `20261030120000_recorrido_publicado_zona_importacion`).
- `ruta_plantilla`: `ruta_compartida_id` pasa a nullable; + `recorrido_publicado_id` (FK `ON DELETE SET NULL`), único `(usuario_id, recorrido_publicado_id)`; + `checklist` (`text[]`, migración `20261109130000_recorrido_comentario_checklist`).

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/recorridos-publicados?q=&tipoActividad=&lat=&lng=&radioKm=&limit=&offset=` | Cualquier usuario autenticado |
| `POST` | `/api/recorridos-publicados/{recorridoId}/importaciones` | Cualquier usuario autenticado |

`lat` y `lng` van juntos; `radioKm` sin centro → `400 VALIDATION_ERROR`.
Recorrido despublicado → `404 RECORRIDO_NOT_FOUND`.

---

## Interfaz

- **Recorridos de la comunidad** (pestaña Rutas → Explorar,
  `components/tabs/RutasExplorarPanel.tsx`): buscador por texto; chips de actividad; chips de zona (Cualquier lugar / Cerca mío / Elegir lugar) con buscador de lugares y radios
  de 10/25/50/100 km; lista de tarjetas tipo publicación (`RecorridoComunidadCard.tsx`) con
  autor, racha, antigüedad, insignias, comentario, actividad, distancia, tiempo, valoración,
  aviso de checklist y corazón para guardar (`components/CorazonGuardar.tsx`). Borde y cinta dorados para "Muy recomendado" y nivel `leyenda`.
- **Detalle** (`app/recorridos-publicados/[recorridoId].tsx`): corazón para guardar o quitar
  junto al título, comentario del autor, checklist con interruptor "Guardar también el
  checklist" y botón **Usar como base de un viaje** → importa y abre `app/viaje/crear.tsx` con
  la plantilla precargada.
- **Guardadas** (`components/tabs/RutasGuardadasPanel.tsx`): cada ruta con el corazón marcado;
  desmarcarlo pide confirmación y la quita. Tocar la tarjeta **abre el detalle** de la ruta
  guardada (`app/rutas-guardadas/[plantillaId].tsx`, lee `GET /api/rutas-plantilla/{id}`): mapa
  con trazado y paradas, actividad, distancia, tiempo estimado, paradas y checklist. El botón
  **Usar en viaje** (en la tarjeta y en el detalle) abre el selector Viaje YA / Planificar con la
  plantilla precargada. Tocar = ver, botón = acción: antes tocar la tarjeta ya arrancaba a crear
  el viaje y no había forma de ver la ruta.

### Ayuda en línea (E14)

| Pantalla | Pasos (rango) |
|---|---|
| Recorridos de la comunidad (3500) | `recorridosPublicados.buscar`, `.actividad`, `.zona`, `.lista` |
| Detalle de recorrido publicado (3600) | `recorridoPublicado.mapa`, `.datos`, `.valorar` (ver [[us-valorar-recorridos]]), `.usar`, `.despublicar` |
| Detalle de ruta guardada (3700) | `rutaGuardada.mapa`, `.usar` |
