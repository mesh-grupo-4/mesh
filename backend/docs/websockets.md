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

Tras emitirlo, el backend cierra todo lo que solo tiene sentido en curso: pone `fin` a las
paradas abiertas, resuelve las alertas `activa`/`pausada` (una `viaje:alerta_actualizada`
por cada una) y borra las filas de `ubicacion_viva` del viaje.

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
`recordedAt` es el instante de la lectura en el dispositivo y `source` dice por dónde
llegó: un lote `offline_sync` solo se publica si su posición más nueva es posterior a la
última ya conocida del integrante (así el marcador nunca retrocede al sincronizar), y
solo esa posición pasa por el motor de eventos. Un ping por debajo de la precisión mínima
de la modalidad (RN-021) se persiste pero no se emite si ya había una posición mejor.

> **RN-032:** la latencia máxima tolerada entre la lectura y su aparición en el mapa es de
> 10 segundos.

### Reconexión

Socket.io reconecta solo, pero **las salas no sobreviven a la reconexión**: el servidor
crea un socket nuevo y el cliente tiene que volver a emitir `join_viaje` por cada viaje
que le interesa. El frontend (`frontend/lib/meshSocket.ts`) recuerda las salas pedidas y
las re-suscribe en cada `connect`; los hooks del mapa además refrescan por REST al
reconectar para cubrir lo que se perdió mientras tanto.

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
Al salir se cierra su parada abierta (si tenía), se resuelven sus alertas del sistema
(con `viaje:alerta_actualizada`) y se borra su `ubicacion_viva`: deja de aparecer en el
mapa también para quien rehidrata por `GET /ubicaciones-vivas`.

### `viaje:alerta`

Emitido por `AlertasService.crear()` al publicar una alerta manual, por
`MotorEventosService` al detectar desvío (RN-034), atraso (RN-035) o posible
incidente (RN-036), y por `ParadasService.iniciarParada()` cuando la parada
voluntaria es de categoría `accidente` (RN-022): alerta `tipo: "peligro"`,
`origen: "integrante"`, con la ubicación de la parada.

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "alerta": {
    "id": "...",
    "tipo": "combustible", // parada | combustible | desvio | peligro | informacion | atraso
    "origen": "lider", // lider | integrante | sistema
    "mensaje": "Paramos en la próxima estación de servicio",
    "estado": "activa",
    "creada_por_id": "9d8c7b6a-...",
    "lat": -31.4201, // opcional: punto de parada futuro marcado en el mapa
    "lng": -64.1888
  }
}
```

En el frontend, las alertas manuales con `lat`/`lng` muestran un banner grupal con
**Seguir** / **Ignorar** (misma lógica que `viaje:parada_iniciada`): Seguir calcula
ruta OSRM hasta el punto y dibuja una guía índigo en el mapa.

Las alertas del sistema incluyen el prefijo interno `[afectado:{usuarioId}]` en
`mensaje` para deduplicar por integrante; el frontend lo oculta al mostrar.

Mientras un integrante tiene una alerta `activa` de un tipo, el motor no genera otra del
mismo tipo para él. Una parada voluntaria fuera del trazado no cuenta como desvío.

### `viaje:alerta_actualizada`

Cambio de estado de una alerta ya emitida. Lo disparan:

- `PATCH /api/viajes/{viajeId}/alertas/{alertaId}` (RN-042): el líder pausa, reactiva,
  cancela o resuelve una alerta.
- `MotorEventosService`: resolución automática de `desvio` cuando el integrante vuelve a
  menos de la **mitad** del umbral de separación, y de `atraso` cuando su atraso baja de la
  mitad de la tolerancia (histéresis para no oscilar en el borde).
- `ParadasService.confirmarEstoyBien()`: resuelve las alertas del sistema del integrante.
- `ViajesService.salirViaje()` y `finalizar()`: resuelven las que quedaban abiertas.

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "alertaId": "7e8f90a1-...",
  "estado": "resuelta", // activa | pausada | cancelada | resuelta
  "resolvedAt": "2026-09-01T13:20:00.000Z" // null si vuelve a activa o queda pausada
}
```

En el frontend actualiza el historial, saca la alerta del mapa si dejó de estar `activa`
y cierra su banner si todavía estaba en pantalla.

### `viaje:leaderboard`

RN-071 (modo competitivo): clasificación en vivo. La emite `MotorEventosService` con cada
ping GPS de un viaje `competitivo` (nunca en moto, RN-070), como máximo una vez cada 3 s
por viaje, a partir del progreso sobre la ruta que ya tiene cacheado de cada integrante.
La foto inicial se carga con `GET /api/viajes/{viajeId}/leaderboard`.

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "generadoEn": "2026-09-01T13:20:00.000Z",
  "filas": [
    { "usuarioId": "9d8c...", "nombre": "Ana Pérez", "progresoM": 5420, "lat": -31.41, "lng": -64.18,
      "actualizadoEn": "2026-09-01T13:19:58.000Z", "puesto": 1, "deltaM": 0, "gapSeg": 0 },
    { "usuarioId": "7e8f...", "nombre": "Juan Gómez", "progresoM": 5100, "lat": -31.412, "lng": -64.183,
      "actualizadoEn": "2026-09-01T13:19:57.000Z", "puesto": 2, "deltaM": 320, "gapSeg": 32.9 }
  ]
}
```

`deltaM` son los metros detrás del líder y `gapSeg` ese mismo atraso expresado en segundos
a la velocidad esperada del viaje. El ghost tracking (RN-073) **no** usa sockets: el cliente
descarga la traza histórica por REST y la anima localmente.

### Paradas voluntarias e incidentes (`paradas.service.ts`, `motorEventos.service.ts`)

| Evento | Cuándo |
|---|---|
| `viaje:parada_iniciada` | Parada voluntaria (US1) o incidente detectado por el motor (RN-036) |
| `viaje:parada_finalizada` | Retomar viaje (US3) o confirmar "Estoy bien" (RN-036) |
| `viaje:solicitud_parada` | Solicitud de parada al líder (US2) |
| `viaje:solicitud_parada_resuelta` | El líder aprueba o rechaza la solicitud |

Payload de `viaje:parada_iniciada` cuando el motor detecta detención sospechosa:

```jsonc
{
  "viajeId": "...",
  "paradaId": "...",
  "usuarioId": "...",
  "nombre": "Ana Pérez",
  "lat": -31.4201,
  "lng": -64.1888,
  "categoria": null,
  "inicio": "2026-08-21T17:05:00.000Z",
  "estado": "posible_incidente"
}
```

Para paradas voluntarias, `estado` es `detenido_voluntario`. El frontend en `live` escucha este evento para mostrar un banner a todos los participantes (excepto quien paró) con nombre y motivo; «Seguir parada» dibuja guía OSRM en el mapa.

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
| `viaje:alerta` | servidor → sala | — | — |
| `viaje:alerta_actualizada` | servidor → sala | — | — |
| `viaje:leaderboard` | servidor → sala | — | solo viajes `competitivo` |
| `viaje:parada_iniciada` | servidor → sala | — | — |
| `viaje:parada_finalizada` | servidor → sala | — | — |
| `viaje:solicitud_parada` | servidor → sala | — | — |
| `viaje:solicitud_parada_resuelta` | servidor → sala | — | — |

## Escala

RN-033: el objetivo es soportar entre 150 y 200 usuarios concurrentes por viaje. Con un ping
cada 5 s (RN-031), eso son unos 40 eventos por segundo por viaje, cada uno con una escritura
en `registro_gps` y un upsert en `ubicacion_viva`.

El motor de eventos es **una sola instancia por proceso** (`obtenerMotorEventos`), porque
guarda en memoria el estado de detención y el último progreso en ruta de cada integrante.
Cada ping calcula con PostGIS solo su propio progreso y compara contra el de los demás
cacheado (vigente 30 s); antes recalculaba el de todo el grupo en cada ping (N² consultas
por ciclo).
