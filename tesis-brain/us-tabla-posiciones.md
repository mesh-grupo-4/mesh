# US — Tabla de posiciones global por tipo de actividad

> **Estado:** implementada (backend + frontend, pantalla dedicada).
> **Epic:** **E09** — Gamificación extendida (insignias, rachas, tabla global). Tier Deseable.
> **OpenAPI:** `backend/openapi/paths/tabla-posiciones.yaml` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-076 (segmentación y período), RN-070 (moto excluida, nunca por velocidad).
> **Dependencias:** `MetricaViaje` (mismo dato que [[us-insignias]] y [[us-rachas]]); `reportes.periodo.ts` para los cálculos de fecha en ART.

---

## La US

| US | Como… | Quiero… | Para… |
|---|---|---|---|
| **US1** | usuario | ver una tabla de posiciones con otros usuarios ordenada por kilómetros recorridos o tiempo en movimiento | conocer mi posición en la comunidad |

### Criterios de aceptación

- La tabla está segmentada por tipo de actividad (bici, running, trekking).
- La modalidad moto no tiene tabla de posiciones.
- El ranking puede filtrarse por período: semanal, mensual, anual.
- Se muestra la posición del usuario en la tabla y los 3 primeros puestos.

---

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **`otro` también tiene tabla** | El criterio de aceptación solo nombra "bici, running, trekking", pero la matriz de parámetros por actividad (RN-021, sección "Interfaz adaptativa") ya documentada en este archivo dice explícitamente `Tabla de posiciones global: Otro → Sí`. Se tomó esa matriz preexistente como la fuente de verdad del alcance exacto, no la lista de ejemplos del criterio de aceptación — moto sigue siendo el único tipo excluido (RN-070) | Evita que esta US contradiga una regla ya establecida en el mismo documento. Si en algún momento se decide que `otro` tampoco debería tener tabla, hay que actualizar esa matriz primero, no solo este endpoint |
| **Sin tabla persistida: se calcula al leer** | `TablaPosicionesService.obtener()` suma `MetricaViaje` de los viajes finalizados de esa actividad con `fecha_fin_real` desde el inicio del período, agrupado por usuario (`groupBy`), on-demand | Mismo principio que la racha "vigente": nada que recalcular con un job, nada que pueda desincronizarse. El costo son dos queries por request (viajes del período + groupBy de métricas), aceptable a la escala del proyecto |
| **Período = ventana calendario en curso** | "Semanal/mensual/anual" es la semana/mes/año que está transcurriendo ahora (ART), no una ventana de N días hacia atrás ni un período elegible por el usuario | Es la lectura más simple de "ranking semanal": se resetea solo al empezar cada semana/mes/año, como cualquier tabla de posiciones de temporada. No había pedido de navegar a períodos pasados |
| **`mi_posicion` siempre viaja aparte del `top`** | La respuesta trae `top` (máximo 3) y, por separado, `mi_posicion` con el puesto real de quien consulta, esté o no entre esos 3 | Es literalmente el criterio de aceptación ("se muestra la posición del usuario... y los 3 primeros puestos") — ambos datos, no uno u otro |
| **`usuario_id` agrupa directo, sin resolver "quién participó"** | A diferencia de `estadisticasUsuario()`, acá no hace falta la lógica de "creador o integrante confirmado/salido": `MetricaViaje` ya tiene una fila por participante con GPS, así que agrupar por su `usuario_id` alcanza | Evita duplicar una regla de participación que para este caso no aporta nada: si hay métrica, participó |
| **Nunca un campo de velocidad** | La fila de la tabla (`FilaTablaPosiciones`) solo tiene `distancia_m` y `tiempo_movimiento_seg`. `orden` elige entre esos dos, nunca un tercero | RN-070 explícita en el propio criterio de aceptación ("ordenada por kilómetros recorridos o tiempo en movimiento") |

---

## Modelo de datos

Ninguno nuevo: se computa on-demand a partir de `MetricaViaje` + `Viaje` (ver
[[reglas-de-negocio]]). No hay nada persistido aparte de esas dos tablas ya
existentes.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/tabla-posiciones?tipoActividad=&periodo=&orden=` | Cualquier usuario autenticado |

Parámetros: `tipoActividad` (requerido: `bici`\|`running`\|`trekking`\|`otro` —
`moto` responde `400 VALIDATION_ERROR`), `periodo` (opcional, default
`semanal`), `orden` (opcional, default `distancia`).

---

## Interfaz

Pantalla dedicada `app/ranking.tsx` (ruta standalone, no es tab — se llega
desde un link "Tabla de posiciones" en el perfil propio, junto a "Mis rutas"
y "Privacidad y ubicación"):

- Tres filas de chips: actividad (Bici/Running/Trekking/Otro — sin Moto),
  período (Esta semana/Este mes/Este año), orden (Kilómetros/Tiempo en
  movimiento).
- Podio con los 3 primeros puestos (medallas 🥇🥈🥉), resaltando la fila propia
  si está entre ellos.
- Si quien consulta no está en el top 3, una fila aparte "#N · Vos" con su
  puesto real.
- Estado vacío si nadie completó un viaje de esa actividad en el período.

Pendiente: no hay forma de navegar a un período pasado (solo el vigente), ni
de ver el ranking de otro usuario como haría clic en una fila del podio.
