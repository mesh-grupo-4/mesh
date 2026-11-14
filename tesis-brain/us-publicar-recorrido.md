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
| **Comentario del autor** | Nota opcional de hasta 280 caracteres, escrita una sola vez al publicar | Da contexto al recorrido sin abrir hilos: RN-083 sigue prohibiendo los comentarios de la comunidad |
| **Foto opcional** | El autor puede adjuntar una foto al publicar (galería o cámara, recorte 4:3 a 1280 px). Mismo flujo de tres pasos que la foto de perfil: URL firmada → subida directa a Supabase Storage → el backend la verifica (carpeta de quien publica, JPEG de hasta 2 MB) al recibir `fotoPath` en el publicar. Se reemplaza al republicar; republicar sin foto la borra | Una imagen dice mucho de un recorrido sin abrir comentarios (RN-083). Los bytes no pasan por el VPS y el backend decide la ruta del archivo (RN-030) |
| **Checklist opcional** | Interruptor al publicar, apagado por defecto. Se copian solo los textos de **su** checklist; el tilde de completado no viaja | Compartir el checklist es una decisión explícita de quien publica. Si no tiene ítems, no se ofrece |
| **Solo el recorrido propio** | La tarjeta de publicación aparece solo en el resumen propio (no con `?userId=` de otra persona); el backend igual publica siempre lo de quien llama | El frontend orienta, el backend valida (RN-030) |

---

## Modelo de datos

`RecorridoPublicado` (`recorrido_publicado`): `viaje_id`, `usuario_id`, `nombre`,
`tipo_actividad`, `distancia_m`, `tiempo_seg`, `segmentos` (JSON `[lat, lng][][]`),
`inicio_lat`/`inicio_lng` (primer punto, para el filtro por zona de
[[us-explorar-recorridos]]), `comentario`, `checklist` (`text[]`), `foto` (URL pública o `null`), `activo`, `publicado_at`. Único por `(viaje_id, usuario_id)`.

La foto vive en el bucket `avatares` de Supabase Storage, carpeta
`recorridos/{usuario_id}/{viaje_id}/`. Al publicar se borra todo lo demás de esa carpeta
(la foto anterior y subidas que nunca se publicaron).

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `POST` | `/api/viajes/{viajeId}/recorrido/foto/subida` | Participante del viaje finalizado (URL firmada para la foto) |
| `POST` | `/api/viajes/{viajeId}/recorrido/publicar` | Participante del viaje finalizado (`fotoPath` opcional) |
| `DELETE` | `/api/viajes/{viajeId}/recorrido/publicar` | Autor del recorrido |
| `GET` | `/api/recorridos-publicados/mios` | Usuario autenticado (ids de sus viajes publicados) |

---

## Interfaz

- **Resumen del viaje** (`app/viaje/[viajeId]/resumen.tsx`): tarjeta "Compartir con la
  comunidad" con comentario opcional, interruptor para compartir el checklist, foto
  opcional (vista previa con **Cambiar** / **Quitar**) y **Publicar recorrido** /
  **Despublicar**. La foto se sube recién al tocar Publicar. Solo aparece si hay métricas propias y al
  menos dos puntos de traza (mismas condiciones que valida el backend).
- **Detalle del recorrido** (`app/recorridos-publicados/[recorridoId].tsx`): muestra la
  foto si la hay; si es propio, botón **Despublicar** con confirmación.
- **Explorar** (`RecorridoComunidadCard`): la foto va arriba de la tarjeta, en 4:3.
- **Entrada a la comunidad:** pestaña Rutas → Explorar, que ya muestra la lista.

### Ayuda en línea (E14)

| Pantalla | Pasos |
|---|---|
| Resumen del viaje | `resumen.publicar` (nuevo, orden 1703) |
| Rutas (tab) | `rutas.panel` (texto actualizado: menciona Explorar → comunidad) |
| Detalle de recorrido publicado | `recorridoPublicado.mapa`, `.datos`, `.despublicar` (solo si es propio) — rango 3600 |
| Recorridos de la comunidad | rango 3500 (ver [[us-explorar-recorridos]]) |
