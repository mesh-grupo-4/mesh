# US — Alertas del líder e historial de viajes

> **Estado:** implementadas (backend + frontend).
> **Epics:** **E05** (alertas) · **E06** (historial y métricas).
> **OpenAPI:** `backend/openapi/paths/alertas.yaml`; `GET /recorrido` y `GET /finalizados` en `backend/openapi/paths/viajes.yaml` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-040 (push a todos), RN-041 (alerta manual con tipo y mensaje), RN-043 (ubicación), RN-030 (autorización), RN-061 (métricas individuales), RN-105 (horas en UTC-3), RN-108 (permiso configurable).

---

## Las dos US

| US | Como… | Quiero… | Para… |
|---|---|---|---|
| **US1** | líder o integrante | crear y configurar alertas para paradas, cargas de nafta y desvíos | mantener al grupo informado |
| **US2** | usuario | ver el historial de viajes realizados con sus métricas | revisar mis actividades anteriores |

### Criterios de aceptación

**US1**
- El líder puede crear alertas con tipo y mensaje personalizado (mensaje predeterminado editable por tipo).
- Opcionalmente se puede marcar en el mapa el punto de parada futuro.
- Las alertas con ubicación muestran banner grupal con Seguir / Ignorar (como paradas voluntarias).
- Las alertas se envían como notificación push a todos los integrantes.
- El líder puede configurar si solo él crea alertas (`alertas_solo_lider`, default `true`).
- Se muestra historial de alertas del viaje.

**US2**
- Se muestran viajes ordenados por fecha.
- Cada entrada muestra: fecha, distancia, tiempo y actividad.
- Se puede ver el mapa del recorrido realizado.

---

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **Dos ejes de clasificación** | `tipo` es el tema (parada, combustible, desvío, peligro, información) y `origen` dice quién la generó (`lider`, `integrante`, `sistema`) | Distinguir alertas del líder, de un integrante autorizado y del motor |
| **Gestión de estado (RN-042)** | `PATCH /api/viajes/{viajeId}/alertas/{alertaId}` con `{ estado }`: `activa → pausada / cancelada / resuelta`, `pausada → activa / cancelada`. Solo el líder, con viaje en curso. Emite `viaje:alerta_actualizada` | El líder necesita cerrar o pausar una alerta manual sin esperar al fin del viaje; el backend valida la transición (RN-030) |
| **Auto-resolución de alertas del sistema** | Desvío y atraso se resuelven solos cuando el integrante vuelve por debajo de la **mitad** del umbral (histéresis); posible incidente al confirmar "estoy bien"; todas al salir o finalizar | Sin esto, el dedup por `estado = activa` dejaba una sola alerta de desvío por viaje y el líder perdía los desvíos siguientes |
| **Parada voluntaria ≠ desvío** | El motor no evalúa desvío mientras el integrante tiene una parada voluntaria abierta | Parar en una estación de servicio a 150 m del trazado no es desviarse |
| **Desvío del grupo ≠ N desvíos (RN-034b)** | Si sale el líder, se le pregunta si recalcular (sin respuesta, se recalcula sola a los 2 min); quien va con él no genera alerta. Un participante puede avisar que se desvía a propósito | Con una calle cortada, 20 alertas de desvío al líder no le decían nada nuevo y quedaban abiertas para siempre si no volvían a la ruta original |
| **Solo con viaje en curso** | Crear alertas exige `estado = en_curso` | Son coordinación en movimiento; antes de salir el grupo se comunica por otros medios |
| **Mensajes predeterminados** | Al elegir tipo se prellena un mensaje editable (p. ej. combustible → "Paramos en la próxima estación de servicio") | Acelera la acción en movimiento sin obligar a escribir |
| **Ubicación opcional** | `lat`/`lng` solo si el autor marca un punto en el mapa; no se adjunta GPS automático | El lugar comunicado es dónde van a parar, no dónde están ahora |
| **Banner Seguir / Ignorar** | Misma lógica que `viaje:parada_iniciada` cuando hay coordenadas | El grupo puede guiarse hasta el punto anunciado |
| **Permiso configurable** | `Viaje.alertas_solo_lider` (default `true`) | El líder decide si solo él o todo el grupo puede crear alertas manuales |
| **Métricas propias** | El historial muestra **tu** distancia y **tu** tiempo en movimiento | Coherente con "revisar mis actividades" y con RN-070: no compara integrantes |
| **Traza GPS real** | El mapa del resumen dibuja `registro_gps`, no la ruta planificada | "Recorrido realizado" es por dónde pasaste. Los datos ya se guardaban y nadie los leía |
| **Quitar del historial ("borrar para mí")** | El participante (`confirmado` o `salido`) oculta un viaje finalizado con `viaje_integrante.oculto_en_historial = true`. El creador no oculta: elimina el viaje para todos. Un viaje vencido sin iniciar el participante lo quita saliendo (`/salir`) | Antes el participante "quitaba" con `/salir`, que en un viaje finalizado lo marcaba `salido` y el viaje reaparecía en el historial. Ocultar no toca el resumen ni las métricas del resto |
| **Simplificación en la base** | `ST_SimplifyPreserveTopology` antes de responder | Un viaje de 3 h a un ping cada 5 s son ~2160 puntos; la mayoría no cambia el dibujo. Cálculo espacial en PostGIS, no en Node |

---

## Modelo de datos

```
Viaje
└── alertas_solo_lider (Boolean, default true) — RN-108

Alerta
├── id (PK)
├── viaje_id (FK)
├── creada_por_id (FK, nullable — ON DELETE SET NULL: el historial sobrevive a la baja del autor)
├── tipo (enum: parada, combustible, desvio, peligro, informacion, atraso)
├── origen (enum: lider, integrante, sistema)
├── mensaje (opcional, máx. 280)
├── lat / lng (nullable — punto de parada futuro, opcional)
├── estado (enum: activa, pausada, cancelada, resuelta — nace `activa`; ver RN-042 y auto-resolución)
├── created_at
└── resolved_at (nullable)
```

Migraciones: `20260821170000_alertas`, `20260828190000_alertas_solo_lider`, `20261105120000_viaje_integrante_oculto_historial` (`viaje_integrante.oculto_en_historial`). La US2 no agrega tablas: usa `registro_gps` y `metrica_viaje`, que ya existían.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `POST` | `/api/viajes/{viajeId}/alertas` | Líder siempre; integrante si `alertas_solo_lider = false`. Viaje en curso |
| `GET` | `/api/viajes/{viajeId}/alertas` | Cualquier integrante, incluido quien salió |
| `PATCH` | `/api/viajes/{viajeId}` | Líder: `alertasSoloLider` entre otros campos |
| `GET` | `/api/viajes/{viajeId}/recorrido` | Tu traza GPS del viaje, simplificada |
| `GET` | `/api/viajes/finalizados` | Historial con `mi_distancia_m` y `mi_tiempo_movimiento_seg`; excluye los que el participante ocultó |
| `POST` | `/api/viajes/{viajeId}/ocultar` | Participante (`confirmado`/`salido`) de un viaje finalizado. 403 `CREATOR_MUST_DELETE` si es el creador |

**Socket** (room `viaje:{id}`): `viaje:alerta` con `{ viajeId, alerta }`.

**Push** (RN-040): a todos los integrantes confirmados salvo el autor. El título sale del tipo
("Carga de combustible", "Desvío en la ruta", …) y el cuerpo es el mensaje, si escribió uno.

**Gravedad y vibración.** Cada aviso del viaje tiene una gravedad, que decide cómo vibra. Vibra en
**todas** las actividades (moto y auto incluidas); running y trekking repiten el patrón de lo
importante y lo crítico porque no miran la pantalla (RN-052).

| Gravedad | Qué incluye | Patrón (ms) | Canal Android |
|---|---|---|---|
| `critica` | alerta `peligro`, posible incidente, pedido de ayuda, accidente | 3 pulsos largos `[0,700,200,700,200,700]` | `alertas-criticas` (MAX) |
| `importante` | `parada`, `combustible`, `desvio`, `atraso`, paradas del grupo y solicitudes | 2 pulsos `[0,350,150,350]` | `viajes` (HIGH) |
| `informativa` | alerta `informacion`, pedido de ayuda cancelado | 1 pulso `[0,200]` | `avisos` (DEFAULT) |

- Con la app abierta vibra el dispositivo (`frontend/lib/haptics.ts`, `useHapticaAlEntrar` en la
  pantalla del viaje). La llegada a destino usa un patrón propio (`exito`).
- Con la app cerrada vibra la push: el backend manda `channelId` y `priority` según la gravedad
  (`backend/src/lib/gravedadAlerta.ts` → `expoPush.ts`) y los canales los crea
  `frontend/hooks/usePushNotifications.ts`. La gravedad viaja también en `data.gravedad`.
- Android no deja cambiar la vibración de un canal ya creado: en un dispositivo que ya tenía el
  canal `viajes` hay que reinstalar la app para ver el patrón nuevo.
- **"¿Estás bien?" insiste.** Mientras la persona tiene un posible incidente abierto y no
  respondió, el patrón crítico se repite cada **5 s** (`useHapticaCriticaRepetida`). Corta al
  tocar "Estoy bien" o "Necesito ayuda".
- **Sin doble aviso.** Con la pantalla del viaje abierta, las push de ese mismo viaje no suenan ni
  muestran banner (quedan en la bandeja): el aviso ya se ve y vibra en la app. La pantalla lo
  declara con `marcarViajeEnPantalla`; aplica solo a las push que traen `data.gravedad`.
- **Preferencia "Vibración de avisos"** (Perfil, guardada en el dispositivo,
  `frontend/lib/vibracionPrefs.ts`): apagarla silencia lo informativo y lo importante con la app
  abierta. Lo **crítico vibra siempre**. Las push con la app cerrada se silencian por canal desde
  los ajustes de notificaciones de Android.

---

## Interfaz

**US1** — En el mapa en vivo: campana con contador y botón `+` para quien puede crear.
Al componer: tipo → mensaje predeterminado editable → opcional "Marcar en el mapa".
La alerta entrante aparece como banner sobre el mapa; con ubicación: **Seguir** / **Ignorar**.
Sin ubicación: **Entendido**. La pantalla `/viaje/[viajeId]/alertas` separa en dos pestañas:
**Activas** (activa y pausada, con color por tipo) y **Resueltas** (resuelta y cancelada, en gris).
Hora en UTC-3 (RN-105).

En detalle del viaje (grupal): toggle **Solo el líder crea alertas** junto a la config de incidente.

**US2** — En "Pasados", cada tarjeta suma una fila con distancia, tiempo en movimiento y
actividad; sin traza GPS la fila no se muestra en vez de exhibir ceros. El resumen del
viaje abre con el mapa del recorrido, con marcadores de inicio y fin.

---

## Pendiente relacionado

- RN-025: exponer `tolerancia_atraso` configurable por el líder en el viaje (hoy el motor usa defaults por actividad).
