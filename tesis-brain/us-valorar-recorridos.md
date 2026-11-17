# US — Valorar recorridos de la comunidad (SCRUM-63)

> **Estado:** implementada (backend + frontend + ayuda en línea).
> **Epic:** **E10** — Red social de recorridos (publicar, explorar, valorar). Tier Deseable.
> **OpenAPI:** `backend/openapi/paths/recorridos-publicados.yaml` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-082 (binaria, una vez por recorrido), RN-083 (sin comentarios), RN-080 (red acotada), RN-070 (nunca velocidad).
> **Relacionadas:** [[us-publicar-recorrido]] (SCRUM-61), [[us-explorar-recorridos]] (SCRUM-62, muestra la valoración en la lista).

---

## La US

| US | Como… | Quiero… | Para… |
|---|---|---|---|
| **SCRUM-63** | usuario | valorar un recorrido publicado indicando si lo recomiendo o no | ayudar a otros a elegir rutas |

### Criterios de aceptación

- El sistema ofrece únicamente dos opciones: Recomiendo y No recomiendo.
- Cada usuario puede valorar un recorrido solo una vez.
- El recorrido muestra el porcentaje de recomendaciones recibidas.
- No se permiten comentarios de texto para mantener la simplicidad.

---

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **Una vez = definitiva** | PK compuesta `(recorrido_publicado_id, usuario_id)`; un segundo intento responde `409 VALORACION_EXISTENTE`. No hay endpoint para cambiarla ni borrarla. La app pide confirmación antes de enviar | Es la lectura literal de "solo una vez" (RN-082). La confirmación evita que un toque accidental quede para siempre |
| **El autor no valora lo propio** | `403 VALORACION_PROPIA` | La valoración existe para "ayudar a otros a elegir rutas": autovalorarse solo infla el porcentaje |
| **Cualquier usuario puede valorar** | No se exige haber hecho el recorrido | El criterio de aceptación no lo pide y no hay forma confiable de verificarlo (el recorrido puede hacerse fuera de Mesh) |
| **Sin texto, por contrato** | El body es `{ recomiendo: boolean }` con Zod `.strict()`: un campo extra como `comentario` es `400` | RN-083: la API no tiene dónde guardar un comentario aunque el cliente lo mande |
| **Porcentaje entero o `null`** | `porcentaje_recomienda = round(recomiendan / total × 100)`; `null` si nadie valoró | Un recorrido recién publicado no aparece como "0 % lo recomienda" |
| **Calculado al leer** | Un `groupBy` por `(recorrido, recomiendo)` + la valoración propia, para toda la página del listado en una sola consulta | Nada que se desincronice; el costo es una consulta agregada por request |
| **Los muy recomendados van primero** (cambio del 09/11/2026; antes el orden no dependía de la valoración) | `muy_recomendado` = 80 % o más de "Recomiendo" con al menos 3 valoraciones. El listado los pone primero y, dentro de cada grupo, sigue por fecha de publicación. El orden se resuelve en SQL (`idsOrdenados`) para que la paginación lo respete, y el backend expone el mismo criterio en `valoracion.muy_recomendado` | Pedido del PO para darle más peso social a la valoración. Son dos grupos y no un orden por porcentaje: lo nuevo no queda enterrado y con pocos votos nadie sube. Ordena rutas por la opinión de la comunidad, no personas ni rendimiento: no hay velocidad (RN-070) |
| **Se conservan al despublicar** | Despublicar es `activo = false`; republicar reactiva la misma fila con sus valoraciones. Mientras está despublicado no se puede valorar (`404`) | Lo que opinó la comunidad sigue siendo válido para el mismo recorrido |

---

## Modelo de datos

`ValoracionRecorrido` (`valoracion_recorrido`): `recorrido_publicado_id`, `usuario_id`
(PK compuesta), `recomiendo` (boolean), `created_at`. Cascade al borrar el recorrido o el
usuario. Migración `20261030130000_valoracion_recorrido`.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `POST` | `/api/recorridos-publicados/{recorridoId}/valoracion` | Usuario autenticado que no es el autor |

Body `{ "recomiendo": true | false }` → `201` con el resumen `ValoracionRecorrido`
(`recomiendan`, `no_recomiendan`, `total`, `porcentaje_recomienda`, `mi_valoracion`).
El listado y el detalle traen ese mismo resumen en `valoracion`.

---

## Interfaz

- **Lista de la comunidad:** cada tarjeta cierra con un medidor
  (`components/tabs/MedidorValoracion.tsx`) que muestra la valoración en escalones, cada
  uno con nombre, porcentaje, cantidad de votos y una barra que se llena según el
  porcentaje: "Sin valoraciones todavía" (sin barra) → "Poco recomendado" (menos de 40 %,
  rojo) → "Opiniones divididas" (40 a 69 %, naranja) → "Recomendado" (70 % o más, verde) →
  "Muy recomendado" (80 % o más con al menos 3 votos, dorado). El marco de la tarjeta
  acompaña la misma escala: neutro, naranja fino, verde, dorado grueso; las "Muy
  recomendado" suman la cinta dorada y aparecen primero. El marco depende solo de la
  valoración de la ruta, no de la reputación del autor (cambio del 16/11/2026: antes un
  autor "Leyenda" teñía de dorado el marco aunque la ruta no tuviera votos).
- **Guardados:** debajo del medidor, "N personas lo guardaron en sus rutas" (campo `guardados`
  del listado y del detalle, un `groupBy` sobre `ruta_plantilla` por recorrido). Es un total
  agregado, sin decir quiénes; con 0 no se muestra. Al tocar el corazón la app lo ajusta en
  uno sin volver a pedir el listado.
- **Detalle:** tarjeta "Valoración de la comunidad" con el mismo medidor y, según el caso,
  los botones **Recomiendo** / **No recomiendo** (con confirmación), "Ya lo valoraste: …"
  o "No podés valorar tu propio recorrido".

### Ayuda en línea (E14)

| Pantalla | Pasos |
|---|---|
| Detalle de recorrido publicado | `recorridoPublicado.valorar` (orden 3602) |
| Recorridos de la comunidad | `recorridosPublicados.lista` (texto actualizado: menciona el porcentaje) |
