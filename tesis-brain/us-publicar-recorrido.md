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
| **Fotos opcionales (hasta 5)** | El autor puede adjuntar hasta 5 fotos al publicar (galería o cámara, recorte 4:3 a 1280 px), en el orden en que las elige: la primera es la portada. Mismo flujo de tres pasos que la foto de perfil, repetido por foto: URL firmada → subida directa a Supabase Storage → el backend verifica cada una (carpeta de quien publica, JPEG de hasta 2 MB) al recibir `fotoPaths` en el publicar. Se reemplazan al republicar; republicar sin fotos las borra. `fotoPath` (una sola) queda como alias obsoleto para versiones anteriores de la app. La respuesta trae `fotos` (todas) y `foto` (la portada) | Una imagen dice mucho de un recorrido sin abrir comentarios (RN-083), y varias muestran el camino y no solo la llegada (cambio del 16/11/2026: antes era una sola). Los bytes no pasan por el VPS y el backend decide la ruta de cada archivo (RN-030). El tope de 5 acota el Storage y mantiene corto el carrusel |
| **Checklist opcional** | Interruptor al publicar, apagado por defecto. Se copian solo los textos de **su** checklist; el tilde de completado no viaja | Compartir el checklist es una decisión explícita de quien publica. Si no tiene ítems, no se ofrece |
| **Solo el recorrido propio** | La tarjeta de publicación aparece solo en el resumen propio (no con `?userId=` de otra persona); el backend igual publica siempre lo de quien llama | El frontend orienta, el backend valida (RN-030) |

---

## Modelo de datos

`RecorridoPublicado` (`recorrido_publicado`): `viaje_id`, `usuario_id`, `nombre`,
`tipo_actividad`, `distancia_m`, `tiempo_seg`, `segmentos` (JSON `[lat, lng][][]`),
`inicio_lat`/`inicio_lng` (primer punto, para el filtro por zona de
[[us-explorar-recorridos]]), `comentario`, `checklist` (`text[]`), `fotos` (`text[]` de URLs públicas, en orden; vacío sin fotos), `activo`, `publicado_at`. Único por `(viaje_id, usuario_id)`.

Las fotos viven en el bucket `avatares` de Supabase Storage, carpeta
`recorridos/{usuario_id}/{viaje_id}/`. Al publicar se borra todo lo demás de esa carpeta
(las fotos anteriores y subidas que nunca se publicaron). La migración
`20261116120000_recorrido_publicado_fotos` reemplaza la columna `foto` por `fotos` y pasa
la foto que ya tuviera cada recorrido a su lista.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `POST` | `/api/viajes/{viajeId}/recorrido/foto/subida` | Participante del viaje finalizado (URL firmada, una llamada por foto) |
| `POST` | `/api/viajes/{viajeId}/recorrido/publicar` | Participante del viaje finalizado (`fotoPaths` opcional, hasta 5) |
| `DELETE` | `/api/viajes/{viajeId}/recorrido/publicar` | Autor del recorrido |
| `GET` | `/api/recorridos-publicados/mios` | Usuario autenticado (ids de sus viajes publicados) |

---

## Interfaz

- **Resumen del viaje** (`app/viaje/[viajeId]/resumen.tsx`): tarjeta "Compartir con la
  comunidad" con comentario opcional, interruptor para compartir el checklist, fotos
  opcionales (fila de miniaturas con la primera marcada "Portada", una cruz para quitar
  cada una y una casilla **Agregar** hasta llegar a 5) y **Publicar recorrido** /
  **Despublicar**. Las fotos se suben recién al tocar Publicar. Solo aparece si hay métricas propias y al
  menos dos puntos de traza (mismas condiciones que valida el backend).
- **Detalle del recorrido** (`app/recorridos-publicados/[recorridoId].tsx`): abre con las
  fotos como portada, en un carrusel 4:3 (`components/CarruselFotos.tsx`) con contador y
  puntos; con una sola foto queda fija y sin fotos arranca por el título. Si es propio,
  botón **Despublicar** con confirmación.
- **Explorar** (`RecorridoComunidadCard`): la portada va arriba de la tarjeta, en 4:3, con un contador si el recorrido tiene más de una foto.
- **Entrada a la comunidad:** pestaña Rutas → Explorar, que ya muestra la lista.

### Ayuda en línea (E14)

| Pantalla | Pasos |
|---|---|
| Resumen del viaje | `resumen.publicar` (nuevo, orden 1703) |
| Rutas (tab) | `rutas.panel` (texto actualizado: menciona Explorar → comunidad) |
| Detalle de recorrido publicado | `recorridoPublicado.mapa`, `.datos`, `.despublicar` (solo si es propio) — rango 3600 |
| Recorridos de la comunidad | rango 3500 (ver [[us-explorar-recorridos]]) |
