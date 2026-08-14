# US — Compartir ruta planificada por link e importarla como plantilla

> **Estado:** **implementada** (contrato + backend + frontend).  
> **Epic:** **E10** (puente E03 → E10). **No** es MVP Core de E03.  
> **OpenAPI:** `backend/openapi/rutas-compartidas.yaml`.  
> **RN:** RN-085–RN-088 en `reglas-de-negocio.md`.  
> **Dependencia:** configurar ruta del viaje fuente ya entregada (origen, destino, linestring, paradas).

---

## Pegar en Jira

### Título

Compartir ruta planificada por link e importarla como plantilla en el perfil

### Epic / labels

- Epic: **E10 — Red social de recorridos** (primer recorte: importación por link privado; **sin** feed, valorar ni comentarios)
- Labels sugeridos: `E10`, `puente-E03-E10`, `ruta`, `plantilla`
- **No** mezclar con tickets de QR de asistencia (RN-015 / RN-016)

### Descripción

**Como** integrante confirmado de un viaje  
**quiero** generar un link único de la ruta planificada y que otro usuario (aunque no esté en mi grupo) la guarde en su perfil  
**para** reutilizarla después como base de un viaje propio, sin unirse al mío.

#### Contexto de producto

- Distinto del QR de unirse al viaje (`mesh://unirse?viajeId=...`, RN-015/016): este link **no** agrega integrantes ni expira al iniciar el viaje.
- Primer recorte de **RN-084** (recorridos importables) **sin** red social pública (RN-080–083).
- Hoy `Ruta` es 1:1 con `Viaje`; el import exige entidad de **plantilla** en el perfil del receptor.

#### Alcance

**Incluye**

- Snapshot: origen/destino (coords + nombres), `linestring_geojson`, paradas (orden, coords, nombre, categoría), `distancia_planeada_m`, `tiempo_estimado_seg`, `tipo_actividad` del viaje fuente.
- Preview en mapa (OpenStreetMap) antes de guardar.
- Lista “Mis rutas” en perfil.
- Al crear viaje: elegir plantilla → precargar configurar-ruta (el receptor define nombre, fecha, invitados).
- Token opaco único por ruta de viaje (no el UUID del viaje). Mismo link para todos los que pueden compartir.
- Auth obligatoria para guardar. Deep link: si no hay sesión → login → retorno al preview.

**Quién genera el link:** cualquier integrante con estado `confirmado` (incluye al creador). No `pendiente`, `rechazado` ni `salido`.

**Quién revoca el link:** solo el **creador** del viaje fuente (RN-030).

**Fuera de alcance** (otra US / resto de E10)

- Feed público, explorar, “Recomiendo / No recomiendo”, comentarios.
- Compartir trazado GPS real post-viaje (ghost / historial).
- Unirse al viaje original.
- Edición colaborativa de la plantilla original.
- Rankings / velocidad (RN-070 no aplica a geometría).

#### Decisión AC-11 (duplicados)

Importar la misma ruta dos veces es **idempotente**: se reutiliza la plantilla existente del usuario (por token / origen); no se duplica.

---

### Criterios de aceptación

1. **Precondición:** el viaje tiene ruta configurada (origen, destino y trazado). Si no, no hay acción de compartir (o error claro `RUTA_INCOMPLETA`).
2. Un integrante `confirmado` ve “Compartir ruta”, copia un link único (`mesh://ruta?token=...` o HTTPS equivalente). Quien no está confirmado recibe 403.
3. El link **no** es el QR de unirse (`mesh://unirse?viajeId=...`). Abrirlo **no** crea `ViajeIntegrante` en el viaje fuente.
4. El link **no expira** al pasar el viaje a `en_curso` / `finalizado` (contraste RN-015).
5. Receptor autenticado ve preview: mapa OSM, distancia/tiempo, paradas, tipo de actividad. Sin nombres de participantes, grupos, GPS ni alertas.
6. “Guardar en mis rutas” crea una **copia** en el perfil. Borrar o editar el viaje fuente **no** altera plantillas ya importadas.
7. El receptor puede crear un viaje nuevo eligiendo esa plantilla: se copian geometría y paradas; él define nombre, fecha futura (RN-107) e invitados.
8. “Mis rutas” lista plantillas propias (nombre, actividad, distancia). Puede eliminar la suya (no la del dueño original).
9. Token inválido / revocado: mensaje claro, no 500. Usuario no autenticado: login y retorno al preview.
10. **Revocar link:** solo el **creador del viaje fuente**. Tras revocar, el token deja de resolver; las plantillas ya guardadas siguen.
11. Importar la misma ruta dos veces: **idempotente** (no duplicar).
12. Tests unitarios + integración (token, autorización por estado de integrante, import no une al viaje) y OpenAPI del contrato nuevo.

---

### DoR checklist

- [x] US con título, descripción y AC 1–12
- [x] Epic E10 / puente E03→E10; no mezclar con QR RN-015
- [x] Dependencia: configurar-ruta estable
- [x] Duplicados: idempotente
- [x] Sin feed social ni GPX/GPS real en este ticket
- [ ] Cargar en Jira (pegar este documento) + estimación Poker (sugerida: **8**)

### Partición opcional (Fibonacci)

| Ticket | Contenido | Est. |
|--------|-----------|------|
| A | Link + preview + guardar plantilla + Mis rutas + revocar | 5 |
| B | Usar plantilla al crear viaje (precarga configurar-ruta) | 3 |

El ticket B cierra el valor de producto; sin él el perfil es un cajón muerto.

---

## Flujo (referencia)

```mermaid
sequenceDiagram
  participant Sharer as IntegranteConfirmado
  participant API as Backend
  participant Link as LinkUnico
  participant Receptor as UsuarioAutenticado
  participant Perfil as PlantillaPerfil

  Sharer->>API: Pedir o copiar link de ruta
  API-->>Sharer: mesh://ruta?token=...
  Sharer->>Link: Comparte por WhatsApp etc
  Receptor->>API: Abrir token
  API-->>Receptor: Preview snapshot
  Receptor->>API: Guardar en mi perfil
  API->>Perfil: Copia independiente
  Receptor->>API: Crear viaje usando plantilla
  API-->>Receptor: Viaje propio con ruta precargada
```

---

## RN-085–RN-088 (formalizadas)

Ver `reglas-de-negocio.md` §2.9. Contrato: `backend/openapi/rutas-compartidas.yaml`.

### Notas técnicas

- Tablas: `ruta_compartida` (snapshot congelado + token), `ruta_plantilla`, `ruta_plantilla_parada`.
- Deep link: `mesh://ruta?token=...` (distinto de `mesh://unirse`).
- Autorización siempre en backend (RN-030); UI solo orienta.
