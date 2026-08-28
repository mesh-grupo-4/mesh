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
| **Solo crear + historial** | RN-042 (pausar / cancelar / resolver) queda fuera | Los criterios de aceptación piden crear, notificar y listar. El enum `EstadoAlerta` ya existe en la tabla para esa US |
| **Solo con viaje en curso** | Crear alertas exige `estado = en_curso` | Son coordinación en movimiento; antes de salir el grupo se comunica por otros medios |
| **Mensajes predeterminados** | Al elegir tipo se prellena un mensaje editable (p. ej. combustible → "Paramos en la próxima estación de servicio") | Acelera la acción en movimiento sin obligar a escribir |
| **Ubicación opcional** | `lat`/`lng` solo si el autor marca un punto en el mapa; no se adjunta GPS automático | El lugar comunicado es dónde van a parar, no dónde están ahora |
| **Banner Seguir / Ignorar** | Misma lógica que `viaje:parada_iniciada` cuando hay coordenadas | El grupo puede guiarse hasta el punto anunciado |
| **Permiso configurable** | `Viaje.alertas_solo_lider` (default `true`) | El líder decide si solo él o todo el grupo puede crear alertas manuales |
| **Métricas propias** | El historial muestra **tu** distancia y **tu** tiempo en movimiento | Coherente con "revisar mis actividades" y con RN-070: no compara integrantes |
| **Traza GPS real** | El mapa del resumen dibuja `registro_gps`, no la ruta planificada | "Recorrido realizado" es por dónde pasaste. Los datos ya se guardaban y nadie los leía |
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
├── estado (enum: activa, pausada, cancelada, resuelta — hoy siempre `activa`)
├── created_at
└── resolved_at (nullable)
```

Migraciones: `20260821170000_alertas`, `20260828190000_alertas_solo_lider`. La US2 no agrega tablas: usa `registro_gps` y `metrica_viaje`, que ya existían.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `POST` | `/api/viajes/{viajeId}/alertas` | Líder siempre; integrante si `alertas_solo_lider = false`. Viaje en curso |
| `GET` | `/api/viajes/{viajeId}/alertas` | Cualquier integrante, incluido quien salió |
| `PATCH` | `/api/viajes/{viajeId}` | Líder: `alertasSoloLider` entre otros campos |
| `GET` | `/api/viajes/{viajeId}/recorrido` | Tu traza GPS del viaje, simplificada |
| `GET` | `/api/viajes/finalizados` | Historial con `mi_distancia_m` y `mi_tiempo_movimiento_seg` |

**Socket** (room `viaje:{id}`): `viaje:alerta` con `{ viajeId, alerta }`.

**Push** (RN-040): a todos los integrantes confirmados salvo el autor. El título sale del tipo
("Carga de combustible", "Desvío en la ruta", …) y el cuerpo es el mensaje, si escribió uno.

---

## Interfaz

**US1** — En el mapa en vivo: campana con contador y botón `+` para quien puede crear.
Al componer: tipo → mensaje predeterminado editable → opcional "Marcar en el mapa".
La alerta entrante aparece como banner sobre el mapa; con ubicación: **Seguir** / **Ignorar**.
Sin ubicación: **Entendido**. La pantalla `/viaje/[viajeId]/alertas` lista todo con color
por tipo y hora en UTC-3 (RN-105).

En detalle del viaje (grupal): toggle **Solo el líder crea alertas** junto a la config de incidente.

**US2** — En "Pasados", cada tarjeta suma una fila con distancia, tiempo en movimiento y
actividad; sin traza GPS la fila no se muestra en vez de exhibir ceros. El resumen del
viaje abre con el mapa del recorrido, con marcadores de inicio y fin.

---

## Pendiente relacionado

- RN-042: pausar / cancelar / resolver alertas manuales desde la UI.
- RN-025: exponer `tolerancia_atraso` configurable por el líder en el viaje (hoy el motor usa defaults por actividad).
