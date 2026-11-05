# Guion para armar la presentación de la demo — Mesh

> **Instrucciones para la instancia de Claude que va a generar la presentación.**
> Proyecto Final 2026 · UTN FRC · Grupo 4 · Curso 5K1
> Datos relevados el **16/09/2026** desde el repositorio `mesh-grupo-4/mesh` y el Jira `mesh-g6.atlassian.net` (proyecto SCRUM).

---

## 0. Tu tarea

Armá una **presentación para la demo** del proyecto Mesh ante la cátedra/tribunal. Tiene que contar tres cosas, en este orden:

1. **En qué punto del cronograma estamos** (sprints ejecutados vs. plan original, desvíos, qué falta).
2. **Cómo está el producto** (qué funciona hoy, qué está en testing, qué queda, calidad técnica).
3. **Todo lo demás que suma para una demo**: problema que resolvemos, diferenciación, arquitectura, decisiones clave, pruebas de campo, riesgos y próximos pasos.

Reglas para vos:

- **Idioma: español rioplatense**, tono profesional pero directo. Sin relleno.
- **Usá los datos duros de este documento como base**. Son verificados. No inventes números, fechas, ni funcionalidades que no figuren acá o en los documentos de la tesis.
- Donde este documento diga `[BUSCAR EN DOCS]`, tenés que **buscar el dato en los documentos de la tesis** a los que estás conectado (plan de proyecto, cronograma/Gantt, acta de constitución, informe de avance, etc.). Si no lo encontrás, dejá el placeholder visible entre corchetes para que lo completemos a mano; **no lo rellenes con suposiciones**.
- Formato de salida: **slides** (una idea por slide, título fuerte, 3–5 bullets máximo, notas del orador debajo de cada slide). Duración objetivo: **15–20 minutos** de exposición + demo en vivo. Si el formato o la duración están fijados en la consigna de la cátedra `[BUSCAR EN DOCS]`, respetalos por sobre esto.
- Regla inviolable del producto que tiene que quedar reflejada si hablás de rankings o competición: **la modalidad moto está excluida de todo ranking, leaderboard o gamificación de velocidad (RN-070)**. Nunca presentes una feature que compare velocidades entre motos.

---

## 1. Qué es Mesh (para la apertura)

- App móvil de **coordinación grupal en tiempo real** para actividades en movimiento: motociclismo, ciclismo, running y trekking (más un modo `otro`).
- Problema: Strava, Komoot, Garmin, Google Maps o Life360 resuelven rendimiento individual o navegación punto a punto. Ninguna interpreta **qué está pasando con el grupo como conjunto**: quién se desvió, quién se atrasó, quién paró a propósito y quién puede estar en problemas.
- Mesh lo resuelve con un **motor de eventos autónomo en el backend** que evalúa cada ping GPS contra la ruta planificada y genera alertas sin intervención humana.
- Público: adultos 18–65, Argentina, foco Córdoba. Menores excluidos en esta etapa (geolocalización infantil).
- Dos roles y nada más: **líder** (crea el viaje, define ruta, inicia/finaliza, gestiona alertas) y **participante**.
- Tabla de competencia disponible en `reglas-de-negocio.md` §12 — usala tal cual para el slide de diferenciación.

Equipo (metodología §11 del doc de reglas): PO Manuel Viale · SM Pedro Gabrielli · Dev Team: Peñafort, Giorda, Casoria, Ferraro. `[BUSCAR EN DOCS]` confirmar si hubo cambios de roles durante el proyecto.

---

## 2. Cronograma: dónde estamos (datos de Jira, 16/09/2026)

### 2.1 Sprints ejecutados

Scrum, sprints de ~15 días. **9 sprints** hasta hoy; el 9 está activo.

| Sprint | Fechas | Estado | Objetivo / qué se hizo |
|---|---|---|---|
| 1 | 19/05 → 30/05 | cerrado | Setup de back, front y Firebase. Registro, login, recuperar contraseña, cerrar sesión (E01). |
| 2 | 29/05 → 09/06 | cerrado | Grupos completos: crear, invitar por usuario/amigo, amigos, miembros, abandonar/eliminar, confirmar asistencia (E02). Perfil. |
| 3 | 12/06 → 30/06 | cerrado | Arranque de E03/E04: crear viaje, ruta, paradas, modo de actividad, iniciar viaje, mapa en vivo, finalizar viaje. |
| 4 | 30/06 → 14/07 | cerrado | Continuación del bloque anterior (receso invernal / parciales). |
| 5 | 14/07 → 28/07 | cerrado | Ídem. |
| 6 | 28/07 → 11/08 | cerrado | Cierre del bloque E03/E04 arrastrado desde Sprint 3 (8 historias cerradas el 14/08). |
| 7 | 14/08 → 25/08 | cerrado | Objetivo: "Aumentar la velocidad como equipo". Paradas, alertas, solicitar parada, métricas individuales/grupales, ranking, resumen visual, viajes pasados, compartir ruta. **11 historias Done.** |
| 8 | 25/08 → 08/09 | cerrado | Checklist, detección de detención voluntaria vs. incidente, offline + sync, alertas en tiempo real, interfaz adaptativa, gastos colaborativos. **7 Done + 6 pasaron a testing.** |
| 9 | 08/09 → 22/09 | **activo** | Modo entrenamiento, ghost tracking, modo competitivo/recreativo, privacidad y consentimiento de ubicación. Todo lo del sprint está **on testing**. |

**Lectura honesta del cronograma para contar en la demo:**

- Sprints 1–2 salieron en tiempo.
- Sprints 3–6 (junio–agosto) fueron el **cuello de botella**: el bloque de planificación de viaje + tracking en tiempo real (8 historias) se arrastró 4 sprints y se cerró recién el 14/08. Causas a validar en `[BUSCAR EN DOCS]` (informe de avance / retrospectivas): complejidad del tiempo real, receso de invierno, parciales.
- A partir del Sprint 7 el equipo **triplicó la velocidad**: 11 historias en Sprint 7, 13 en Sprint 8, 13 en Sprint 9. En un mes se cerró casi todo el Core y se entró al Tier Avanzado.
- `[BUSCAR EN DOCS]` **Contrastar contra el cronograma/Gantt original** del plan de proyecto: qué épica estaba prevista para qué mes, y cuánto desvío hay. Sin eso, el slide de cronograma queda incompleto. Si el plan preveía terminar el Core antes de agosto, decir explícitamente que hubo desvío y cómo se recuperó.
- `[BUSCAR EN DOCS]` Fecha de la demo, fecha de entrega final, y hitos de cátedra pendientes (defensa, informe final, etc.).

### 2.2 Estado del backlog por tier (67 historias en Jira)

| Tier | Épicas | Historias | Done | On testing | To Do | % desarrollado |
|---|---|---|---|---|---|---|
| **Core (MVP)** | E01–E05 | 38 | 30 | 8 | 0 | **100 %** (79 % aprobado, 21 % en testing) |
| **Avanzado** | E06–E07 | 11 | 5 | 6 | 0 | **100 %** (45 % aprobado, 55 % en testing) |
| **Deseable** | E08–E12 | 18 | 1 | 0 | 17 | 6 % |
| **Total** | | 67 | 37 (55 %) | 13 (19 %) | 17 (25 %) | 75 % desarrollado |

Mensaje central: **el MVP está completo en desarrollo y el Tier Avanzado también; lo que queda del Core es aprobación de testing del PO, no código.** El Tier Deseable estaba definido desde el inicio como fases futuras (`reglas-de-negocio.md` §7).

### 2.3 Historias por épica (detalle para el slide de producto o el apéndice)

**E01 Usuarios y autenticación** — 5 Done · 1 testing
Done: registro, login, recuperar contraseña, ver/editar perfil, cerrar sesión. Testing: gestión de privacidad y consentimiento de ubicación (SCRUM-10).

**E02 Grupos** — 8 Done
Crear grupo, invitar por QR, invitar por usuario/amigo, invitar a grupos definidos, gestión de amigos, ver miembros, abandonar/eliminar grupo, confirmar asistencia.

**E03 Planificación de viajes y rutas** — 8 Done · 2 testing
Done: crear viaje solo o grupal, definir ruta con origen/destino, categorizar paradas intermedias, estimación de tiempos, seleccionar modo de actividad, checklist de preparativos, consultar viajes pasados, compartir ruta por link e importarla como plantilla. Testing: parámetros de actividad configurables (SCRUM-26), alertas meteorológicas (SCRUM-27).

**E04 Ejecución y seguimiento en tiempo real** — 6 Done · 2 testing
Done: iniciar viaje, mapa en vivo con recorrido e integrantes, iniciar/finalizar parada, detección detención voluntaria vs. incidente, **funcionamiento offline con sincronización**. Testing: detección automática de desvíos (SCRUM-32), detección de atrasos significativos (SCRUM-33).

**E05 Alertas y comunicación operativa** — 4 Done · 2 testing
Done: crear alertas de paradas y desvíos, visualizar alertas en tiempo real, solicitar parada manual al grupo, interfaz adaptativa por tipo de actividad. Testing: pausar/cancelar alertas (SCRUM-37), alertas automáticas por caídas/atrasos push a todo el grupo (SCRUM-38).

**E06 Cierre y métricas** — 5 Done · 2 testing
Done: finalizar viaje, métricas individuales, métricas grupales, ranking de viaje (respetando RN-070), resumen visual. Testing: métricas de entrenamiento (SCRUM-47), iniciar modo entrenamiento (SCRUM-48).

**E07 Ghost tracking y competición** — 4 testing
Competir contra fantasma (tiempo anterior), seleccionar recorrido histórico como referencia, modo competitivo con leaderboard dinámico, modo recreativo sin métricas comparadas. Todo mergeado a `main` el 14/09.

**E08 Deseables** — 1 Done (gestión colaborativa de gastos) · 4 To Do (hitos geolocalizados, POIs, wearables, itinerario IA).
**E09–E12** — 13 To Do (gamificación extendida, red social de recorridos, asistencia IA, info de ruta externa). Fuera de alcance de esta entrega por diseño.

---

## 3. Estado del producto: qué existe hoy en el código (repo, 16/09/2026)

### 3.1 Números del repositorio

- **97 commits** entre el 08/05/2026 (primer commit) y el 15/09/2026. 11 pull requests mergeados con code review.
- **Backend**: 15 módulos de dominio (`alertas, amistades, checklist, clima, fantasma, gastos, geocoding, grupos, motor-eventos, paradas, privacidad, routing, rutas-compartidas, usuarios, viajes`), **92 endpoints REST** documentados en OpenAPI, **15 eventos Socket.io** documentados, **36 migraciones** de base de datos, **37 archivos de test / 311 casos de prueba**.
- **Frontend**: **42 pantallas** (auth, tabs, grupos, amigos, crear/configurar viaje con mapa, QR, viaje en vivo, alertas, checklist, gastos, métricas, recap, resumen, privacidad, rutas compartidas). Build de APK Android vía EAS.
- **Infra**: pipeline de **CI/CD con GitHub Actions** que corre migraciones + tests y despliega el backend a un VPS por SSH en cada merge a `main`. Swagger UI habilitado en todos los ambientes en `/api/docs` como referencia viva para el equipo y el tribunal.

### 3.2 Stack (slide de arquitectura)

| Capa | Tecnología | Por qué |
|---|---|---|
| App móvil | Expo SDK 54 · React Native 0.81 · TypeScript · Expo Router | Un solo código para Android/iOS, tipado estricto, file-based routing |
| Mapas | **OpenStreetMap** (tiles), Nominatim (geocoding), OSRM (ruteo) | Costo $0, sin dependencia de APIs comerciales |
| API | Node.js · Express v5 · Zod | Validación de toda entrada con esquemas |
| Tiempo real | Socket.io v4 | Ping GPS cada 5 s por integrante, salas por viaje |
| Datos | Supabase (PostgreSQL + **PostGIS**) · Prisma v7 | Cálculos espaciales delegados a la DB (`ST_Distance`, `ST_DWithin`) |
| Auth | Firebase Authentication | Tokens verificados en backend en cada request y en el handshake del socket |
| Docs API | OpenAPI 3.0.3 modular + Swagger UI + **test de contrato** | Si el spec y el router divergen, el build falla |
| Hosting | VPS (DigitalOcean/Donweb) + GitHub Actions | dev / test / prod |

Arquitectura en capas: **Controller/Socket → Service → Repository**. El backend valida cada acción y cada rol; el frontend solo orienta visualmente (RN-030).

### 3.3 Decisiones técnicas que vale la pena contar (son las que diferencian una tesis de un CRUD)

1. **Offline-first con cero pérdida de GPS (RN-038).** Los pings se encolan en el dispositivo (`lib/tracking/gpsQueue.ts`) y se sincronizan en lote al reconectar (`source: offline_sync`) sin romper la secuencia temporal. Demostrable: poner el celular en modo avión, seguir moviéndose, reconectar y ver que el recorrido se completa.
2. **Motor de eventos autónomo.** Una sola instancia por proceso, mantiene en memoria el estado de detención y el progreso en ruta de cada integrante. Cada ping calcula con PostGIS solo su propio progreso y compara contra el de los demás cacheado 30 s; antes recalculaba todo el grupo en cada ping (N² consultas). Diseñado para **150–200 usuarios concurrentes por viaje** (~40 eventos/s).
3. **Privacidad por diseño (RN-110 a RN-114, último commit 15/09).** Consentimiento informado versionado; compartir ubicación es por viaje y lo decide cada persona; con el compartir apagado el GPS se sigue guardando pero no se publica ni aparece en el mapa/leaderboard; registro de accesos agregado por ventana de 10 min (no un log por lectura, porque con 200 integrantes no escala). Un único punto de control: `privacidad.acceso.ts`.
4. **API-first con test de contrato.** ADR del 18/08 (`adr-documentacion-api.md`): la doc estaba desincronizada y nada podía detectarlo; ahora el spec es la fuente de verdad y un test falla el build si hay endpoints sin documentar o documentación fantasma. Buen ejemplo de "deuda técnica detectada y resuelta".
5. **Hora Argentina fija (RN-105).** Todo se almacena en UTC y se convierte solo en los bordes con `lib/tiempoArg.ts`. Evita el clásico bug de fechas en la demo.
6. **Seguridad vial (RN-070).** Moto excluida de rankings y leaderboard a nivel de código, no solo de UI.
7. **Interfaz adaptativa por actividad (RN-052).** Moto: pantalla completa, alto contraste, botones extra grandes para una mano, feedback visual. Bici/running/trekking: layout outdoor estándar, feedback háptico prioritario.

### 3.4 Pruebas de campo (contar como evidencia de validación)

El historial de commits muestra al menos tres rondas de testing con usuarios reales / salidas de campo: 05/06 ("correcciones de testing"), 26/06 ("arreglo de bugs, testing") y **31/08 ("arreglo de bugs detectados en la prueba"** — salida real con tracking en Expo Go que derivó en fixes al trazado de ruta y al tracking). `[BUSCAR EN DOCS]` si hay actas o registros de esas pruebas (cantidad de participantes, actividad, km, bugs encontrados), incluirlos: es de lo más valioso para la demo.

---

## 4. Estructura sugerida de la presentación

1. **Portada** — Mesh · Grupo 4 · 5K1 · fecha de la demo `[BUSCAR EN DOCS]`.
2. **El problema** — una salida grupal real: alguien se queda atrás y nadie se entera hasta la próxima parada. Ninguna app existente mira al grupo.
3. **La solución** — Mesh en una frase + los 4 tipos de actividad + los dos roles.
4. **Diferenciación** — tabla de competencia (§12 del doc de reglas).
5. **Alcance y tiers** — Core / Avanzado / Deseable con las épicas de cada uno.
6. **Cronograma: plan vs. real** — timeline de 9 sprints (tabla §2.1 de este guion), contrastado con el Gantt original `[BUSCAR EN DOCS]`. Ser honestos con el desvío de junio–agosto y mostrar la recuperación de velocidad desde Sprint 7.
7. **Estado del backlog** — tabla §2.2 (75 % desarrollado, Core 100 %).
8. **Arquitectura** — diagrama simple: app móvil ↔ REST + Socket.io ↔ PostGIS. Tabla de stack §3.2.
9. **Decisiones técnicas destacadas** — elegir 3 o 4 de §3.3 (recomendado: offline-first, motor de eventos, privacidad, API-first).
10. **Números del producto** — §3.1 en un slide de "cifras".
11. **Demo en vivo** — ver guion §5.
12. **Calidad y proceso** — Scrum, Jira, code review obligatorio, DoD, CI/CD, 311 tests, spec OpenAPI, pruebas de campo.
13. **Riesgos y lecciones aprendidas** — ver §6.
14. **Próximos pasos** — cerrar testing de las 13 historias, aprobación del PO, `[BUSCAR EN DOCS]` hitos de entrega/defensa.
15. **Cierre / preguntas.**

---

## 5. Guion de la demo en vivo (flujo recomendado)

Preparar de antemano: dos celulares (líder y participante) o un celular + un segundo cliente, backend en el VPS, un grupo ya creado, una ruta ya trazada. **No** demostrar nada que esté en `To Do`.

1. **Login** con Firebase (30 s). Mostrar perfil y la pantalla de privacidad/consentimiento de ubicación.
2. **Grupo**: mostrar miembros, invitar por QR (escanear desde el segundo celular).
3. **Crear viaje**: elegir actividad (mostrar que cambian los parámetros por defecto), trazar ruta en el mapa OSM con origen, destino y una parada intermedia categorizada, ver estimación de tiempo. Mostrar checklist de preparativos y clima si SCRUM-27 pasa testing antes de la demo.
4. **Iniciar viaje** como líder → el participante recibe `viaje:iniciado` y aparece en el mapa en vivo.
5. **Tiempo real**: mover un dispositivo (o usar un recorrido de prueba en test) y ver la posición actualizarse. Mostrar la interfaz adaptativa (elegir moto para el alto contraste, o bici para el layout estándar).
6. **Parada voluntaria** desde el participante → alerta al grupo. **Solicitar parada** al líder.
7. **Detención sin parada declarada** → el motor la marca como posible incidente → alerta automática al grupo → el usuario confirma "estoy bien".
8. **Offline**: modo avión en el participante, seguir, reconectar → el recorrido se completa sin huecos.
9. **Privacidad**: apagar "compartir ubicación" en el participante → desaparece del mapa del líder, pero el GPS propio se sigue guardando.
10. **Finalizar viaje** → métricas individuales y grupales, resumen visual y ranking (elegir bici o running para poder mostrar ranking; **si el viaje es de moto, el ranking no existe y hay que decirlo como feature, no como falta**).
11. Opcional si pasa testing: modo competitivo con leaderboard en vivo, o competir contra fantasma de un recorrido anterior.
12. Cerrar mostrando **Swagger UI en `/api/docs`** del ambiente productivo como evidencia de la API documentada.

Plan B por si falla la red en la sala: tener un video corto grabado del flujo 4–8 y capturas de cada pantalla.

---

## 6. Riesgos, lecciones y próximos pasos (para el slide de cierre)

**Riesgos abiertos hoy**
- 13 historias en estado *on testing* dependen de la aprobación del PO antes del 22/09 (fin del Sprint 9).
- Detección de desvíos y atrasos (SCRUM-32/33) están en testing: son parte del Core y del motor de eventos, hay que cerrarlas con pruebas de campo.
- Demo depende de conectividad y de GPS real; mitigación: plan B con video.

**Lecciones aprendidas** (a validar/ampliar con `[BUSCAR EN DOCS]` retrospectivas)
- Subestimamos el bloque de tiempo real: 4 sprints para lo que estaba planificado en 1–2.
- La documentación de API a mano no escala; se resolvió con spec-first + test de contrato.
- Los tests de campo encontraron bugs que los tests unitarios no (trazado de ruta, tracking en Expo Go).
- Sprint 7 con objetivo explícito ("aumentar la velocidad como equipo") triplicó el throughput.

**Próximos pasos**
- Cerrar testing y aprobación del PO de las 13 historias.
- `[BUSCAR EN DOCS]` hitos formales restantes: informe final, defensa, fecha límite.
- Tier Deseable queda documentado como trabajo futuro (E08–E12).

---

## 7. Checklist de lo que tenés que buscar en los documentos de la tesis

Antes de entregar la presentación, resolvé cada uno o dejalo como placeholder visible:

- [ ] Cronograma / Gantt original del plan de proyecto: qué épica en qué fecha.
- [ ] Fecha y formato de la demo, tiempo asignado, quién presenta.
- [ ] Fechas de entrega final y defensa; hitos de cátedra ya cumplidos (acta de constitución, informe de avance, etc.).
- [ ] Informes de avance previos o retrospectivas: causas del desvío junio–agosto.
- [ ] Registros de pruebas de campo: fecha, actividad, participantes, resultados.
- [ ] Confirmación de roles del equipo y si hubo cambios.
- [ ] Wireframes/mockups originales para mostrar "diseño vs. producto real", si existen.
- [ ] Cualquier métrica formal de la cátedra (horas, story points por sprint, burndown) si se registró en Jira o en los docs.

---

## 8. Fuentes de este guion

- Jira `mesh-g6.atlassian.net`, proyecto SCRUM: 67 historias + sprints 1–9 (consultado 16/09/2026).
- Repo `mesh-grupo-4/mesh`, rama `main`, commit `6f5c034` (15/09/2026).
- `tesis-brain/reglas-de-negocio.md` (v1.0, 08/05/2026), `tesis-brain/adr-documentacion-api.md` (18/08/2026), `backend/docs/websockets.md`, `backend/openapi/`, `CLAUDE.md`, `ESTRUCTURA.md`.
