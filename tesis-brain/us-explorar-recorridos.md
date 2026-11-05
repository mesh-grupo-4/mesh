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
| **Centro + radio, no "provincia/ciudad" fija** | `lat` + `lng` + `radioKm` (1–200, default 25). La app ofrece "Cerca mío" (GPS del dispositivo) o "Elegir lugar" (búsqueda por nombre vía `/api/geocoding/buscar`, ya proxiada por el backend) y radios de 10/25/50/100 km | No requiere mantener un catálogo de zonas ni geocodificar al publicar. La búsqueda de lugares ya existía y respeta la regla de no exponer la key de Google al dispositivo |
| **Importar = plantilla en "Mis rutas"** | `POST /recorridos-publicados/{id}/importaciones` crea una `RutaPlantilla` (la misma entidad que un link de ruta importado) y la app abre "Crear viaje" con `plantillaId`. Responde con el mismo contrato `ImportacionRuta` (200 si ya existía, 201 si se creó) | Reusa entero el flujo que ya existe para crear un viaje desde una plantilla (incluido el ghost tracking contra plantillas, RN-073). La ruta además queda guardada para usarla otra vez |
| **La traza pasa a ser el trazado planificado** | Los tramos se unen en un solo `LineString`; primer y último punto son origen y destino; sin paradas. `distancia_planeada_m` = longitud de ese trazado (PostGIS), `tiempo_estimado_seg` = tiempo en movimiento del autor | Un recorrido publicado es una traza GPS, no una ruta con postas. El usuario puede ajustar origen, destino y paradas en "Configurar ruta" después de crear el viaje |
| **Copia independiente (RN-086)** | `ruta_plantilla.recorrido_publicado_id` es `ON DELETE SET NULL`; despublicar no toca la plantilla | Mismo criterio que el link de ruta: lo importado es del receptor |
| **Idempotente por (usuario, recorrido)** | Único `(usuario_id, recorrido_publicado_id)`; ante carrera concurrente (P2002) se devuelve la plantilla del otro request | Tocar dos veces "Usar como base" no duplica rutas guardadas |
| **Moto también se importa** | Se puede explorar e importar un recorrido en moto | Es una referencia de ruta, no una comparación de rendimiento: no hay velocidad ni orden por rendimiento (RN-070) |

---

## Modelo de datos

- `recorrido_publicado`: + `inicio_lat`, `inicio_lng` (nullable; backfill desde `segmentos` en la migración `20261030120000_recorrido_publicado_zona_importacion`).
- `ruta_plantilla`: `ruta_compartida_id` pasa a nullable; + `recorrido_publicado_id` (FK `ON DELETE SET NULL`), único `(usuario_id, recorrido_publicado_id)`.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/recorridos-publicados?tipoActividad=&lat=&lng=&radioKm=&limit=&offset=` | Cualquier usuario autenticado |
| `POST` | `/api/recorridos-publicados/{recorridoId}/importaciones` | Cualquier usuario autenticado |

`lat` y `lng` van juntos; `radioKm` sin centro → `400 VALIDATION_ERROR`.
Recorrido despublicado → `404 RECORRIDO_NOT_FOUND`.

---

## Interfaz

- **Recorridos de la comunidad** (`app/recorridos-publicados/index.tsx`): chips de actividad;
  chips de zona (Cualquier lugar / Cerca mío / Elegir lugar) con buscador de lugares y radios
  de 10/25/50/100 km; lista con autor, actividad, distancia, tiempo y valoración.
- **Detalle** (`app/recorridos-publicados/[recorridoId].tsx`): botón **Usar como base de un
  viaje** → importa y abre `app/viaje/crear.tsx` con la plantilla precargada.

### Ayuda en línea (E14)

| Pantalla | Pasos (rango) |
|---|---|
| Recorridos de la comunidad (3500) | `recorridosPublicados.actividad`, `.zona`, `.lista` |
| Detalle de recorrido publicado (3600) | `recorridoPublicado.mapa`, `.datos`, `.valorar` (ver [[us-valorar-recorridos]]), `.usar`, `.despublicar` |
