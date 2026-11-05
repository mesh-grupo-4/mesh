# US — Premios por recorridos completados (insignias)

> **Estado:** implementada (backend + frontend: perfil propio y pantalla de perfil de otro usuario).
> **Epic:** **E09** — Gamificación extendida (insignias, rachas, tabla global). Tier Deseable.
> **OpenAPI:** `backend/openapi/paths/insignias.yaml` y `backend/openapi/paths/usuarios.yaml#/PerfilPublicoUsuario` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-074 (criterio y otorgamiento automático), RN-070 (nunca velocidad, ni siquiera en moto).
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
| **Públicas en la comunidad** | `GET /insignias/usuario/{usuarioId}` no exige amistad ni viaje en común, solo estar autenticado | Es justamente lo que pide el criterio de aceptación: "visibles para otros usuarios de la comunidad" |
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

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/insignias` | Cualquier usuario autenticado — catálogo completo |
| `GET` | `/api/insignias/mias` | Cualquier usuario autenticado — atajo de la siguiente con su propio id |
| `GET` | `/api/insignias/usuario/{usuarioId}` | Cualquier usuario autenticado — insignias de cualquier otro |
| `GET` | `/api/usuarios/{usuarioId}/perfil` | Cualquier usuario autenticado — perfil público completo (nombre, actividad, estadísticas, insignias y relación de amistad) |

No existe un endpoint para otorgar insignias a mano: solo las otorga
`ViajesService` automáticamente al finalizar un viaje.

---

## Interfaz

- **Perfil propio** (`app/(tabs)/perfil.tsx`): sección "Insignias" debajo del
  bloque de estadísticas, fila horizontal de chips (ícono en círculo +
  nombre), con estado vacío ("Todavía no conseguiste ninguna...").
- **Perfil ajeno** (`app/usuario/[usuarioId].tsx`, nueva pantalla): mismo
  patrón de chips, más estadísticas agregadas y la relación de amistad (badge
  "Son amigos" / "Solicitud enviada" / botón "Agregar amigo" si no hay
  relación). Se abre tocando a una persona en: lista de Amigos y resultados de
  búsqueda (`AmigosTabPanel`), solicitudes pendientes, miembros de un viaje
  (`viaje/[viajeId]/miembros.tsx` y la tarjeta "Participantes" de
  `viaje/[viajeId]/index.tsx`) y miembros de un grupo
  (`grupo/[grupoId]/miembros.tsx`). Tocar la fila propia no navega (ya estás
  en tu perfil desde la pestaña "Perfil").

Pendiente: marcar en el catálogo cuáles insignias le faltan a cada usuario
para conseguir (hoy el catálogo completo vive en `GET /insignias` pero no se
cruza con las obtenidas en ninguna pantalla).
