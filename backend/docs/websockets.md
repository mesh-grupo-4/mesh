# API de tiempo real — Socket.io

Los eventos en tiempo real de Mesh **no** están en el spec OpenAPI: OpenAPI describe HTTP,
no WebSockets. Este documento es la especificación del canal Socket.io.

- Implementación: [`src/sockets/index.ts`](../src/sockets/index.ts) y [`src/sockets/auth.ts`](../src/sockets/auth.ts)
- Emisión desde la lógica de negocio: [`src/modules/viajes/viajes.service.ts`](../src/modules/viajes/viajes.service.ts)
- API REST: [`/api/docs`](http://localhost:3000/api/docs)

---

## Conexión

Socket.io v4 comparte el mismo servidor HTTP y el mismo puerto que la API REST
(`src/index.ts`). No hay un segundo puerto que abrir.

```ts
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000', {
  auth: { token: await user.getIdToken() },   // Firebase ID token
})
```

### Autenticación del handshake

El middleware global `socketRequireUser` corre **antes** de aceptar la conexión. Busca el
Firebase ID token, en este orden:

1. `handshake.headers.authorization` con el formato `Bearer <token>`
2. `handshake.auth.token` — con o sin el prefijo `Bearer `
3. `handshake.auth.authorization` con el formato `Bearer <token>`

Verifica el token con `firebaseAuth.verifyIdToken()`, resuelve el usuario local con
`findOrCreateByFirebaseUid()` y deja el UUID en `socket.data.userId`.

Si no hay token o es inválido, la conexión **se rechaza** con `Error('UNAUTHORIZED')`;
el cliente lo recibe en el evento `connect_error`.

### CORS

- Desarrollo: `origin: true` (cualquier origen).
- Producción: el valor de `CORS_ORIGIN`, con `http://localhost:5173` como respaldo.

---

## Salas

Una sala por viaje, con el formato **`viaje:<uuid>`**. Todos los eventos que el servidor
emite van dirigidos a una sala, nunca a un socket suelto.

Unirse a la sala está autorizado por `assertPuedeVerEnVivo`, que es **estricto** (RN-030):
solo pasan el creador del viaje y los integrantes en estado `confirmado`. Quien salió del
viaje deja de recibir el GPS del grupo.

---

## Eventos del cliente al servidor

Los tres validan su payload con Zod y aceptan un callback de *ack* como segundo argumento.
El ack tiene la forma `{ ok: true }` o `{ ok: false, error: '<código>' }`.

### `join_viaje`

Se suscribe a las actualizaciones en vivo del viaje.

```jsonc
// payload
{ "viajeId": "3f2c9a10-8b5e-4a71-9c3d-1e2f4a5b6c7d" }

// ack
{ "ok": true }
{ "ok": false, "error": "FORBIDDEN" }
```

| `error` del ack | Motivo |
|---|---|
| `INVALID_PAYLOAD` | El payload no pasó la validación Zod |
| `VIAJE_NOT_FOUND` | El viaje no existe |
| `FORBIDDEN` | El usuario no es creador ni integrante confirmado |
| `ERROR` | Fallo inesperado |

### `leave_viaje`

Se da de baja de la sala. Mismo payload que `join_viaje`.

**No tiene ack ni valida autorización**: salir de una sala nunca puede ser una operación
privilegiada. Un payload inválido se descarta en silencio.

### `viaje:gps_ping`

Publica una posición GPS por el canal de tiempo real. Es la alternativa de baja latencia a
`PUT /api/viajes/{viajeId}/ubicacion-viva`, y hace exactamente lo mismo: persiste un
`registro_gps` y refresca la ubicación viva.

```jsonc
// payload
{
  "viajeId": "3f2c9a10-8b5e-4a71-9c3d-1e2f4a5b6c7d",
  "lat": -31.4201,
  "lng": -64.1888,
  "accuracy": 8.4,                              // opcional
  "recordedAt": "2026-09-01T13:05:00.000Z",     // ISO 8601 en UTC
  "source": "live"                              // opcional, por defecto "live"
}
```

Autorizado por `assertPuedeEnviarGps`: exige que el viaje esté **en curso** y que el usuario
sea creador o integrante confirmado.

A diferencia de los otros dos eventos, el `error` del ack trae el **mensaje** del `HttpError`,
no su código:

```jsonc
{ "ok": false, "error": "El viaje no admite envío de GPS en este estado" }
```

> **RN-031:** el frontend emite un ping cada 5 segundos mientras el viaje está en curso.
> **RN-038:** los pings que no se pudieron enviar se encolan en el dispositivo
> (`frontend/lib/tracking/gpsQueue.ts`) y se sincronizan al reconectar por
> `POST /api/viajes/{viajeId}/posiciones` con `source: offline_sync`, en lotes de hasta 2000.

---

## Eventos del servidor al cliente

Todos se emiten a la sala `viaje:<id>`, así que solo llegan a quienes hicieron `join_viaje`.

### `viaje:iniciado`

Emitido por `ViajesService.iniciar()` cuando el creador arranca el viaje.

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "nombre": "Ruta de las Altas Cumbres",
  "estado": "en_curso",
  "fechaInicioReal": "2026-09-01T13:00:12.000Z",
  "iniciadoPor": "9d8c7b6a-..."
}
```

A partir de este evento el viaje acepta GPS, y el QR de invitación queda caduco (RN-015).

### `viaje:finalizado`

Emitido por `ViajesService.finalizar()`.

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "estado": "finalizado",
  "fechaFinReal": "2026-09-01T15:30:44.000Z"
}
```

Se emite **antes** de calcular el resumen: el cierre del viaje no espera al agregado de
métricas. Los integrantes confirmados reciben además una notificación push.

### `viaje:ubicacion`

Posición de un integrante. Es lo que mueve los marcadores del mapa grupal.

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "usuarioId": "9d8c7b6a-...",
  "lat": -31.4201,
  "lng": -64.1888,
  "precision": 8.4,
  "recordedAt": "2026-09-01T13:05:00.000Z",
  "source": "live"
}
```

Se dispara desde `upsertUbicacionVivaSnapshot`, así que sale por igual venga la posición
del socket (`viaje:gps_ping`) o de cualquiera de los dos endpoints REST de GPS.

> **RN-032:** la latencia máxima tolerada entre la lectura y su aparición en el mapa es de
> 10 segundos.

### `viaje:participante_salio`

Emitido por `ViajesService.salirViaje()`, y **solo si el viaje está en curso**.

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "usuarioId": "9d8c7b6a-..."
}
```

La persona pasa a estado `salido` y deja de publicar ubicación, pero conserva su fila para
seguir figurando en el resumen con lo que recorrió. El viaje **no** se cierra para el resto.

---

## Resumen

| Evento | Dirección | Ack | Autorización |
|---|---|---|---|
| `join_viaje` | cliente → servidor | sí | `assertPuedeVerEnVivo` (confirmado) |
| `leave_viaje` | cliente → servidor | no | ninguna |
| `viaje:gps_ping` | cliente → servidor | sí | `assertPuedeEnviarGps` (confirmado + en curso) |
| `viaje:iniciado` | servidor → sala | — | solo el creador la dispara |
| `viaje:finalizado` | servidor → sala | — | solo el creador la dispara |
| `viaje:ubicacion` | servidor → sala | — | — |
| `viaje:participante_salio` | servidor → sala | — | — |

## Escala

RN-033: el objetivo es soportar entre 150 y 200 usuarios concurrentes por viaje. Con un ping
cada 5 s (RN-031), eso son unos 40 eventos por segundo por viaje, cada uno con una escritura
en `registro_gps` y un upsert en `ubicacion_viva`.
