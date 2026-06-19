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

**Métricas locales:** cronómetro desde `fecha_inicio_real`; distancia acumulada con Haversine sobre ticks propios.

**Supabase manual:** habilitar `ubicacion_viva` en Realtime Replication. Ver `backend/prisma/supabase-realtime-ubicacion-viva.md`.

## Autorización

- Solo el **creador del viaje** (`creador_id`) puede llamar a `POST /iniciar` (RN-030).
- Escrituras GPS validadas en backend (`assertPuedeEnviarGps`).
- Lectura Realtime con anon key + RLS SELECT (MVP tesis).

## Fuera de alcance (este ticket)

- Push nativa con app matada (FCM).
- Broadcast desde backend con service role (fase 2, mayor confiabilidad si falla red del líder).
- Estados de integrante y alertas (E05).

## Archivos clave

- `frontend/lib/supabase.ts` — cliente Supabase
- `frontend/lib/tripBroadcast.ts` — emit / subscribe TRIP_STARTED
- `frontend/hooks/useLiveLocations.ts` — suscripción postgres_changes
- `frontend/hooks/useTripMetrics.ts` — cronómetro + distancia Haversine
- `frontend/components/live/` — mapa OSM, marcadores, panel métricas
- `frontend/components/ViajeRealtimeBridge.tsx` — emisor REST GPS
- `frontend/context/TripRealtimeContext.tsx` — listener global + modal
- `frontend/components/TripStartedModal.tsx` — UI emergente
- `backend/src/modules/viajes/viajes.service.ts` — upsert `ubicacion_viva`, `iniciar()`, finalizar
- `backend/prisma/schema.prisma` — modelo `UbicacionViva`
