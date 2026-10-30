# US — Publicar recorrido para la comunidad (SCRUM-61)

> **Estado:** implementada (backend + frontend + ayuda en línea).
> **Epic:** **E10** — Red social de recorridos (publicar, explorar, valorar). Tier Deseable.
> **OpenAPI:** `backend/openapi/paths/recorridos-publicados.yaml` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-080 (red acotada), RN-081 (publicar/despublicar), RN-070 (nunca velocidad).
> **Relacionadas:** [[us-explorar-recorridos]] (SCRUM-62), [[us-valorar-recorridos]] (SCRUM-63), [[us-compartir-ruta]] (link privado de ruta planificada, otro mecanismo).

---

## La US

| US | Como… | Quiero… | Para… |
|---|---|---|---|
| **SCRUM-61** | usuario | publicar un recorrido realizado | que otros miembros de la comunidad puedan verlo y usarlo como referencia |

### Criterios de aceptación

- El usuario puede publicar cualquier viaje de su historial.
- El recorrido publicado muestra: mapa de la ruta, tipo de actividad, distancia y tiempo.
- El usuario puede despublicar un recorrido en cualquier momento.
- Los recorridos publicados son visibles para todos los usuarios de la app.

---

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **Se publica la traza real, no la ruta planificada** | Al publicar se congela un snapshot de la traza GPS **propia** de quien publica (`computeTrazaRecorrido`), su distancia y su tiempo en movimiento (`MetricaViaje`) | "Publicar un recorrido realizado": lo que se comparte es lo que efectivamente se hizo. La ruta planificada ya tiene su propio mecanismo (link privado, [[us-compartir-ruta]]) |
| **"Historial" = viajes finalizados en los que participó** | Creador o integrante `confirmado`/`salido`, y el viaje en `finalizado`. Sin traza GPS propia → `422 RECORRIDO_SIN_TRAZA` | Un viaje planificado o en curso todavía no es historial. Quien salió a mitad también hizo un recorrido (parcial) |
| **Snapshot congelado** | Editar o borrar después datos del viaje no cambia lo publicado. Republicar refresca el snapshot | Mismo criterio que RN-086 para el link de ruta: lo que vio la comunidad no cambia por debajo |
| **Despublicar = `activo = false`** | La fila no se borra; volver a publicar reactiva la misma fila (idempotente por `(viaje, usuario)`) | Conserva las valoraciones recibidas ([[us-valorar-recorridos]]) si el autor despublica y vuelve a publicar |
| **Nunca velocidad (RN-070)** | El contrato solo tiene `distancia_m` y `tiempo_seg`. También en moto: se puede publicar como referencia de ruta, pero no se compara rendimiento | Regla de seguridad vial no negociable |
| **Solo el recorrido propio** | La tarjeta de publicación aparece solo en el resumen propio (no con `?userId=` de otra persona); el backend igual publica siempre lo de quien llama | El frontend orienta, el backend valida (RN-030) |

---

## Modelo de datos

`RecorridoPublicado` (`recorrido_publicado`): `viaje_id`, `usuario_id`, `nombre`,
`tipo_actividad`, `distancia_m`, `tiempo_seg`, `segmentos` (JSON `[lat, lng][][]`),
`inicio_lat`/`inicio_lng` (primer punto, para el filtro por zona de
[[us-explorar-recorridos]]), `activo`, `publicado_at`. Único por `(viaje_id, usuario_id)`.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `POST` | `/api/viajes/{viajeId}/recorrido/publicar` | Participante del viaje finalizado |
| `DELETE` | `/api/viajes/{viajeId}/recorrido/publicar` | Autor del recorrido |
| `GET` | `/api/recorridos-publicados/mios` | Usuario autenticado (ids de sus viajes publicados) |

---

## Interfaz

- **Resumen del viaje** (`app/viaje/[viajeId]/resumen.tsx`): tarjeta "Compartir con la
  comunidad" con **Publicar recorrido** / **Despublicar**. Solo aparece si hay
  métricas propias y al menos dos puntos de traza (mismas condiciones que valida el backend).
- **Detalle del recorrido** (`app/recorridos-publicados/[recorridoId].tsx`): si es
  propio, botón **Despublicar** con confirmación.
- **Entrada a la comunidad:** pestaña Rutas → Explorar → tarjeta "Recorridos de la comunidad".

### Ayuda en línea (E14)

| Pantalla | Pasos |
|---|---|
| Resumen del viaje | `resumen.publicar` (nuevo, orden 1703) |
| Rutas (tab) | `rutas.panel` (texto actualizado: menciona Explorar → comunidad) |
| Detalle de recorrido publicado | `recorridoPublicado.mapa`, `.datos`, `.despublicar` (solo si es propio) — rango 3600 |
| Recorridos de la comunidad | rango 3500 (ver [[us-explorar-recorridos]]) |
