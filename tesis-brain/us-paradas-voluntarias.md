# US — Paradas voluntarias y solicitud de parada

> **Estado:** implementada (backend + frontend).
> **Epic:** **E04** — Ejecución y seguimiento en tiempo real.
> **OpenAPI:** `backend/openapi/paths/paradas.yaml` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-022 (categorías), RN-030 (autorización en backend), RN-037 (estados en el mapa), RN-044 (solicitud de parada), RN-052 (uso a una mano).
> **Dependencias:** viaje `en_curso`, `ubicacion_viva` y el canal Socket.io ya existentes.

---

## Las tres US

| US | Como… | Quiero… | Para… |
|---|---|---|---|
| **US1** | integrante | registrar que estoy realizando una parada voluntaria | que el grupo sepa que me detuve |
| **US2** | integrante | enviar una solicitud de parada al líder | comunicar que necesito detenerme |
| **US3** | integrante | indicar que retomo el viaje | que el sistema actualice mi estado al grupo |

### Criterios de aceptación

**US1**
- El estado del usuario cambia a `detenido_voluntario` en el mapa del grupo.
- Los integrantes reciben notificación de la parada.
- Se registra hora y ubicación de la parada.

**US2**
- El botón de solicitud es prominente y accesible con una mano.
- El líder recibe la solicitud y puede aprobarla o rechazarla.
- El estado de la solicitud se muestra al solicitante.

**US3**
- El estado vuelve a `en_movimiento`.
- Se calcula el tiempo total de la parada.

---

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **Estado derivado** | El estado del mapa sale de la parada abierta (`fin IS NULL`), no de una columna en `ubicacion_viva` | Una sola fuente de verdad: con dos, un fallo a mitad de camino las desincroniza |
| **Tabla dedicada** | `SolicitudParada` propia en vez del modelo `Alerta` genérico | "aprobada/rechazada" no encaja en los estados de alerta (activa/pausada/cancelada/resuelta), y `Alerta` arrastra campos que ninguna US usa |
| **Notificación a todos** | La parada de US1 se avisa a todo el viaje, no solo al líder | Definido con el PO; corrige lo que decía el flujo original de este documento |
| **Categoría obligatoria** | Al parar se elige categoría (RN-022) | Da contexto al grupo: "Ana se detuvo para cargar combustible" |
| **Cierre manual** | Solo el botón "Retomar viaje" cierra la parada | US3 dice "quiero indicar que retomo"; la detección por GPS confundiría un semáforo con retomar la marcha |
| **Aprobar solo informa** | La aprobación no abre paradas ni cambia estados | Mantiene US1 y US2 independientes: el integrante sigue decidiendo cuándo se detiene |
| **Sin offline** | Las acciones requieren conexión | RN-038 habla de registros GPS. Las paradas pueden sumar cola local más adelante |
| **Sin líder, sin botón** | "Pedir parada" se oculta al líder y en viajes individuales | No hay a quién pedirle permiso |

---

## Modelo de datos

Ver `Parada` y `SolicitudParada` en la sección de entidades de [[reglas-de-negocio]].

Dos índices únicos parciales sostienen los invariantes en la base, no solo en código:

```sql
-- Una sola parada abierta por integrante y viaje
CREATE UNIQUE INDEX parada_abierta_unica
  ON parada(viaje_id, usuario_id) WHERE fin IS NULL;

-- Una sola solicitud pendiente por integrante y viaje
CREATE UNIQUE INDEX solicitud_parada_pendiente_unica
  ON solicitud_parada(viaje_id, solicitante_id) WHERE estado = 'pendiente';
```

> Prisma no expresa índices parciales en el schema: viven solo en la migración
> `20260821150000_paradas_y_solicitudes`. Si alguna vez se corre `prisma migrate dev`,
> hay que verificar que no los proponga borrar.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `POST` | `/api/viajes/{viajeId}/paradas` | Integrante confirmado (US1) |
| `POST` | `/api/viajes/{viajeId}/paradas/finalizar` | El dueño de la parada (US3) |
| `GET` | `/api/viajes/{viajeId}/paradas/activa` | Integrante confirmado |
| `POST` | `/api/viajes/{viajeId}/solicitudes-parada` | Participante, no líder (US2) |
| `GET` | `/api/viajes/{viajeId}/solicitudes-parada` | Líder: pendientes del viaje · Participante: solo las suyas |
| `POST` | `/api/viajes/{viajeId}/solicitudes-parada/{id}/responder` | **Solo líder** (RN-030) |
| `POST` | `/api/viajes/{viajeId}/solicitudes-parada/{id}/cancelar` | El solicitante |

`GET /api/viajes/{viajeId}/ubicaciones-vivas` suma tres campos: `estado`, `paradaDesde` y `paradaCategoria`.

### Eventos de Socket.io (room `viaje:{id}`)

| Evento | Cuándo | Payload relevante |
|---|---|---|
| `viaje:parada_iniciada` | US1 | `usuarioId`, `nombre`, `categoria`, `inicio`, `estado: detenido_voluntario` |
| `viaje:parada_finalizada` | US3 | `usuarioId`, `duracionSegundos`, `estado: en_movimiento` |
| `viaje:solicitud_parada` | US2 | `solicitudId`, `solicitanteId`, `nombre`, `motivo` |
| `viaje:solicitud_parada_resuelta` | US2 | `solicitudId`, `estado`, `resueltaPor` |

El ping GPS (`viaje:ubicacion`) **no** toca el estado: si lo pisara, el próximo ping
devolvería a "en movimiento" a alguien detenido.

---

## Interfaz

Fila de acciones sobre la barra de Finalizar/Salir, para que todo quede al alcance
del pulgar (RN-052):

```
┌────────────────────────────┐
│          MAPA              │
│  ┌──────────────────────┐  │
│  │ 01:24:30   12,4 km   │  │
│  └──────────────────────┘  │
│  ┌─────────┐ ┌──────────┐  │
│  │Me detuve│ │Pedir     │  │
│  └─────────┘ └──────────┘  │
├────────────────────────────┤
│      Finalizar viaje       │
└────────────────────────────┘

Con parada abierta:  [ ⏸ Retomar viaje  04:12 ]
```

- "Me detuve" abre el selector de categoría; al confirmar, queda el cronómetro corriendo.
- El líder ve la solicitud como banner sobre el mapa, con "Aprobar" / "Rechazar", además del push.
- En el mapa, el integrante detenido lleva anillo ámbar y distintivo de pausa.

---

## Métricas

`cantidad_paradas` del resumen dejó de ser `0` fijo: cuenta las paradas voluntarias
registradas. `tiempo_detenido_seg` **sigue estimándose desde los registros GPS** —
no se cambió por la suma de paradas para no alterar métricas ya en uso.
