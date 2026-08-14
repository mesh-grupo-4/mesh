# US — Ranking de viaje (recap post-viaje)

> **Estado:** lista para implementar / en implementación.  
> **Epic:** **E06** — Cierre, métricas y estadísticas.  
> **OpenAPI:** `GET /api/viajes/{viajeId}/metricas-grupales` en `backend/openapi/viajes.yaml`.  
> **RN:** RN-063 (recap), RN-070 (moto excluida). No es RN-064 (Wrapped de período).  
> **Dependencia:** resumen + `metrica_viaje` ya existentes.

---

## Pegar en Jira

### Título

Recap de ranking del viaje grupal (cards tipo Spotify, post-cierre)

### Epic / labels

- Epic: **E06 — Cierre, métricas y estadísticas**
- Labels sugeridos: `E06`, `ranking`, `recap`, `RN-063`, `RN-070`
- **No** mezclar con Wrapped mensual (RN-064), ghost/live (E07) ni tabla global (E09)

### Descripción

**Como** integrante de un viaje grupal (bici / running / trekking)  
**quiero** ver un recap del grupo al cerrar, con tabs de ritmo, distancia y tiempo en movimiento  
**para** compararme con el resto y tener un empujón a mejorar en la próxima salida.

#### Contexto de producto

Convive con lo ya definido; **no** reemplaza métricas:

| Superficie | Rol |
|---|---|
| Resumen (`GET /resumen`) | Totales del viaje + **tus** números |
| El grupo (`metricas-grupales`) | Lista **informativa** de hechos |
| Mis métricas (`GET /mis-metricas`) | Detalle personal + perfil de velocidad |
| Perfil (`GET /estadisticas`) | Agregados de vida |
| **Recap (esta US)** | Capa competitiva: puestos + cards. Mismos números de `metrica_viaje` |

Moto: sin recap (RN-070). Individual: sin recap.

#### Alcance

**Incluye**

- Puestos (1, 2, 2, 4) por distancia, tiempo en movimiento y velocidad **promedio**.
- UI de cards con tabs; #1 destacado; “Vos”; pie de mejora sin burlar al último.
- Running/trekking: el tab de ritmo muestra pace; el orden es `velocidad_promedio_kmh`.
- Quien no tiene GPS: al final, sin puesto.

**Quién entra:** creador + `confirmado` + `salido`.

**Fuera de alcance**

- Wrapped mensual/anual + share imagen (RN-064).
- Leaderboard en vivo (RN-071 / E07).
- Tabla global (RN-076 / E09).
- Ranking en moto (ni “solo distancia”).
- Recalcular GPS ni cambiar fórmulas de `metrica_viaje`.
- Velocidad máxima como criterio.

---

### Criterios de aceptación

1. Tras finalizar un viaje **grupal no moto**, el resumen ofrece **Recap del grupo** sin quitar El viaje / Tu recorrido / El grupo / Ver métricas detalladas.
2. El recap tiene tabs Distancia / Ritmo / Tiempo en movimiento. Default: Distancia.
3. Cada tab muestra al #1 con título (“Más kilómetros” / “Mejor ritmo” / “Más tiempo en movimiento”) y al resto en cards con el **mismo valor** que métricas.
4. La card del usuario autenticado se marca “Vos”. Pie de invitación a mejorar, sin tono de burla.
5. Empate: mismo puesto; el siguiente se salta (1, 2, 2, 4).
6. Sin GPS: card al final, sin puesto, “Sin traza GPS”.
7. **Moto:** no hay CTA de recap. `ranking_habilitado` false; puestos `null`; sin velocidades de terceros comparables.
8. **Individual:** no hay recap.
9. `GET /resumen` sigue **sin** `por_integrante`.
10. Los puestos salen de `GET /metricas-grupales` (no hay un segundo listado de km).
11. Tests de puestos, empates, nulls, moto e individual.

---

### DoR checklist

- [x] US con título, descripción y AC
- [x] Epic E06; no mezclar con RN-064 / E07 / E09
- [x] Convive con resumen y métricas existentes
- [ ] Cargar en Jira + estimación Poker (sugerida: **5**)
