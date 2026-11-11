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

Si la cuenta está **suspendida** por un superadmin (RN-123), la conexión se rechaza con
`Error('ACCOUNT_SUSPENDED')`. Al suspender una cuenta, el backend además **corta las
conexiones que ya tenía abiertas** (`socket.disconnect(true)`), así deja de recibir el GPS
del grupo en el acto y no solo en la próxima reconexión.

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
  "altitud": 452.3,                             // opcional, metros
  "precisionAltitud": 6.5,                      // opcional, precisión vertical en metros
  "velocidadKmh": 21.6,                         // opcional, velocidad del chip GPS
  "rumbo": 87.5,                                // opcional, grados (0 = norte)
  "recordedAt": "2026-09-01T13:05:00.000Z",     // ISO 8601 en UTC
  "source": "live"                              // opcional, por defecto "live"
}
```

`altitud`, `precisionAltitud`, `velocidadKmh` y `rumbo` son los mismos campos extra que aceptan
`PUT /ubicacion-viva` y `POST /posiciones` (ver spec OpenAPI). Se guardan en `registro_gps`
y alimentan la altimetría y la velocidad máxima del resumen. De los cuatro, solo `rumbo` se
retransmite a la sala (en `viaje:ubicacion`); altitud y velocidad nunca (RN-070).
Un valor fuera de rango se guarda como `null` sin rechazar el ping (RN-038).

Autorizado por `assertPuedeEnviarGps`: exige que el viaje esté **en curso** y que el usuario
sea el líder o un integrante confirmado que **ya se sumó** al viaje (`check_in_at`,
RN-029b, `POST /api/viajes/{viajeId}/check-in`). Quien confirmó pero no se sumó recibe
`{ "ok": false, "error": "Tenés que sumarte al viaje antes de compartir tu ubicación" }`
(código `NOT_CHECKED_IN` en REST): así no se trackea ni dispara alertas a quien se quedó en casa.

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
El líder queda sumado (check-in implícito); el resto de los confirmados tiene que tocar
"Me sumo" (o "No voy a ir") antes de que su app empiece a mandar GPS (RN-029b).

Para recibir este evento la sala admite a cualquier `confirmado`, se haya sumado o no:
la restricción de check-in aplica solo al envío de GPS, no a ver el mapa.

### `viaje:finalizado`

Emitido por `ViajesService.finalizar()`, y también cuando un superadmin fuerza el cierre de
un viaje colgado (`POST /api/admin/viajes/{viajeId}/finalizar`, RN-125). El payload es el
mismo en ambos casos.

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "estado": "finalizado",
  "fechaFinReal": "2026-09-01T15:30:44.000Z"
}
```

Se emite **antes** de calcular el resumen: el cierre del viaje no espera al agregado de
métricas. Los integrantes confirmados reciben además una notificación push. Quien estaba
`confirmado` pero nunca se sumó pasa a `ausente` antes de armar el resumen (RN-029c).

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
  "rumbo": 87.5,                                // grados (0 = norte) o null si nunca se movió
  "recordedAt": "2026-09-01T13:05:00.000Z",
  "source": "live"
}
```

`rumbo` es el **último rumbo conocido**: si el ping llega sin rumbo (detenido) se conserva el
anterior, para que la flecha no salte al norte en un semáforo. El cliente oculta la flecha
cuando el integrante está detenido, en posible incidente o sin señal.

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
  "usuarioId": "9d8c7b6a-...",
  "estado": "salido"   // "salido" | "ausente"
}
```

- `salido`: se había sumado. Deja de publicar ubicación, pero conserva su fila para
  seguir figurando en el resumen con lo que recorrió. Se cierra su parada abierta (si
  tenía), se resuelven sus alertas del sistema (con `viaje:alerta_actualizada`) y se
  borra su `ubicacion_viva`: deja de aparecer en el mapa también para quien rehidrata por
  `GET /ubicaciones-vivas`.
- `ausente` (RN-029c): nunca se sumó y tocó "No voy a ir". No había nada en vivo que cerrar.

El viaje **no** se cierra para el resto. Si quien sale es el líder, antes se emite
`viaje:lider_cambiado` (tiene que ceder el liderazgo para poder irse, RN-029d).

### `viaje:participante_sumado`

Emitido por `ViajesService.checkIn()` (`POST /api/viajes/{viajeId}/check-in`) cuando un
confirmado toca "Me sumo" con el viaje en curso (RN-029b). No se emite si ya estaba sumado
(el check-in es idempotente).

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "usuarioId": "9d8c7b6a-...",
  "checkInAt": "2026-09-01T13:04:10.000Z"
}
```

Desde ese momento se acepta su GPS. El motor de eventos, además, no lo evalúa (desvío,
atraso, posible incidente) hasta que su primer ping cae a menos de
`distancia_max_separacion` de la ruta: un "Me sumo" tocado desde casa no dispara alertas.

### `viaje:lider_cambiado`

Emitido cuando el líder cede el viaje (`POST /api/viajes/{viajeId}/liderazgo`) o lo cede
para poder bajarse (`POST /salir` con `nuevo_lider_id`), RN-029d.

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "liderAnteriorId": "9d8c7b6a-...",
  "liderNuevoId": "1a2b3c4d-..."
}
```

El cliente refresca el detalle del viaje: desde ese momento las acciones de líder
(iniciar, finalizar, aprobar paradas) son del nuevo líder. Al nuevo líder le llega además
una notificación push.

### `viaje:actualizado`

Emitido por `ViajesService.actualizarViaje()` (`PATCH /api/viajes/{viajeId}`) cada vez que
el líder cambia la fecha, los parámetros del grupo (RN-025) o la configuración de alertas.

```jsonc
{
  "viajeId": "3f2c9a10-..."
}
```

No lleva los valores: el cliente vuelve a pedir el detalle (`GET /api/viajes/{viajeId}`).
El motor de eventos no depende de este evento, relee el viaje en cada ping.

### `viaje:ubicacion_oculta`

Emitido por `PrivacidadService` cuando alguien apaga el compartir ubicación en un viaje
(`PUT /api/viajes/:viajeId/privacidad`) o revoca el consentimiento de geolocalización
(`PUT /api/usuarios/me/privacidad`, que lo emite en cada viaje donde tuviera posición
publicada).

```jsonc
{
  "viajeId": "3f2c9a10-...",
  "usuarioId": "9d8c7b6a-..."
}
```

El cliente tiene que **sacar el marcador**, igual que con `viaje:participante_salio`.
Dejar el último marcador congelado seguiría revelando dónde estaba la persona al apagar
el compartir, que es justo lo que se quiso evitar (RN-111).

Del lado del servidor se borra la fila de `ubicacion_viva`, así que quien rehidrate por
`GET /ubicaciones-vivas` tampoco la recibe. A partir de ahí los pings de esa persona se
siguen guardando en `registro_gps` (RN-038) pero no se publican ni pasan por el motor de
eventos.

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

"Estoy mal" (RN-036, `ParadasService.confirmarEstoyMal()`) también emite `viaje:alerta`:
`tipo: "peligro"`, `origen: "integrante"`, con la ubicación del incidente y el mismo
prefijo `[afectado:{usuarioId}]`.

Mientras un integrante tiene una alerta `activa` de un tipo, el motor no genera otra del
mismo tipo para él. Una parada voluntaria fuera del trazado no cuenta como desvío.

### `viaje:alerta_actualizada`

Cambio de estado de una alerta ya emitida. Lo disparan:

- `PATCH /api/viajes/{viajeId}/alertas/{alertaId}` (RN-042): el líder pausa, reactiva,
  cancela o resuelve una alerta. Si cancela o resuelve la de un posible incidente (o el
  pedido de ayuda), se cierra el incidente entero: se cierra también la otra alerta
  asociada (misma transición), la parada `incidente_detectado` y se emite
  `viaje:parada_finalizada`.
- `MotorEventosService`: resolución automática de `desvio` cuando el integrante vuelve a
  menos de la **mitad** del umbral de separación, y de `atraso` cuando su atraso baja de la
  mitad de la tolerancia (histéresis para no oscilar en el borde).
- `ParadasService.confirmarEstoyBien()`: resuelve las alertas del sistema del integrante y,
  si había pedido ayuda (RN-036), también esa alerta de `peligro`.
- `ParadasService.deshacerEstoyMal()`: cancela el pedido de ayuda de RN-036.
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
ping GPS de un viaje `competitivo` (nunca en moto ni auto, RN-070), como máximo una vez cada 3 s
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
| `viaje:parada_finalizada` | Retomar viaje (US3), confirmar "Estoy bien" (RN-036) o el líder cancela/resuelve la alerta del incidente (RN-042) |
| `viaje:solicitud_parada` | Solicitud de parada al líder (US2) |
| `viaje:solicitud_parada_resuelta` | El líder aprueba o rechaza la solicitud |
| `viaje:parada_grupal_iniciada` | El líder detiene a todo el grupo (RN-045) |
| `viaje:parada_grupal_finalizada` | El líder retoma una parada grupal (RN-045) |

Las paradas grupales emiten un único evento con la lista de integrantes, no uno por persona (RN-033):

```jsonc
// viaje:parada_grupal_iniciada
{
  "viajeId": "...",
  "liderId": "...",
  "nombre": "Leo Díaz",
  "lat": -31.4201,   // punto del líder, igual para todos (RN-111)
  "lng": -64.1888,
  "categoria": "descanso",
  "inicio": "2026-08-21T17:05:00.000Z",
  "paradas": [{ "paradaId": "...", "usuarioId": "..." }]
}

// viaje:parada_grupal_finalizada
{
  "viajeId": "...",
  "liderId": "...",
  "fin": "2026-08-21T17:25:00.000Z",
  "paradas": [{ "paradaId": "...", "usuarioId": "..." }]
}
```

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
| `viaje:gps_ping` | cliente → servidor | sí | `assertPuedeEnviarGps` (confirmado con check-in + en curso) |
| `viaje:iniciado` | servidor → sala | — | solo el creador la dispara |
| `viaje:finalizado` | servidor → sala | — | solo el creador la dispara |
| `viaje:ubicacion` | servidor → sala | — | — |
| `viaje:participante_salio` | servidor → sala | — | — |
| `viaje:participante_sumado` | servidor → sala | — | solo la propia persona la dispara |
| `viaje:lider_cambiado` | servidor → sala | — | solo el líder la dispara |
| `viaje:actualizado` | servidor → sala | — | solo el líder la dispara |
| `viaje:ubicacion_oculta` | servidor → sala | — | solo la propia persona la dispara |
| `viaje:alerta` | servidor → sala | — | — |
| `viaje:alerta_actualizada` | servidor → sala | — | — |
| `viaje:leaderboard` | servidor → sala | — | solo viajes `competitivo` |
| `viaje:parada_iniciada` | servidor → sala | — | — |
| `viaje:parada_finalizada` | servidor → sala | — | — |
| `viaje:solicitud_parada` | servidor → sala | — | — |
| `viaje:solicitud_parada_resuelta` | servidor → sala | — | — |
| `viaje:parada_grupal_iniciada` | servidor → sala | — | solo el líder la dispara |
| `viaje:parada_grupal_finalizada` | servidor → sala | — | solo el líder la dispara |

## Escala

RN-033: el objetivo es soportar entre 150 y 200 usuarios concurrentes por viaje. Con un ping
cada 5 s (RN-031), eso son unos 40 eventos por segundo por viaje, cada uno con una escritura
en `registro_gps` y un upsert en `ubicacion_viva`.

El motor de eventos es **una sola instancia por proceso** (`obtenerMotorEventos`), porque
guarda en memoria el estado de detención y el último progreso en ruta de cada integrante.
Cada ping calcula con PostGIS solo su propio progreso y compara contra el de los demás
cacheado (vigente 30 s); antes recalculaba el de todo el grupo en cada ping (N² consultas
por ciclo).
