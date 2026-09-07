# Simulador de GPS — `simulate-trip.ts`

Herramienta de **desarrollo** para emular uno o varios participantes recorriendo una ruta
real, con paradas, atrasos, desvíos e incidentes. Sirve para validar el mapa en vivo y el
motor de eventos (RN-034 / RN-035 / RN-036) desde la compu, sin salir a la calle.

No forma parte del build: `tsconfig.json` tiene `rootDir: ./src`, así que `scripts/` nunca
entra a `dist/`. Tampoco toca el schema de Prisma ni el código de producción.

---


## Puesta a punto (una sola vez)

### 1. Credenciales

```bash
cp .env.simulation.example .env.simulation
```

Completá `FIREBASE_WEB_API_KEY` con la `apiKey` pública del proyecto Firebase — es la misma
que ya está en `frontend/lib/firebase.ts`; las apiKey web de Firebase **no** son secretas.

El resto sale de `backend/.env`, que ya tiene las credenciales de servicio
(`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).

`.env.simulation` está en `.gitignore`. **No lo commitees.**

### 2. Usuarios de prueba

Cada participante simulado necesita **un usuario de Firebase distinto**. No es negociable:
`UbicacionViva` tiene `usuario_id` como clave primaria (`prisma/schema.prisma`), o sea una
ubicación viva por usuario en todo el sistema. Dos participantes con el mismo uid se pisan
la posición entre ellos.

Los uid van en el JSON del escenario, en `participantes[].userId`. El script firma un
*custom token* con el Admin SDK y lo canjea por un ID token contra Identity Toolkit — el
mismo tipo de token que manda la app. **No hacen falta contraseñas.**

Para sacar los uid de tus usuarios de prueba:

```bash
# Consola de Firebase → Authentication → Users, columna "User UID"
# o, si ya iniciaron sesión alguna vez en la app:
npm run db:studio   # tabla usuario, columna firebase_uid
```

---

## Cómo correrlo

### Ciclo completo (lo habitual)

Crea el viaje, guarda la ruta, lo inicia, simula y lo finaliza:

```bash
npm run simulate -- --scenario scripts/scenarios/trote-5km.json --full --speed 10
```

Con `--speed 10`, una salida de 40 minutos se simula en 4.

### Contra un viaje que ya existe

```bash
npm run simulate -- --scenario scripts/scenarios/trote-5km.json --viaje-id <uuid> --speed 20
```

El viaje tiene que estar **en curso** y los participantes tienen que ser creador o
integrantes `confirmado` (`assertPuedeEnviarGps`), o el backend rechaza cada ping.

### Ver los pings sin emitir nada

```bash
npm run simulate -- --scenario scripts/scenarios/trote-5km.json --dry-run --speed 400
```

No necesita backend levantado, ni credenciales, ni base de datos. Solo pega a OSRM la
primera vez (después usa la caché). Es la forma rápida de probar un escenario nuevo.

---

## Flags

| Flag | Default | Qué hace |
|---|---|---|
| `--scenario <ruta>` | — | Archivo JSON del escenario. **Obligatorio.** |
| `--speed <n>` | `1` | Compresión temporal. `10` = 40 min simulados en 4 reales. |
| `--interval <seg>` | `5` | Segundos simulados entre pings (RN-031). |
| `--api-url <url>` | `http://localhost:3000` | Base de la API REST. También `SIM_API_URL`. |
| `--socket-url <url>` | igual que `--api-url` | Base de Socket.io. También `SIM_SOCKET_URL`. |
| `--dry-run` | off | Imprime los pings sin emitirlos ni tocar la API. |
| `--viaje-id <uuid>` | — | Usa un viaje existente en vez de crear uno. |
| `--full` | off | Ciclo completo: crear + ruta + iniciar + simular + finalizar. |
| `--transport socket\|rest` | `socket` | Canal de las posiciones. Ver abajo. |
| `--real-clock` | off | `recordedAt` con reloj real en vez del simulado. Ver abajo. |
| `--ruido <m>` | `5` | Cota del ruido gaussiano (~2σ). `0` lo apaga. |
| `--grace <seg>` | `300` | Segundos simulados extra tras la llegada del último. |
| `--no-cache` | off | Ignora el GeoJSON cacheado y vuelve a pedirle a OSRM. |
| `--help` | | Ayuda. |

`Ctrl+C` corta limpio: termina el tick en curso, desconecta los sockets y —si estabas en
`--full`— te dice qué viaje quedó abierto. Un segundo `Ctrl+C` fuerza la salida.

---

## Armar un escenario nuevo

Los escenarios viven en `scripts/scenarios/*.json`. El script los valida con Zod y te
señala el campo exacto si algo está mal.

```jsonc
{
  "nombre": "Trote 5 km - Parque Sarmiento",   // nombre del viaje, máx 100
  "actividad": "trote",                        // trote | running | bici | moto | trekking
  "esGrupal": true,                            // opcional; default: true si hay >1 participante
  "velocidadBaseKmh": 10.5,

  "origen":  { "lat": -31.42639, "lng": -64.18052, "nombre": "Ingreso" },
  "destino": { "lat": -31.43012, "lng": -64.17421 },
  "waypoints": [                               // opcional, en orden
    { "lat": -31.43188, "lng": -64.18762 }
  ],

  "paradas": [                                 // aplican a TODOS los participantes
    {
      "atKm": 1.8,                             // o "atWaypoint": 0 (índice en waypoints)
      "duracionSegundos": 120,
      "motivo": "Hidratacion",
      "categoria": "descanso"                  // RN-022, ver abajo
    }
  ],

  "participantes": [
    { "nombre": "Ana", "userId": "<uid firebase>", "comportamiento": "normal" },
    {
      "nombre": "Beto",
      "userId": "<otro uid firebase>",
      "comportamiento": { "tipo": "atrasado", "factorVelocidad": 0.65, "progresivo": true }
    }
  ]
}
```

`actividad: "trote"` es el nombre coloquial; se manda al backend como `running`, que es el
valor real del enum `TipoActividad` de Prisma.

### Categorías de parada

El enum `CategoriaParada` real tiene siete valores — dos más de los que lista `CLAUDE.md`,
y `gastronomia` va **sin tilde**:

`kiosco` · `combustible` · `descanso` · `gastronomia` · `punto_control` · `sanitario` · `otro`

### Comportamientos

| `tipo` | Parámetros | Qué hace |
|---|---|---|
| `"normal"` | — | Va al ritmo base. Se puede escribir como string suelto. |
| `atrasado` | `factorVelocidad` (0–1, default `0.8`), `progresivo` (default `false`) | Multiplica la velocidad. Con `progresivo: true` el factor decae linealmente de `1` al valor dado a lo largo de la ruta. |
| `desvio` | `desdeKm`, `metros`, `vuelve` (default `true`), `largoKm` (default `0.5`) | Se aparta lateralmente de la traza. Entra y sale con una rampa de 150 m para que la velocidad implícita entre pings no dispare los filtros GPS del backend. Con `vuelve: false` se queda afuera. |
| `parada_extra` | `atKm`, `duracionSegundos`, `motivo` | Se detiene fuera de las paradas planificadas y **no** registra la parada por API — a propósito, para que el motor la evalúe como posible incidente. |
| `incidente` | `atKm`, `motivo` | Se detiene y no vuelve a moverse. Sigue emitiendo pings desde el mismo punto. |

---

## Qué dispara cada cosa en el backend

Para que el motor de eventos reaccione hace falta que el viaje **tenga ruta guardada**;
`--full` la guarda sola. Los umbrales salen de `src/modules/motor-eventos/motorEventos.config.ts`:

| Alerta | Regla | Cómo provocarla | Umbral (running / bici / moto) |
|---|---|---|---|
| `desvio` | RN-034 | comportamiento `desvio` con `metros` > `distancia_max_separacion` | 100 m / 300 m / 1000 m |
| `peligro` (posible incidente) | RN-036 | `parada_extra` larga o `incidente` | 4 / 3 / 3 min quieto dentro de 15 / 20 / 25 m |
| `atraso` | RN-035 | comportamiento `atrasado` | tolerancia de 3 / 5 / 10 min a la velocidad esperada |

Tres cosas que conviene tener en la cabeza:

- **`atraso` exige viaje grupal** y al menos dos participantes con ubicación viva de menos
  de 30 s (`UBICACION_VIVA_MAX_EDAD_MS`). Con un solo participante nunca se dispara.
- **Las alertas del sistema se deduplican** por (viaje, tipo, afectado) mientras siguen
  `activa`. La segunda no se crea hasta que resolvés la primera.
- **El estado de detención vive en memoria del proceso.** Si reiniciás el backend a mitad
  de simulación, el motor pierde de dónde venía y arranca el conteo de cero.

Las paradas del array `paradas` **sí** se registran por `POST /api/viajes/:id/paradas`, así
que el motor las trata como parada voluntaria y no genera incidente. Es la diferencia
deliberada con `parada_extra`.

---

## Decisiones de diseño

### El reloj simulado

Por defecto `recordedAt` va en **reloj simulado comprimido**: con `--speed 10` cada tick
suma 5 s al timestamp pero espera 0,5 s reales. Es lo que hace que `--speed` sirva de algo,
porque el motor mide las detenciones con el **timestamp del ping**, no con el reloj de pared
(`motorEventos.service.ts`, `evaluarDetencionSospechosa`). También es lo que hace que las
métricas del resumen —que dividen metros sobre segundos entre pings consecutivos— den
velocidades correctas y no infladas por el factor de compresión.

`--real-clock` lo desactiva y estampa la hora real. Con compresión eso deja varios pings
con el mismo segundo y rompe tanto las métricas como la detección de incidentes; solo tiene
sentido con `--speed 1`.

### `speed` y `heading` no están en el contrato

El payload de `viaje:gps_ping` que valida el backend es exactamente:

```ts
{ viajeId, lat, lng, accuracy?, recordedAt, source? }
```

No hay `speed` ni `heading`, y `RegistroGPS` no tiene columnas donde guardarlos. El script
los calcula, los muestra por consola —que es donde te sirven para leer la simulación— y los
incluye igual en el payload: Zod los descarta en silencio (los `z.object()` no-strict
strippean las claves desconocidas), así que hoy no rompen nada y si algún día se agregan al
schema el script ya los está mandando. `speed` va en **m/s**, como `expo-location`.

### El ruido GPS

`--ruido 5` aplica un desplazamiento gaussiano independiente en los ejes norte y este, con
σ = 2,5 m, o sea ~95% de las muestras dentro de ±5 m.

**No lo subas por encima del `radioDetenidoM` de la actividad** (15 m en running, 20 en bici,
25 en moto). Si el ruido supera ese radio, el motor cree que el participante se movió y
reinicia el conteo de detención en cada ping: los incidentes dejan de dispararse.

### Transporte

`--transport socket` (default) emite `viaje:gps_ping` por Socket.io, un socket por
participante — el backend saca el usuario de `socket.data.userId`, puesto en el handshake,
así que no hay forma de multiplexar varios participantes en una conexión.

`--transport rest` usa `PUT /api/viajes/:id/ubicacion-viva`, que es el camino **primario**
del frontend real (`components/ViajeRealtimeBridge.tsx` usa REST y deja el socket como
fallback). Los dos terminan emitiendo `viaje:ubicacion` a la room, porque el evento sale de
`upsertUbicacionVivaSnapshot`.

En modo `rest` el script igual abre el socket del primer participante, para poder escuchar
las alertas que dispara el motor.

### La geometría

Se pide al demo público de OSRM (`router.project-osrm.org`, sin API key, costo $0) con
`geometries=geojson`, y se cachea en `scripts/.cache/osrm-<hash>.json` — hasheado sobre
perfil + coordenadas, así que cambiar un waypoint invalida la caché sola. `scripts/.cache/`
está en `.gitignore`.

Si OSRM no responde en 15 s, el script avisa por consola y cae a **interpolación lineal**
entre waypoints, densificada cada 25 m. La simulación corre igual, pero la traza no sigue
calles ni senderos.

Perfiles, espejando `frontend/lib/osrm.ts`: `moto → driving`, `bici → cycling`,
`trote/running/trekking → walking`. Se puede pisar con `"perfilOsrm"` en el escenario.

---

## Problemas frecuentes

| Síntoma | Causa |
|---|---|
| `Socket de X rechazado: UNAUTHORIZED` | El uid no existe en Firebase, o falta `FIREBASE_WEB_API_KEY`, o las credenciales de servicio de `backend/.env` son de otro proyecto. |
| `ping rechazado: El viaje no admite envío de GPS en este estado` | El viaje no está `en_curso`. Con `--viaje-id` tenés que iniciarlo vos. |
| `ping rechazado: Sin acceso a este viaje` | Ese usuario no es creador ni integrante `confirmado`. |
| `join_viaje rechazado: FORBIDDEN` | Ídem, pero para escuchar la room (`assertPuedeVerEnVivo` es estricta). |
| `POST /api/viajes → 400 ... FECHA_PASADA` | Desfasaje de reloj entre tu máquina y el server. El script programa el viaje 2 minutos en el futuro. |
| No aparece ninguna alerta de atraso | El viaje no es grupal, o hay un solo participante, o el viaje no tiene ruta guardada. |
| No aparece el incidente | El `--ruido` es mayor al `radioDetenidoM` de la actividad, o reiniciaste el backend a mitad de camino. |
| Dos participantes se pisan la posición | Están usando el mismo `userId`. Cada uno necesita su propio uid. |

---

## Referencias

- Contrato de tiempo real: [`backend/docs/websockets.md`](../docs/websockets.md)
- API REST: `/api/docs` (Swagger UI) · spec en [`backend/openapi/`](../openapi)
- Reglas de negocio: `tesis-brain/reglas-de-negocio.md`
