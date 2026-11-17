# US — Recompensas por rachas de actividad

> **Estado:** implementada (backend + frontend: perfil propio y perfil de otro usuario).
> **Epic:** **E09** — Gamificación extendida (insignias, rachas, tabla global). Tier Deseable.
> **OpenAPI:** `backend/openapi/paths/rachas.yaml` y `backend/openapi/paths/usuarios.yaml#/PerfilPublicoUsuario` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-075 (semanas consecutivas, rotura reinicia el contador).
> **Dependencias:** `ViajesService.generarResumen()` (mismo hook que [[us-insignias]], RN-074); `reportes.periodo.ts` para el cálculo de semana ART (RN-105).

---

## La US

| US | Como… | Quiero… | Para… |
|---|---|---|---|
| **US1** | usuario | recibir recompensas por mantener una racha de salidas consecutivas | motivarme a ser constante |

### Criterios de aceptación

- El sistema registra la cantidad de semanas consecutivas con al menos una actividad registrada.
- Se notifica al usuario cuando alcanza hitos de racha (3, 5, 10 semanas).
- La racha se muestra en el perfil del usuario.
- Si se rompe la racha, el sistema notifica y reinicia el contador.

---

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **"Actividad" = viaje finalizado** | Mismo criterio que insignias y estadísticas: al menos una `MetricaViaje` generada esa semana (participó como creador o integrante confirmado/salido), sin importar distancia ni duración | Consistencia con el resto de E06/E09: todo lo que mide "hizo algo" se ancla al cierre del viaje, no a iniciarlo |
| **Semana = lunes a domingo, hora Argentina** | Se reutiliza `diaArg()` + `inicioBalde(dia, 'semana')` de `reportes/reportes.periodo.ts`, el mismo cálculo que ya usa la reportería del backoffice para agrupar por semana ISO en ART | Evita tener dos definiciones de "semana" en el backend; RN-105 ya fija que todo se agrupa en hora argentina |
| **Lectura siempre recalculada, nunca mentida** | `obtenerRachaVigente()` no solo lee la fila: si ya pasó una semana calendario completa sin actividad, devuelve `0` aunque la fila en base siga con el número viejo | El perfil no puede mostrar una racha que la persona ya perdió solo porque el job diario todavía no corrió. Mismo principio que "un gráfico con huecos miente" de la reportería |
| **Job diario solo para notificar, no para la verdad del dato** | `src/jobs/rachasJob.ts` (sin librería externa, `setTimeout` + `setInterval` de 24 h) escanea rachas activas y manda el push de rotura el mismo día que se detecta, antes de que la persona vuelva a salir | Es la primera pieza de scheduling del backend (decisión explícita con el usuario: se evaluó no tener cron y notificar recién en el próximo viaje, pero se prefirió avisar el mismo día). Al no ser la fuente de verdad, si el proceso se reinicia o el job tarda un día de más, la lectura del perfil sigue siendo correcta — solo se atrasa el push |
| **Sin notificación duplicada** | Si el job ya reinició una racha a 0 por inactividad, el siguiente viaje finalizado la arranca en 1 sin volver a notificar la rotura (ya se avisó); si en cambio el usuario finaliza un viaje el mismo día que se cumplen 2 semanas de hueco, antes de que corra el job, es `registrarActividad()` quien nota el hueco, notifica y reinicia — el job no vuelve a notificar esa misma fila porque ya quedó en la semana actual | Evita el caso molesto de "me llegaron dos avisos de que perdí la misma racha" |
| **Racha sobria: tira de semanas, sin efectos** | La tarjeta muestra el número de semanas seguidas y, en el perfil propio, las últimas 8 semanas como casillas (llena = hubo un viaje terminado; la actual va punteada mientras esté pendiente). Se quitaron el 🔥, la ráfaga de fueguitos, el fondo teñido de naranja, el anillo del avatar y los títulos por nivel ("encendida" / "ardiente" / "legendaria") | Decisión del 16/11/2026: la versión anterior acumulaba demasiados efectos y se sentía genérica. La tira muestra el dato real (qué semanas se salió) en vez de decorarlo. No usa velocidad (RN-070) |
| **Progresión por hitos, a la vista** | Debajo de la tira, una escala con los hitos 3 / 5 / 10: la barra avanza una semana por vez, cada hito alcanzado queda marcado y una línea dice cuánto falta para el siguiente ("Te faltan 2 semanas para el hito de 5."). Además, un sello "Hito N" junto al título y el marco de la tarjeta gana presencia con cada hito (borde de acento desde 3, más grueso desde 5, pleno desde 10). Igual en el perfil ajeno | Sin esto una racha de 2 y una de 12 solo se distinguían por el número. La escala muestra el progreso y la meta sin volver a los efectos decorativos. Son los mismos hitos que notifica el backend (`HITOS_RACHA`, espejo en `frontend/lib/rachasApi.ts`) |
| **Visible según lo que elija cada persona, como las insignias (RN-077)** | `GET /rachas/usuario/{usuarioId}` y el campo `racha` de `PerfilPublico` pasan por el mismo control de visibilidad de logros (`todos` por defecto, `amigos` o `solo_yo`). Sin permiso: `403 LOGROS_PRIVADOS` / `racha: null` | Un único selector para estadísticas, racha e insignias (ver [[us-insignias]]) |

---

## Modelo de datos

```
RachaActividad
├── usuario_id (PK, FK)        ← una fila por usuario
├── semanas_consecutivas (int)
├── inicio_racha (datetime)    ← instante del viaje que arrancó la racha actual
├── ultima_actividad (datetime)← instante del viaje finalizado más reciente que contó
└── updated_at
```

No hay `viaje_id`: a diferencia de `UsuarioInsignia`, la racha no necesita
trazar "cuál viaje la extendió", solo el instante de la última actividad para
poder calcular la semana.

Migración: `20261023130000_rachas_actividad`.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/rachas/mia` | Cualquier usuario autenticado — racha propia |
| `GET` | `/api/rachas/usuario/{usuarioId}` | Cualquier usuario autenticado, si la persona comparte sus logros con quien consulta (RN-077); si no, `403 LOGROS_PRIVADOS` |
| `GET` | `/api/usuarios/{usuarioId}/perfil` | Incluye `racha` junto con estadísticas e insignias, o `null` si no los comparte (ver [[us-insignias]]) |

No existe un endpoint para escribir la racha a mano: solo la actualiza
`ViajesService.generarResumen()` al finalizar un viaje, y el job diario la
reinicia cuando detecta inactividad.

### Notificaciones push

| Evento | Cuándo | Título |
|---|---|---|
| Hito alcanzado | `semanas_consecutivas` llega exactamente a 3, 5 o 10 | "¡Racha de N semanas!" |
| Racha rota | Hueco de una semana o más, detectado al finalizar un viaje o por el job diario | "Se cortó tu racha" |

---

## Interfaz

- **Perfil propio** (`app/(tabs)/perfil.tsx`): tarjeta "Racha" entre el resumen
  de actividad y las insignias: semanas seguidas, tira de las últimas 8 semanas
  y una línea de estado ("Esta semana ya cuenta." / "Terminá un viaje esta
  semana para arrancar una."). Si `en_riesgo` es true (hubo actividad la semana
  pasada pero todavía no esta), la línea pasa a rojo: "Esta semana todavía no
  saliste. Si termina sin viajes, la racha se corta."
- **Tira de semanas** (`lib/actividadPersonal.ts` → `semanasRecientes`): se arma
  en el frontend con `GET /api/viajes/finalizados`, contando solo viajes con
  métrica propia y cortando la semana el lunes en hora argentina. Es el mismo
  criterio que usa el backend para sumar la racha, así número y tira coinciden.
- **Perfil ajeno** (`app/usuario/[usuarioId].tsx`): la misma tarjeta
  (`components/perfil/TarjetaRacha.tsx`, compartida) pero sin tira: no tenemos
  el historial semanal de otra persona y dibujar semanas vacías sería mentir.
  Los textos van en tercera persona ("Esta semana ya salió." / "Esta semana
  todavía no salió."). Si no comparte sus logros (RN-077), no se muestra nada.

Pendiente: el frontend no reacciona todavía a las notificaciones push de
racha (no hay deep link ni pantalla dedicada al evento); por ahora llegan como
push genérico del sistema operativo.
