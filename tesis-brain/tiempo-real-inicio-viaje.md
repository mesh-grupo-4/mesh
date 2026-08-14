# Tiempo real — Inicio de viaje y monitoreo GPS

## División de canales

| Canal | Tecnología | Uso |
|-------|------------|-----|
| `trip:{viajeId}` | Supabase Realtime **Broadcast** | Señal de inicio de viaje (`TRIP_STARTED`) → modal emergente en participantes |
| `ubicacion_viva` | Supabase Realtime **postgres_changes** | Posiciones en vivo filtradas por `viaje_id` → mapa grupal en `/viaje/[id]/live` |
| `viaje:{viajeId}` (Socket.io room) | Socket.io vía backend Node | Finalización (`viaje:finalizado`), inicio legacy (`viaje:iniciado`) |
| REST `PUT /api/viajes/:id/ubicacion-viva` | Express + Prisma | Emisor GPS: upsert snapshot + historial `registro_gps` |
| REST `GET /api/viajes/:id/ubicaciones-vivas` | Express + Prisma | Snapshot inicial al montar pantalla live |
| REST `POST /api/viajes/:id/iniciar` | Express + Prisma | Fuente de verdad: `estado = en_curso`, `fecha_inicio_real` |
| REST `POST /api/viajes/:id/posiciones` | Express + Prisma | Offline sync RN-038; actualiza última fila en `ubicacion_viva` |

## Evento TRIP_STARTED

**Emisor:** cliente del líder (creador del viaje), inmediatamente después de un `POST /iniciar` exitoso.

**Payload:**

```json
{
  "viajeId": "uuid",
  "nombre": "string | null",
  "estado": "en_curso",
  "fechaInicioReal": "ISO-8601",
  "iniciadoPor": "uuid del creador"
}
```

**Receptores:** participantes con app abierta suscritos al canal `trip:{viajeId}` (viajes planificados confirmados + viaje en curso).

**UX participante:** modal prioritario + vibración → botón "Unirme al recorrido" → tracking GPS (5 s, RN-031) + navegación a `/viaje/[id]/live`.

**UX líder:** sin modal (`iniciadoPor` coincide con su `userId`); redirect directo a live tras broadcast.

## Monitoreo en vivo (E04)

**Emisor:** `ViajeRealtimeBridge` escucha `mesh:location_tick` (task cada 5 s) y llama `PUT /ubicacion-viva`.

**Receptor:** `useLiveLocations` carga snapshot REST + suscripción `postgres_changes` en tabla `ubicacion_viva`.

**Refresco de respaldo (RN-032):** además de Realtime y Socket.io, el hook repolea `GET /ubicaciones-vivas`.
El período es **adaptativo**: 15 s con Realtime suscripto y **8 s** cuando el canal reporta `CHANNEL_ERROR` /
`TIMED_OUT`. Así el peor caso queda bajo los 10 s de latencia máxima, aun con Realtime y socket caídos.

**Frescura de posición:** `useLiveLocations` expone `isStale` por integrante cuando su `updated_at` supera los
**30 s** (seis ciclos GPS de RN-031). El marcador se atenúa y la lista muestra "Sin señal". Es un indicador de
señal perdida, **no** un estado de integrante RN-037 (eso sigue siendo E05).

**Métricas locales:** cronómetro desde `fecha_inicio_real`; distancia acumulada con Haversine sobre ticks propios.
El acumulado se **persiste en AsyncStorage** bajo `mesh:metrics:{viajeId}:{userId}` (`lib/tripMetricsStore.ts`),
así la distancia sobrevive a salir y volver a la pantalla. Se borra en `detenerTrackingViaje()`, que corre al
finalizar el viaje, al salir y al recibir `viaje:finalizado`.

**Nombres e iniciales:** los avatares usan iniciales (sin fotos de perfil). `GET /participantes` y
`GET /viajes/:id` devuelven `apellido` junto a `nombre` para que las iniciales sean de dos letras.

**Supabase manual:** habilitar `ubicacion_viva` en Realtime Replication. Ver `backend/prisma/supabase-realtime-ubicacion-viva.md`.

## Autorización

- Solo el **creador del viaje** (`creador_id`) puede llamar a `POST /iniciar` (RN-030).
- Escrituras GPS validadas en backend (`assertPuedeEnviarGps`).
- **`join_viaje` (Socket.io) valida en el backend** antes de unir el socket a la room `viaje:{viajeId}`, y
  responde por `ack` con `{ ok: false, error }` si el usuario no tiene acceso. Sin este chequeo cualquier
  usuario autenticado podía recibir las posiciones GPS de un viaje ajeno.
- Hay **dos niveles de autorización**, y la diferencia importa:
  - `assertPuedeVerViaje` — **laxa**, acepta todo lo que no sea `rechazado`, incluido `salido`. Para lectura:
    detalle, ruta, participantes y resumen. Quien abandonó el viaje igual puede ver su resumen.
  - `assertPuedeVerEnVivo` — **estricta**, exige `confirmado`. Para datos en vivo: `join_viaje` y
    `GET /ubicaciones-vivas`. Así quien sale de un viaje deja de recibir el GPS del grupo.
- Lectura Realtime con anon key + RLS SELECT (MVP tesis).

## Cierre del viaje (E04/E06)

`POST /finalizar` cambia el estado **fuera de transacción** y recién después calcula el resumen, para que un
agregado pesado (hasta ~480k filas GPS en un viaje de 200 personas) no arriesgue el timeout de 5 s de Prisma
ni impida cerrar el viaje. Si el cálculo falla, `GET /resumen` lo rehace (backfill perezoso), lo que además
cubre los viajes cerrados antes de esta feature.

`POST /salir` es **salida blanda**: `estado = 'salido'` + `fecha_salida`, sin borrar la fila. El viaje sigue
en curso para el resto. Solo el creador puede cerrarlo para todos (RN-030).

## Fuera de alcance (este ticket)

- Push nativa con app matada (FCM).
- Broadcast desde backend con service role (fase 2, mayor confiabilidad si falla red del líder).
- Estados de integrante y alertas (E05).

## Archivos clave

- `frontend/lib/supabase.ts` — cliente Supabase
- `frontend/lib/tripBroadcast.ts` — emit / subscribe TRIP_STARTED
- `frontend/hooks/useLiveLocations.ts` — suscripción postgres_changes, polling adaptativo, `isStale`
- `frontend/hooks/useTripMetrics.ts` — cronómetro + distancia Haversine
- `frontend/lib/tripMetricsStore.ts` — persistencia del acumulado de distancia
- `frontend/lib/nombres.ts` — `nombreCompleto()` para las iniciales del avatar
- `backend/src/sockets/index.ts` — handlers `join_viaje` (autorizado) / `viaje:gps_ping`
- `frontend/components/live/` — mapa OSM, marcadores, panel métricas
- `frontend/components/ViajeRealtimeBridge.tsx` — emisor REST GPS
- `frontend/context/TripRealtimeContext.tsx` — listener global + modal
- `frontend/components/TripStartedModal.tsx` — UI emergente
- `backend/src/modules/viajes/viajes.service.ts` — upsert `ubicacion_viva`, `iniciar()`, finalizar
- `backend/prisma/schema.prisma` — modelo `UbicacionViva`
