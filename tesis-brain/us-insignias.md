# US — Premios por recorridos completados (insignias)

> **Estado:** implementada (backend + frontend: perfil propio y pantalla de perfil de otro usuario).
> **Epic:** **E09** — Gamificación extendida (insignias, rachas, tabla global). Tier Deseable.
> **OpenAPI:** `backend/openapi/paths/insignias.yaml` y `backend/openapi/paths/usuarios.yaml#/PerfilPublicoUsuario` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-074 (criterio y otorgamiento automático), RN-070 (nunca velocidad, ni siquiera en moto), RN-133 (catálogo editable por el superadmin).
> **Dependencias:** `MetricaViaje` (generada al finalizar, ver [[us-ranking-viaje]] / RN-061); amistades (`AmistadesService.obtenerRelacion`) para la relación mostrada en el perfil ajeno.

---

## La US

| US | Como… | Quiero… | Para… |
|---|---|---|---|
| **US1** | usuario | ganar insignias al completar recorridos con ciertas características | sentirme recompensado por mis logros |

### Criterios de aceptación

- Se definen criterios de logro: distancia mínima, duración mínima, tipo de actividad.
- Al cumplirse el criterio, el sistema otorga automáticamente la insignia correspondiente.
- Las insignias se muestran en el perfil del usuario.
- Los premios son visibles para otros usuarios de la comunidad.

---

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **Se evalúa al finalizar el viaje** | El otorgamiento cuelga de `ViajesService.generarResumen()`, justo después de confirmar `MetricaViaje` de cada integrante | Es el único momento en que existe una métrica de distancia/duración ya cerrada y fiable; evita calcular "en vivo" sobre datos que todavía pueden cambiar |
| **Criterio por viaje, no acumulado** | Cada criterio se evalúa contra la métrica de UN viaje, nunca sumando varios | Mantiene la regla simple y predecible: "corré 10km en una salida", no "acumulá 10km a lo largo del mes" |
| **Nunca velocidad** | El modelo `Insignia` no tiene (ni debe agregarse) un campo de criterio de velocidad | RN-070 es irrevocable: la moto queda afuera de toda gamificación de velocidad. Insignias de distancia/duración/actividad no comparan velocidades entre sí, así que no chocan con la regla — pero agregar una de velocidad sí lo haría |
| **Idempotente, best-effort** | `evaluarYOtorgar` usa `createMany({ skipDuplicates: true })` sobre el unique `(usuario_id, insignia_id)`, y corre fuera de la transacción del resumen, con su propio try/catch | Una insignia ya obtenida no se duplica ni pisa su fecha; si falla, el cierre del viaje y el resumen ya guardado no se ven afectados (mismo patrón que el resto de `generarResumen`) |
| **Catálogo seedeado por migración** | Las 8 insignias iniciales se insertan por `INSERT ... ON CONFLICT DO NOTHING` en la propia migración, no por un script de seed aparte | El proyecto no tiene infraestructura de seed; usar la migración (ya sancionada por `migrate deploy`) es la vía más simple para datos de catálogo que deben existir siempre |
| **Catálogo editable desde el backoffice (RN-133)** | El superadmin crea, edita, desactiva y elimina insignias (`/api/admin/insignias`). El `codigo` es inmutable y solo se elimina una insignia que nadie obtuvo; si ya se otorgó, se desactiva | El código lo referencia el sistema (p. ej. `centurion_bici` en la reputación de autores). Borrar una otorgada le quitaría el logro a esas personas por el FK en cascada; desactivarla corta el otorgamiento sin tocar lo ganado. Cambiar criterios no revoca ni otorga hacia atrás: solo cuenta para los próximos viajes finalizados |
| **Visibles según lo que elija cada persona (RN-077)** | `GET /insignias/usuario/{usuarioId}` y el perfil pasan por `assertPuedeVerLogros` / `puedeVerLogros` (`modules/privacidad/logros.acceso.ts`). Con `todos` (default) las ve cualquier usuario autenticado; con `amigos`, solo amistades aceptadas; con `solo_yo`, nadie más. Sin permiso: `403 LOGROS_PRIVADOS` en el endpoint suelto y `null` en el perfil | El criterio original pedía "visibles para otros usuarios de la comunidad", y el default lo cumple. Se agregó la opción de cerrarlas porque son datos de actividad de la persona: lo decide ella. Un solo selector para estadísticas, racha e insignias, por simplicidad |
| **Rareza fija por insignia (RN-078)** | Columna `rareza` (`comun`, `rara`, `epica`, `legendaria`) asignada a mano en el catálogo | Calcularla por % de usuarios que la tienen daría resultados inestables con pocos usuarios (casi todo saldría "legendaria"). La rareza solo cambia cómo se ve; no compara personas ni toca el otorgamiento |
| **Perfil ajeno compone, no duplica** | `GET /usuarios/{id}/perfil` (módulo `usuarios`) reutiliza `ViajesService.estadisticasUsuario()`, `InsigniasService.listarDeUsuario()` y la nueva `AmistadesService.obtenerRelacion()`, en vez de reimplementar las consultas | Cada pieza de dato ya tenía su servicio; componerlas evita tener dos fuentes de verdad para lo mismo |

---

## Modelo de datos

```
Insignia
├── id (PK)
├── codigo (unique)             ← slug estable, no depende del nombre visible
├── nombre
├── descripcion (nullable)
├── icono                       ← nombre de ícono de @expo/vector-icons/Feather
├── rareza (RarezaInsignia)     ← comun | rara | epica | legendaria (RN-078, solo visual)
├── criterio_distancia_m (nullable)
├── criterio_duracion_seg (nullable)
├── criterio_actividad (nullable, TipoActividad)
├── activa
└── created_at

UsuarioInsignia
├── id (PK)
├── usuario_id (FK)
├── insignia_id (FK)
├── viaje_id (FK, nullable)     ← qué viaje disparó el logro
└── obtenida_at

UNIQUE (usuario_id, insignia_id)   ← una sola vez por persona
```

Los tres criterios son independientes entre sí (AND) y opcionales (`null` = no
aplica). Una insignia sin ningún criterio (los tres en `null`) se otorga apenas
el usuario tiene una primera métrica — así funciona `primer_recorrido`.

Migración: `20261023120000_insignias`. Catálogo inicial (8 insignias): ver el
`INSERT` de esa migración o `GET /api/insignias`.

Rareza (migración `20261110120000_logros_visibilidad_rareza`):

| Rareza | Insignias |
|---|---|
| Común | Primer recorrido, Hora en marcha |
| Rara | 10K, 50K en bici |
| Épica | Media maratón, Trekker resistente, Rodador de 100 |
| Legendaria | Centurión |

"Rodador de 100" (moto) es por distancia, nunca por velocidad: su rareza no
choca con RN-070.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/insignias` | Cualquier usuario autenticado — catálogo completo |
| `GET` | `/api/insignias/mias` | Cualquier usuario autenticado — atajo de la siguiente con su propio id |
| `GET` | `/api/insignias/usuario/{usuarioId}` | Cualquier usuario autenticado, si la persona comparte sus logros con quien consulta (RN-077); si no, `403 LOGROS_PRIVADOS` |
| `GET` | `/api/usuarios/{usuarioId}/perfil` | Cualquier usuario autenticado — nombre, actividad y relación de amistad siempre; estadísticas, insignias y racha solo si los comparte (si no, vuelven en `null` con `logros_visibles: false`) |
| `PUT` | `/api/usuarios/me/privacidad` | Cada usuario — `visibilidad_logros`: `todos`, `amigos` o `solo_yo` |

Backoffice (solo `superadmin`, RN-133, auditado):

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/admin/insignias` | Catálogo completo, incluidas las inactivas, con `cantidad_otorgadas` (cuántas personas, nunca quiénes) |
| `POST` | `/api/admin/insignias` | Crea una insignia; `409 INSIGNIA_CODIGO_DUPLICADO` si el código existe |
| `PATCH` | `/api/admin/insignias/{insigniaId}` | Edita lo recibido (no el código); `activa: false` la desactiva |
| `DELETE` | `/api/admin/insignias/{insigniaId}` | Solo si nadie la obtuvo; si no, `409 INSIGNIA_OTORGADA` |

No existe un endpoint para otorgar insignias a mano: solo las otorga
`ViajesService` automáticamente al finalizar un viaje.

---

## Interfaz

- **Chip con rareza** (`components/perfil/InsigniaChip.tsx`): color, marco y
  etiqueta por rareza (común gris, rara azul, épica violeta, legendaria
  dorada). Épicas y legendarias tienen un destello que cruza el chip cada
  unos segundos; las legendarias, además, un halo que late alrededor del
  ícono. Sin animaciones si el sistema tiene "reducir movimiento". Se ordenan
  de la más rara a la más común. Tocar un chip abre el detalle
  (`DetalleInsigniaModal`: rareza, descripción y fecha en hora argentina).
- **Perfil propio** (`app/(tabs)/perfil.tsx`): sección "Insignias" debajo del
  bloque de estadísticas, fila horizontal de chips, con estado vacío
  ("Todavía no conseguiste ninguna...").
- **Perfil ajeno** (`app/usuario/[usuarioId].tsx`): todas las insignias en
  grilla, más estadísticas agregadas, la racha (con fondo y fueguitos según
  nivel, ver [[us-rachas]]) y la relación de amistad (badge "Son amigos" /
  "Solicitud enviada" / botón "Enviar solicitud de amistad" si no hay
  relación). Si la persona no comparte sus logros, en lugar de todo eso se ve
  una tarjeta "Logros privados" con candado; el botón de amistad sigue
  visible. Se abre tocando a una persona en: lista de Amigos y resultados de
  búsqueda (`AmigosTabPanel`), solicitudes pendientes, miembros de un viaje
  (`viaje/[viajeId]/miembros.tsx` y la tarjeta "Participantes" de
  `viaje/[viajeId]/index.tsx`) y miembros de un grupo
  (`grupo/[grupoId]/miembros.tsx`). Tocar la fila propia no navega (ya estás
  en tu perfil desde la pestaña "Perfil").

- **Backoffice** (*Perfil → Administración → Insignias*, `app/admin/insignias.tsx` y
  `app/admin/insignia/[insigniaId].tsx`, `nueva` para el alta): activas e inactivas con
  sus criterios y cuántas personas las obtuvieron. El editor muestra el chip tal como se
  va a ver, ofrece una lista de íconos de Feather, carga distancia en km y tiempo en
  minutos (el backend guarda metros y segundos) y avisa si no tiene ningún criterio. Si la
  insignia ya se otorgó, en lugar de "Eliminar" explica que hay que desactivarla.

Pendiente: marcar en el catálogo cuáles insignias le faltan a cada usuario
para conseguir (hoy el catálogo completo vive en `GET /insignias` pero no se
cruza con las obtenidas en ninguna pantalla).
