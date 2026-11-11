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
| **El perfil propio se enciende con la racha** | Los logotipos del fondo se vuelven naranjas de a poco (proporción e intensidad = semanas / 10, tope 1). Al llegar a cada hito (3/5/10) aumentan los fueguitos de la ráfaga al entrar (6/10/16), y cambian el borde de la tarjeta y el tamaño del ícono; desde 5 semanas, además, el anillo del avatar | Refuerzo progresivo de la constancia. Una sola ráfaga por entrada, sin animación infinita, y respeta "reducir movimiento". No usa velocidad (RN-070) |
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

- **Perfil propio** (`app/(tabs)/perfil.tsx`): tarjeta "Racha" (🔥 + texto) entre
  el bloque de estadísticas y las insignias. Si `en_riesgo` es true (hubo
  actividad la semana pasada pero todavía no esta), el texto de ayuda cambia a
  rojo: "Salí esta semana para no perderla".
- **Perfil ajeno** (`app/usuario/[usuarioId].tsx`): la misma tarjeta
  (`components/perfil/TarjetaRacha.tsx`, compartida) y el mismo efecto por
  nivel que el perfil propio: fondo que se vuelve naranja, ráfaga de
  fueguitos al entrar y anillo del avatar desde 5 semanas. En lugar del
  consejo para mantenerla muestra el nivel ("Racha encendida" / "ardiente" /
  "legendaria") o "En riesgo esta semana": no tiene sentido decirle a otra
  persona qué hacer con su propia racha. Si no comparte sus logros (RN-077),
  no se muestra nada de esto.

Pendiente: el frontend no reacciona todavía a las notificaciones push de
racha (no hay deep link ni pantalla dedicada al evento); por ahora llegan como
push genérico del sistema operativo.
