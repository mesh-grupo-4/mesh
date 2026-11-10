# Mesh — Especificación Completa del Sistema

> **Documento de referencia para el equipo de desarrollo y agentes de IA**
> Proyecto Final 2026 · UTN FRC · Grupo 4 · Curso 5K1
> Versión: 1.0 · Fecha: 08/05/2026

---

## 1. ¿Qué es Mesh?

Mesh es una aplicación móvil diseñada para la **coordinación grupal en tiempo real** durante actividades deportivas y recreativas en movimiento: motociclismo, auto, ciclismo, running, trekking y rollers.

A diferencia de soluciones existentes (Strava, Garmin, Google Maps, Life360) que se enfocan en rendimiento individual o navegación punto a punto, Mesh resuelve un problema específico: **interpretar qué está pasando con el grupo como conjunto** — quién se desvió, quién se atrasó, quién se detuvo voluntariamente y quién podría estar en problemas.

### 1.1 Público objetivo

- Personas de 18 a 65 años con smartphone y conocimientos básicos de apps.
- Se excluyen menores de edad en esta primera etapa por complejidades legales de geolocalización infantil.
- Ámbito geográfico del MVP: Argentina, foco en Provincia de Córdoba.

### 1.2 Actores del sistema

| Actor | Descripción |
|---|---|
| **Líder / Guía** | Quien crea el viaje, define la ruta, configura parámetros y recibe alertas del grupo. Tiene permisos de gestión sobre el viaje. |
| **Integrante / Participante** | Miembro del grupo que participa en el viaje. Puede registrar paradas, solicitar detenciones y visualizar el mapa grupal. |
| **Usuario no autenticado** | Solo puede registrarse o recuperar contraseña. |
| **Sistema (motor de eventos)** | Lógica autónoma del backend que detecta desvíos, atrasos y detenciones sospechosas sin intervención humana. |
| **Superadmin (backoffice)** | Rol de **plataforma**, no de grupo (RN-120). Gestiona cuentas, grupos y viajes de toda la plataforma desde el backoffice; cada acción queda auditada. No ve ubicaciones (RN-126). |

---

## 2. Reglas de Negocio

### 2.1 Reglas de Usuarios y Autenticación

| ID | Regla |
|---|---|
| RN-001 | El email es único por usuario; no puede haber dos cuentas con el mismo email. |
| RN-002 | El teléfono debe tener formato válido de Argentina. |
| RN-003 | La contraseña debe tener mínimo 8 caracteres. |
| RN-004 | Se envía email de confirmación al registrarse; la cuenta no se activa hasta confirmar. |
| RN-005 | Tras 5 intentos fallidos de login, la cuenta se bloquea temporalmente. |
| RN-006 | El token de sesión tiene expiración configurable; al cerrar sesión se invalida en backend y se limpian datos locales. |
| RN-007 | El link de recuperación de contraseña expira a las 24 horas. Al resetear, todas las sesiones previas se invalidan. |
| RN-008 | La foto de perfil acepta jpg/png con tamaño máximo de 5 MB. |

### 2.2 Reglas de Grupos

| ID | Regla |
|---|---|
| RN-010 | El creador de un grupo es automáticamente su líder. |
| RN-011 | Solo existen dos roles dentro de un grupo: **líder** y **participante**. |
| RN-012 | El líder puede asignar y cambiar roles de otros integrantes. |
| RN-013 | Si el líder abandona el grupo, el rol se transfiere al siguiente integrante más antiguo; si no hay nadie, el grupo se elimina. |
| RN-014 | La eliminación de un grupo requiere confirmación explícita. |
| RN-017 | Las solicitudes de amistad requieren aceptación del receptor. Además de la búsqueda y el perfil público (donde el botón de solicitud se ve aunque la persona tenga sus logros privados, RN-077), se pueden enviar desde la lista de integrantes durante el viaje (`GET /api/amistades/relaciones` resuelve la relación con cada persona). |
| RN-018 | Invitar personas **al grupo** crea registros en `grupo_invitacion` con estado `pendiente`. Fuentes válidas (SCRUM-18): amigos aceptados, búsqueda global de usuarios registrados, o co-miembros de otro grupo del líder. Solo el **líder** del grupo destino puede invitar; se excluye al invitador y a quienes ya son miembros o tienen invitación pendiente. La respuesta de los endpoints de invitables distingue ambos estados con flags separados: `ya_es_miembro` (miembro real) e `invitacion_pendiente` (invitación sin aceptar), de modo que la UI muestre "Ya es miembro" vs "Invitación enviada" correctamente. `grupo_origen_id` es nullable cuando la invitación no proviene de otro grupo. **Reinvitación:** como hay una única fila por `(grupo_id, usuario_id)` (constraint `@@unique`), invitar a alguien que ya tuvo una invitación en otro estado (`aceptada` de una membresía pasada que abandonó, o `rechazada`) **reabre** esa fila a `pendiente` (upsert) en lugar de saltarla; así una persona que se fue del grupo puede volver a ser invitada y la invitación efectivamente llega. **Flujo distinto** de invitar grupos a un viaje (RN-028/RN-029). |
| RN-019 | El invitado a un grupo puede aceptar o rechazar una invitación pendiente (SCRUM-17). Aceptar la marca como `aceptada` y agrega al usuario como `participante` del grupo; rechazar la marca como `rechazada` sin modificar membresía. Abandonar el grupo elimina la membresía pero conserva la fila `grupo_invitacion` (queda en `aceptada`); una futura reinvitación la reabre a `pendiente` (ver RN-018). |
| RN-019b | **Pendientes en la tab bar:** la pestaña **Grupos** muestra un badge con la suma de invitaciones a grupos pendientes (RN-018) y solicitudes de amistad recibidas (RN-017); se oculta en 0 y muestra `99+` por encima de 99. Al crear una invitación a grupo o una solicitud de amistad, el backend envía un **push** al destinatario (`data.tipo`: `invitacion_grupo` / `solicitud_amistad`, best-effort, no bloquea la respuesta); con la app abierta el push refresca el badge al instante, y al tocarlo abre Grupos en la sección correspondiente. Como respaldo, el badge se refresca al volver la app a primer plano y cada 60 s. |
| RN-027 | Los grupos son **listas persistentes de contactos** para facilitar invitaciones masivas. La membresía de un grupo es **independiente** de la participación en un viaje: un usuario puede estar en un viaje sin pertenecer al grupo que originó la invitación, y viceversa. **Trazabilidad grupo↔viaje:** los grupos desde los que se creó un viaje grupal quedan registrados en la tabla join `viaje_grupo` (`viaje_id`, `grupo_id`, relación **muchos-a-muchos**, `ON DELETE CASCADE` en ambos lados). Esto **no** altera membresías ni participación (siguen independientes); solo permite contar y rastrear los viajes originados desde cada grupo. El detalle de grupo (`GET /api/grupos/:grupoId`) expone `cantidad_miembros` y `cantidad_viajes` calculados desde esta relación y desde `grupo_miembro`. |
| RN-027b | **Pantalla de grupo (UI):** las acciones destructivas **Abandonar grupo** (todos los miembros) y **Eliminar grupo** (solo líder, ver RN-014) viven en la pantalla de **edición del grupo** (accesible para todos los miembros desde el ícono de ajustes), no en la pantalla principal del grupo. La invitación de personas (RN-018) tiene un único punto de entrada en el detalle del grupo. |

**Contrato API MVP (SCRUM-11 / SCRUM-13 / SCRUM-14 / SCRUM-17 / SCRUM-18):** OpenAPI en `backend/openapi/paths/grupos.yaml` y `backend/openapi/paths/amistades.yaml` (spec modular, ver [[adr-documentacion-api]]). Endpoints destacados: `GET /api/usuarios/me` (lee el perfil desde la BD), `POST /api/usuarios/sync` (alta/actualización; persiste `nombre`, `apellido`, `telefono` y `actividad_preferida`), `POST /api/grupos`, `GET /api/grupos/:grupoId`, `GET /api/grupos/:grupoId/amigos-para-invitar`, `GET /api/grupos/:grupoId/buscar-usuarios`, `POST /api/grupos/:grupoId/invitar-usuarios`, `GET /api/grupos/invitaciones/pendientes`, `POST /api/grupos/invitaciones/:invitacionId/responder` (`GET /api/grupos/:grupoId` devuelve además `cantidad_miembros` y `cantidad_viajes`), `GET /api/amistades`, `GET /api/amistades/buscar`, `DELETE /api/amistades/:usuarioId`, `POST /api/amistades/solicitar`, `POST /api/amistades/solicitudes/:id/responder`. Auth: Bearer Firebase ID token.

**Contrato API viajes (RN-015–029):** OpenAPI en `backend/openapi/paths/viajes.yaml` (spec modular, ver [[adr-documentacion-api]]). Endpoints destacados: `POST /api/viajes` (body: `nombre` obligatorio, `tipoActividad`, `fechaProgramada` futura, `esGrupal`, y en grupales `grupoIds` + `amigoIds`), `GET /api/viajes/planificados`, `GET /api/viajes/invitaciones/pendientes` (ambos devuelven `nombre` del viaje como identificador principal), `POST /api/viajes/:viajeId/invitacion/responder`, `POST /api/viajes/:viajeId/invitaciones` (invitar después de crear, RN-028), `GET /api/viajes/:viajeId/participantes`, `POST /api/viajes/:viajeId/unirse-qr`, `POST /api/viajes/:viajeId/check-in` ("Me sumo", RN-029b), `POST /api/viajes/:viajeId/liderazgo` (ceder el viaje, RN-029d), `POST /api/viajes/:viajeId/avisar-faltantes` (push del líder a los confirmados que no están, RN-029e), `POST /api/viajes/:viajeId/salir` (body opcional `nuevo_lider_id`; responde `accion: salido | ausente | rechazado`, RN-029c). `POST /api/viajes` acepta `inmediato: true` en lugar de `fechaProgramada` ("Viaje YA", RN-107).

### 2.3 Reglas de Viajes y Rutas

| ID | Regla |
|---|---|
| RN-015 | El código QR de invitación es único por viaje y expira al iniciar el viaje. Cada viaje tiene además un **código de invitación** corto (8 caracteres, formato `XXXX-XXXX`, sin 0/O ni 1/I) con la misma vigencia, para sumarse escribiéndolo desde la pantalla de escaneo (`POST /api/viajes/unirse-codigo`). Una vez iniciado o finalizado el viaje, la app deja de ofrecer el QR y el código, y el backend responde 410 `QR_EXPIRED`. |
| RN-016 | El escaneo del QR o el ingreso del código agrega al usuario **al viaje** directamente, sin aprobación manual (`origen: qr` en ambos casos). No modifica la membresía de ningún grupo. |
| RN-020 | Un viaje puede ser **individual** (sin invitados iniciales) o **grupal** (con uno o más participantes). |
| RN-028 | Al crear un viaje grupal, el creador puede invitar por dos vías (UI: dos `Collapsible`, Grupos y Amigos): **(a) grupos** de los que es **miembro**, invitando en bloque a sus integrantes (`origen: grupo`); y **(b) amigos** individuales con amistad **aceptada** (`origen: amigo`, validado en backend con 403 `NOT_FRIEND` si no son amigos). Ambos `grupoIds` y `amigoIds` solo se aceptan en viajes grupales. Si un usuario llega por varios caminos (varios grupos, o grupo + amigo) recibe **una sola invitación** (se prioriza `origen: grupo`). El campo `invitaciones_enviadas` cuenta el total sin duplicar. El viaje se crea con `nombre` obligatorio (1–100) y `fecha_programada` futura definida por el creador. Los `grupoIds` invitados se **persisten** en `viaje_grupo` (RN-027) para trazabilidad y conteo de viajes por grupo. **Después de crear:** el líder puede sumar grupos/amigos con `POST /api/viajes/:viajeId/invitaciones` mientras el viaje esté `planificado` (mismas validaciones; 403 `NOT_CREATOR` si no es el líder, 409 `INVALID_STATE` si ya arrancó, 409 `INDIVIDUAL_TRIP` si es individual). Quien ya figura en el viaje, en cualquier estado, no se vuelve a invitar. |
| RN-029 | Las invitaciones al viaje (originadas por grupos o por amigos) requieren **confirmación** del invitado (aceptar/rechazar asistencia). El creador del viaje ve la lista de confirmados y rechazados. Distinto de RN-016 (QR al viaje) y de RN-018 (membresía de grupo). |
| RN-029b | **Presencia en el viaje (check-in).** `confirmado` solo significa "dije que voy". Cuando el viaje arranca, cada confirmado elige **"Me sumo"** (`POST /api/viajes/:viajeId/check-in`, guarda `viaje_integrante.check_in_at`) o **"No voy a ir"**. Sin check-in el backend **rechaza su GPS** (`403 NOT_CHECKED_IN` en las tres entradas: socket, lote offline y ubicación viva), el motor de eventos no lo evalúa, no recibe push de alertas en vivo y no puede crear alertas ni paradas. Así, quien confirmó y se quedó en casa no dispara desvíos, atrasos ni "posible incidente" al grupo, ni expone su domicilio en el mapa. Puede **ver** el mapa (la sala admite a cualquier confirmado). El líder hace check-in implícito al iniciar. El check-in es idempotente y viaja en la **cola offline** del dispositivo, que lo manda **antes** que las posiciones (RN-038: si se toca sin señal, nada se pierde). **Red de seguridad del motor:** aunque alguien se sume desde lejos, el motor no lo evalúa hasta que su primer ping cae a menos de `distancia_max_separacion` de la ruta. |
| RN-029c | **No asistió y baja previa.** Quien confirmó pero nunca se sumó queda **`ausente`**: al tocar "No voy a ir" con el viaje en curso, o automáticamente al finalizar. Un `ausente` no cuenta como integrante del resumen ni le aparece el viaje en su historial, estadísticas o reportes de actividad (que filtran `confirmado`/`salido`); sí cuenta como invitación aceptada. Bajarse **antes del inicio** deja a la persona **`rechazado`** (no `salido`): nunca fue. `salido` queda solo para quien se sumó y abandonó en curso. |
| RN-029d | **Liderazgo del viaje cedible.** El líder puede cederle el viaje a otro integrante (`POST /api/viajes/:viajeId/liderazgo`): antes del inicio, a un `confirmado`; en curso, a alguien que ya hizo check-in. El líder anterior sigue como participante. Para **bajarse**, el líder tiene que ceder primero (`POST /salir` con `nuevo_lider_id`, igual que RN-013 en grupos; la UI preselecciona al más antiguo): sin sucesor responde `LEADER_MUST_TRANSFER`, y si no hay a quién cederlo `LEADER_LAST_MEMBER` (hay que eliminar el viaje si no empezó, o finalizarlo si está en curso). No crea roles nuevos (RN-011): cambia `viaje.creador_id`, así que todos los permisos de líder (RN-030) pasan al sucesor. Se emite `viaje:lider_cambiado` y se notifica por push al nuevo líder. |
| RN-029e | **Aviso a los que faltan.** El líder puede avisarles por notificación push a los que dijeron que iban y todavía no están (`POST /api/viajes/:viajeId/avisar-faltantes`). Con el viaje `planificado` llega a todos los `confirmado` ("Estamos por salir"); con el viaje `en_curso`, solo a los `confirmado` sin check-in ("Ya arrancamos", RN-029b). Solo el líder (RN-030, `NOT_CREATOR`), nunca se avisa a sí mismo, el texto es fijo (sin mensaje libre) y no incluye la ubicación de nadie. Hay una espera de **2 minutos** entre avisos por viaje (`429 AVISO_RECIENTE` con `reintentar_en_seg`); si no hay a quién avisar la espera no se consume. La respuesta distingue `faltantes` de `avisados` (los que tienen push activa). **Al iniciar el viaje el backend manda el mismo aviso automáticamente** ("El viaje arrancó"): el evento `viaje:iniciado` solo llega con la app abierta. La push sale con gravedad `importante` (ver [[us-alertas-e-historial]]). En la app, el botón está en la pantalla **Miembros** del viaje. |
| RN-021 | Los tipos de actividad disponibles son: **moto**, **auto**, **bici**, **running**, **trekking**, **otro**. Cada uno tiene parámetros por defecto diferentes. |
| RN-022 | Las categorías de parada son: **accidente**, **combustible**, **descanso**, **gastronomía**, **punto de control**, **sanitario**, **otro**. `accidente` solo aplica a paradas voluntarias del viaje en vivo (se muestra destacada en el selector "¿por qué parás?") y además genera una alerta de peligro para todo el grupo. Las paradas planificadas de la ruta no usan `accidente`. |
| RN-023 | La estimación de tiempos depende del tipo de actividad seleccionado y la distancia, más el tiempo configurable de cada parada. |
| RN-024 | Las rutas se trazan sobre Google Maps (Routes API, con OSRM/Valhalla de respaldo); las paradas son reordenables. Ver [[adr-mapas-google]]. |
| RN-025 | Los parámetros configurables por el líder son: velocidad promedio esperada (1–300 km/h), distancia máxima de separación del grupo (10–20 000 m) y tiempo de tolerancia de atraso (1–60 min). Nacen con los defaults de la actividad (RN-021) y se ajustan al crear (`POST /api/viajes`) o después con `PATCH /api/viajes/{id}` mientras el viaje no esté finalizado; un cambio en curso aplica al próximo ping del motor. `tolerancia_atraso_min = NULL` significa "default de la actividad". |
| RN-026 | El checklist de preparativos es **personal**: cada integrante tiene el suyo dentro del viaje, con su propio estado de completado. El sistema **sugiere** ítems según el `tipo_actividad` la primera vez que el integrante lo abre (`origen: sugerido`, borrables). Cada uno puede **agregar** ítems propios (`origen: personal`). El **creador del viaje** puede definir ítems **base para todo el grupo** (`origen: lider`, RN-030): se copian al checklist de cada integrante confirmado, que los marca pero no los edita ni los borra; si el creador los renombra o borra, el cambio se propaga. Los checklists son **reutilizables**: se pueden importar los ítems propios de otro viaje del que se participó, sin duplicar los que ya están. El checklist se edita en `planificado` y `en_curso`; en `finalizado` queda de solo lectura. |

### 2.4 Reglas de Ejecución en Tiempo Real

| ID | Regla |
|---|---|
| RN-030 | Solo el **creador del viaje** (`creador_id`) puede iniciar y finalizar un viaje. Esto es independiente del rol de líder en cualquier grupo. |
| RN-030b | Solo el **creador** puede **eliminar** un viaje en estado `planificado`. La eliminación requiere confirmación explícita en UI y borra en cascada ruta, integrantes e invitaciones (`DELETE /api/viajes/:viajeId`). No se puede eliminar un viaje `en_curso` ni `finalizado`. |
| RN-030c | **Un solo viaje en curso por persona al iniciar.** No se puede iniciar un viaje si quien lo inicia es líder de otro viaje `en_curso` o ya se sumó a uno con check-in (`409 OTRO_VIAJE_EN_CURSO`, con `viaje_en_curso_id` para que la app ofrezca ir a ese viaje). Un `confirmado` sin check-in no bloquea, porque solo dijo que iba (RN-029b). Quien salió de un viaje (`salido`) tampoco queda bloqueado. Por ahora la regla aplica solo a iniciar: el "Me sumo" a un segundo viaje no se bloquea. |
| RN-031 | Al iniciar, el sistema recolecta ubicación GPS cada **5 segundos**. |
| RN-032 | La latencia máxima aceptable de actualización de posición en el mapa es **10 segundos**. |
| RN-033 | El sistema soporta hasta **150–200 usuarios concurrentes** por viaje. |
| RN-034 | **Detección de desvío**: se dispara alerta cuando un integrante supera X metros fuera de la ruta planificada (X es configurable). |
| RN-035 | **Detección de atraso**: se calcula comparando la posición del integrante con el bloque principal del grupo. Se dispara según la tolerancia configurada. |
| RN-036 | **Detección de incidente vs. parada voluntaria**: si un usuario se detiene por más de N minutos SIN registrar parada manual, se genera alerta de "posible incidente" con la ubicación exacta. La notificación push llega a **todo el grupo** (líder e integrantes, salvo el afectado, que ve el banner "Estoy bien"); desvío y atraso se notifican solo al líder. El integrante puede confirmar que está bien para cancelarla, o confirmar que **está mal** (p. ej. accidente): se avisa a todo el grupo con una alerta de peligro + push. Volver a tocar "estoy mal" deshace el aviso, previa confirmación. Cerrado el incidente ("estoy bien" o el líder resuelve/cancela su alerta), el integrante vuelve a `en_movimiento` en el mapa y no se genera un incidente nuevo en el mismo punto hasta que se aleje de él. Los N minutos se cuentan desde que el integrante entra al viaje (primera posición que recibe el servidor), nunca desde el timestamp de un punto GPS cacheado o encolado antes. |
| RN-037 | Los estados visibles de un integrante en el mapa son: **en movimiento**, **detenido-voluntario**, **posible incidente**. El estado se **deriva** de la parada abierta del integrante (`parada.fin IS NULL`), no se almacena duplicado en `ubicacion_viva`. |
| RN-038 | En modo offline, los datos GPS se almacenan localmente y se sincronizan automáticamente al reconectar. No se pierden registros. |

### 2.5 Reglas de Alertas

| ID | Regla |
|---|---|
| RN-040 | Las alertas se envían como notificación push a todos los integrantes del viaje. |
| RN-041 | Alertas manuales con tipo y mensaje predeterminado editable. Tipos: **parada**, **combustible**, **desvío**, **peligro**, **información** y **atraso**. La ubicación (`lat`/`lng`) es opcional y representa el punto de parada futuro marcado en el mapa, no el GPS del autor. Solo con viaje `en_curso`. |
| RN-042 | Las alertas activas pueden pausarse o cancelarse individualmente por el líder. Cancelar o resolver la alerta de un posible incidente (o el pedido de ayuda) cierra el incidente completo (RN-036). |
| RN-043 | Las alertas automáticas de incidente incluyen la ubicación exacta del evento. |
| RN-044 | Un integrante puede solicitar una parada al grupo; el líder puede aprobarla o rechazarla. |
| RN-045 | **Parada grupal.** En un viaje grupal en curso, el líder puede registrar una parada para todo el grupo: se abre una parada voluntaria a cada integrante sumado, todas en el punto del líder (RN-111). A quien ya tiene una parada abierta o un posible incidente no se le modifica. Cuando el líder retoma, se cierran todas las paradas grupales abiertas; un integrante puede retomar antes, solo la suya. Solo el líder puede iniciarla (RN-030). |
| RN-108 | El líder configura `alertas_solo_lider` (default `true`). Si está desactivado, cualquier integrante confirmado puede crear alertas manuales durante el viaje. |

### 2.6 Reglas de Interfaz Adaptativa

| ID | Regla |
|---|---|
| RN-050 | En **modo moto y auto**: pantalla completa, botones grandes, alto contraste. Prioridad a la seguridad vial. |
| RN-051 | En **modo trekking/running**: retroalimentación háptica (vibración) priorizada sobre visual. |
| RN-052 | Todos los textos superan el tamaño mínimo para uso outdoor. La interfaz muestra lo mínimo necesario. |

### 2.7 Reglas de Métricas y Cierre

| ID | Regla |
|---|---|
| RN-060 | Al finalizar un viaje se detiene el tracking de todos los integrantes y se genera automáticamente el resumen. |
| RN-061 | Métricas individuales: distancia recorrida, tiempo total, tiempo en movimiento, tiempo detenido, velocidad promedio. |
| RN-062 | Métricas grupales: integrantes totales, distancia promedio, cantidad de alertas generadas. |
| RN-063 | El ranking de **este viaje** (recap post-cierre, cards con tabs) se ordena por velocidad promedio, distancia o tiempo en movimiento. Solo viajes **grupales** y **no motorizados** (ni moto ni auto, RN-070). Usa los números ya calculados en `metrica_viaje`; no es una tabla global ni el Wrapped de período. |
| RN-065 | **Modo entrenamiento (SCRUM-47/48):** al crear, el viaje elige `modo` = `recreativo` (default), `entrenamiento` o `competitivo` (ver RN-071). En entrenamiento el mapa en vivo suma un panel con velocidad actual, promedio y ritmo, y al cerrar `GET /mis-metricas` agrega `splits_km` (tiempo por kilómetro, PostGIS sobre `registro_gps`) y `entrenamiento` (número de sesión, mejor ritmo/distancia, delta contra la sesión anterior y evolución de las últimas 6 sesiones de la misma actividad, todo desde `metrica_viaje`). RN-070 aplica: en moto no hay velocidades, ritmos ni splits, solo distancia y tiempo. |
| RN-064 | El resumen visual (tipo "Wrapped") se genera **mensual y anualmente**; es compartible como imagen. Distinto del recap de un viaje (RN-063). |

#### Definición operativa: "distancia real del viaje"

`resumen_viaje.distancia_real_m` es la traza recorrida por el **creador** del viaje, **no** la
suma de los recorridos de los integrantes: sumarlas daría N veces el recorrido en un viaje de N
personas. Si el creador no tiene registros GPS (por ejemplo se quedó sin batería), se usa el
**máximo** entre los integrantes.

Se calcula en PostGIS agregando `registro_gps` segmento a segmento con `ST_Distance` + `LAG()`,
descartando lecturas con más de 100 m de error declarado, saltos mayores a 500 m y huecos
temporales de más de 120 s. Por esos filtros el valor difiere en torno a un 2-5 % del contador
en vivo del dispositivo, que no filtra.

#### Definición operativa: "en movimiento"

Con el teléfono quieto, el GPS devuelve cada lectura unos metros al lado de la anterior. Un
tramo solo cuenta como movimiento si el desplazamiento neto en una ventana de ±30 s, o el
propio tramo, alcanza el radio de quietud: 20 m, o la precisión declarada de la lectura si es
mayor (`RADIO_QUIETO_M`, `backend/src/lib/gpsFilters.ts`). Resumen, splits, perfil de velocidad
y fantasma usan el mismo criterio.

Quien acumula menos de 100 m (`DISTANCIA_MINIMA_M`) no tiene fila en `metrica_viaje`: el
resumen lo muestra como "sin movimiento registrado" en vez de calcular un ritmo sobre ruido.
Las filas de `registro_gps` no se tocan (RN-038).

#### Paradas en el cierre

`GET /resumen` devuelve `paradas`: hora, duración, categoría y quién, en orden cronológico,
incluidos los posibles incidentes. Una parada grupal (RN-045) guarda una fila por integrante,
pero se muestra y se cuenta como una sola. No lleva coordenadas: mostrar dónde paró un tercero
tendría que pasar por `privacidad.acceso` (RN-111).

Las métricas individuales (`metrica_viaje`) cubren hoy distancia, tiempo en movimiento,
velocidad promedio, velocidad máxima y altimetría (desnivel positivo/negativo, altitud
máxima/mínima). Tiempo detenido de RN-061 se estima en el recorte actual como duración del
viaje menos tiempo en movimiento.

#### Datos del GPS del dispositivo y altimetría

Cada muestra guarda en `registro_gps`, además de lat/lng/precisión, todo lo que entrega el
GPS del celular: `altitud_m`, `precision_altitud_m`, `velocidad_kmh` (medida por el chip) y
`rumbo_grados`. Son opcionales: las apps viejas no los mandan y un valor fuera de rango se
guarda como `null` sin rechazar el punto (RN-038). Sin APIs pagas: todo sale del dispositivo.

- **Normalización en el dispositivo** (`frontend/lib/tracking/datosGpsExtra.ts`): Android
  informa 0 y iOS -1 cuando no tienen el dato. La altitud solo se acepta si viene con
  precisión vertical; el rumbo, solo en movimiento (> 0,5 m/s).
- **Velocidad máxima:** se usa la del chip GPS, tomando el mínimo entre dos muestras
  consecutivas (≤ 30 s) para descartar picos aislados. Si no hay dato del chip, cae a la
  derivada de las posiciones. RN-070: en moto y auto el resumen la devuelve siempre en `null`.
- **Altimetría** (`backend/src/lib/altimetria.ts`): la altitud GPS tiene ruido de ±10 m, así
  que se descartan muestras con precisión vertical > 25 m, se toma la mediana cada 30 s (en
  PostGIS/SQL) y se aplica histéresis de 8 m con seguimiento de extremos. Es conservador:
  prefiere no contar una loma chica antes que inventar desnivel en un recorrido plano. Los
  umbrales son calibrables con pruebas de campo.
- **Referencia de la altitud:** iOS la da sobre el nivel del mar y Android sobre el elipsoide
  WGS84 (en Argentina difiere unos 15–25 m). El desnivel no se ve afectado porque es una
  diferencia; la altitud máxima/mínima se muestra como "aproximada".
- El desnivel es un dato del terreno, no de velocidad: se muestra en todas las modalidades.
  Cualquier ranking futuro por desnivel igual pasa por `esMotorizado()` (RN-070).

#### Rumbo en el mapa grupal

De los datos extra del GPS, el **rumbo** es el único que se publica al grupo: cada integrante
en movimiento muestra una flecha junto a su avatar que indica hacia dónde va. Sirve para
coordinar (quién se desvió, quién viene de frente, quién dobló) sin mirar la velocidad.

- Viaja por los tres canales del mapa: `ubicacion_viva.rumbo_grados` (snapshot REST y Supabase
  Realtime) y el campo `rumbo` de `viaje:ubicacion`. Pasa por el mismo camino de publicación
  que la posición, así que **sin compartir ubicación no se publica** (RN-111).
- Es el **último rumbo conocido**: quieto el GPS no da rumbo, y el backend conserva el anterior
  en vez de borrarlo. El cliente oculta la flecha si el integrante está detenido, en posible
  incidente o sin señal (`frontend/components/live/RumboMarker.tsx`).
- La flecha es un marcador aparte y plano, girado dentro de su propia vista en pasos de 10°.
  No se usa la `rotation` nativa del marcador: en Android con la nueva arquitectura,
  `react-native-maps` 1.29 solo la aplica al crearlo y la flecha quedaba fija.
- Con el modo "seguirme" activo, el mapa gira hacia el rumbo propio. Arrastrar el mapa a mano
  pausa el seguimiento y el giro; el botón de centrar los reactiva. Con Apple Maps el mapa queda
  con el norte arriba, porque no hay marcadores planos.
- **Movimiento fluido (solo dibujo):** entre dos pings, cada marcador avanza según la velocidad
  y el rumbo de sus últimos pings, sobre la ruta planificada si la está siguiendo (a menos de
  40 m y en el mismo sentido) y en línea recta si no. Se estima hasta 6 s, y a los 9 s sin ping
  vuelve a la última posición real. Cuando llega un ping, el ajuste se ve como un deslizamiento.
  Las posiciones estimadas **nunca** se guardan, no se envían al backend ni alimentan el motor
  de eventos o las métricas (RN-038): todo eso sigue usando solo el GPS real.
- Altitud y velocidad **nunca** se publican al grupo: la velocidad de terceros en vivo sería
  justamente la comparación que RN-070 prohíbe.

El recap de ranking (RN-063) **no** introduce métricas nuevas: solo asigna puestos sobre
esas filas cuando `es_grupal && !esMotorizado(tipo_actividad)`. Ver [`us-ranking-viaje.md`](us-ranking-viaje.md).

### 2.8 Reglas de Gamificación y Competición

| ID | Regla |
|---|---|
| RN-070 | **Las modalidades motorizadas (moto y auto) quedan EXCLUIDAS de todos los rankings competitivos y tablas de posiciones** para evitar conductas de riesgo asociadas a la competencia. Esta es una regla de seguridad vial no negociable. **Implementación:** la compuerta única es `esMotorizado()` (`backend/src/lib/actividad.ts`, espejo en `frontend/lib/activityDefaults.ts`); ningún código compara contra `'moto'` a mano. |

#### RN-070 aplicada al resumen post-viaje

La pantalla de resumen (`/viaje/:id/resumen`) muestra al usuario **su propia** velocidad
promedio, también en moto. Criterio adoptado y su fundamento:

- No hay un segundo sujeto contra quien medir → no es ranking ni tabla de posiciones.
- Es post-hoc, con el viaje ya cerrado → no puede inducir a acelerar mientras se conduce, que
  es el riesgo vial que la regla protege.
- No otorga posición, logro ni premio → no es gamificación de velocidad.

Salvaguardas que el código debe mantener, verificadas en `viajes.resumen.test.ts`:

1. `GET /resumen` **nunca** devuelve métricas de terceros. No agregar un campo `por_integrante`.
2. El contrato lleva `ranking_habilitado: !esMotorizado(tipo_actividad)`, como compuerta única para
   cualquier feature comparativa futura.
3. **Nunca velocidad máxima en moto** — eso sí sería gamificación de velocidad. Solo promedio.
4. En moto el rótulo es "Ritmo promedio" con el pie "Dato informativo, no comparativo". Sin
   lenguaje de logro, récord ni comparación contra `velocidad_esperada` en tono de meta.
5. La velocidad nunca se destaca en la pantalla de seguimiento en vivo.

Si el PO prefiere un criterio más conservador, la alternativa es devolver
`velocidad_promedio_kmh: null` cuando la actividad es moto: es un solo `if` en el service.
| RN-071 | El modo competitivo activa un leaderboard en tiempo real basado en posición y tiempos relativos. **Implementación (SCRUM-51):** `modo = competitivo` solo en viajes grupales y nunca en moto ni auto (RN-070; `400 MODO_INVALIDO`). El motor de eventos emite `viaje:leaderboard` con cada ping (máx. cada 3 s) ordenando por progreso sobre la ruta planificada, con `deltaM` y `gapSeg` (atraso a la velocidad esperada) respecto del líder; `GET /leaderboard` da la foto inicial. El recap post-cierre (RN-063) solo tiene puestos en competitivo. |
| RN-072 | El modo recreativo desactiva rankings y comparaciones pero mantiene navegación y alertas de seguridad. **Implementación (SCRUM-52):** en `recreativo` el resumen y las métricas grupales devuelven `ranking_habilitado: false`, no hay leaderboard, no hay fantasma (`409 FANTASMA_NO_DISPONIBLE`) ni panel de ritmo en vivo; el mapa, las paradas y todas las alertas siguen igual. |
| RN-073 | El ghost tracking superpone un marcador fantasma de un recorrido histórico que se mueve en tiempo real. El usuario ve si va adelante o atrás. **Implementación (SCRUM-49/50):** fuentes = traza GPS de un viaje finalizado en el que participó (propia o de otro integrante) o una ruta compartida importada como plantilla, recorrida a ritmo constante según su tiempo estimado. `GET /fantasma/candidatos` y `GET /fantasma` (≤ 1500 puntos con `t_seg` y `d_m`). El cliente anima el fantasma contra el tiempo desde el inicio del viaje, muestra metros y segundos adelante/atrás comparando distancia recorrida, y permite pausarlo o quitarlo. Nunca en moto (RN-070) ni en recreativo (RN-072). |
| RN-074 | Las insignias se otorgan automáticamente al cumplir criterios de logro (distancia, duración, tipo de actividad). **Implementación:** `InsigniasService.evaluarYOtorgar()`, llamado por `ViajesService.generarResumen()` al finalizar el viaje, contra la `MetricaViaje` recién calculada de cada integrante. Ver [`us-insignias.md`](us-insignias.md). |
| RN-075 | Las rachas se miden en semanas consecutivas con al menos una actividad (un viaje finalizado). Al romperse, el contador se reinicia. **Implementación:** `RachasService.registrarActividad()`, llamado por `ViajesService.generarResumen()` al finalizar un viaje; detecta hitos (3, 5, 10 semanas) y rotura. Un job diario (`src/jobs/rachasJob.ts`) notifica las rachas rotas por pura inactividad el mismo día, sin esperar al próximo viaje. Ver [`us-rachas.md`](us-rachas.md). |
| RN-076 | La tabla global de posiciones está segmentada por tipo de actividad (bici, running, trekking, otro — moto y auto no tienen tabla, RN-070) y filtrable por período (semanal, mensual, anual). **Implementación:** `TablaPosicionesService.obtener()`, calculada on-demand sumando `MetricaViaje` de los viajes finalizados desde el inicio del período vigente; nada persistido aparte. Ver [`us-tabla-posiciones.md`](us-tabla-posiciones.md). |
| RN-077 | Cada persona elige **quién ve sus logros** (estadísticas agregadas, racha e insignias) en su perfil: `todos` (por defecto), `amigos` (solo amistades aceptadas) o `solo_yo`. Un único ajuste para los tres. El propio usuario siempre ve los suyos. Nombre, actividad preferida y el botón de solicitud de amistad se ven siempre. **Implementación:** `usuario.visibilidad_logros`, editable por `PUT /api/usuarios/me/privacidad`. El punto de control único es `modules/privacidad/logros.acceso.ts` (`puedeVerLogros` / `assertPuedeVerLogros`): el perfil devuelve los logros en `null` con `logros_visibles: false`, y `GET /insignias/usuario/:id` y `GET /rachas/usuario/:id` responden `403 LOGROS_PRIVADOS`. Ver [`us-insignias.md`](us-insignias.md). |
| RN-078 | Cada insignia tiene una **rareza fija** definida en el catálogo: `comun`, `rara`, `epica` o `legendaria`. Solo cambia cómo se ve (color, marco y, en épicas y legendarias, un brillo animado); no afecta el otorgamiento ni compara usuarios entre sí. Nunca se usa para premiar velocidad (RN-070). **Implementación:** columna `insignia.rareza`, asignada en la migración `20261110120000_logros_visibilidad_rareza`. Ver [`us-insignias.md`](us-insignias.md). |

### 2.9 Reglas de Red Social de Recorridos

| ID | Regla |
|---|---|
| RN-080 | La red social es **deliberadamente acotada**: no es una red social generalista. |
| RN-081 | Los usuarios publican recorridos de su historial; pueden despublicarlos en cualquier momento. **Implementación (SCRUM-61):** se publica un viaje `finalizado` en el que participó (creador o `confirmado`/`salido`) congelando un snapshot de **su** traza GPS, distancia y tiempo en movimiento — nunca velocidad (RN-070). Despublicar es `activo = false`. Botón en el resumen del viaje. Al publicar, el autor puede sumar un comentario (hasta 280 caracteres) y elegir si comparte su checklist de ese viaje; ambos son parte del snapshot. Ver [`us-publicar-recorrido.md`](us-publicar-recorrido.md). |
| RN-082 | La valoración es binaria: "Recomiendo" / "No recomiendo". Un usuario solo puede valorar una vez por recorrido. **Implementación (SCRUM-63):** PK `(recorrido, usuario)`; la valoración es definitiva (`409 VALORACION_EXISTENTE`) y el autor no valora lo propio (`403 VALORACION_PROPIA`). Se muestra el porcentaje entero de recomendaciones (`null` sin votos). **Orden del listado (cambio del 09/11/2026):** los recorridos "Muy recomendado" (80 % o más de "Recomiendo" con al menos 3 valoraciones) van primero; dentro de cada grupo, el más reciente primero. El orden usa solo la valoración de la comunidad sobre la ruta, nunca velocidad ni rendimiento (RN-070), ni la reputación de quien publicó. Ver [`us-valorar-recorridos.md`](us-valorar-recorridos.md). |
| RN-083 | **No se permiten comentarios de texto** para mantener la simplicidad y evitar moderación. **Implementación:** el body de valoración es `{ recomiendo }` con Zod `.strict()`; cualquier otro campo es `400`. **Alcance:** la regla aplica a la comunidad. El autor puede dejar una única nota al publicar su recorrido (RN-081); nadie más escribe texto ni hay hilos ni respuestas. Esa nota no pasa por moderación. |
| RN-084 | Los recorridos publicados son importables como base para nuevos viajes. **Implementación (SCRUM-62):** importar crea una `RutaPlantilla` en "Mis rutas" (traza → trazado planificado, extremos → origen y destino, sin paradas), idempotente por `(usuario, recorrido)`, y la app abre "Crear viaje" con esa plantilla, o la deja guardada sin crear el viaje. Si el autor compartió el checklist, quien guarda elige si se lo lleva: al crear un viaje con esa plantilla los ítems entran como personales en su checklist. El listado se filtra por actividad, por zona (recorridos que **arrancan** dentro de un radio, `ST_DWithin`) y por texto (nombre, comentario o autor, sin distinguir acentos). Ver [`us-explorar-recorridos.md`](us-explorar-recorridos.md). |
| RN-085 | El **link de ruta** comparte solo el **snapshot planificado** congelado al generar el token (geometría + postas + tipo de actividad). No comparte integrantes, ubicación en vivo, alertas ni métricas. Distinto del QR de unirse al viaje (RN-015/016). Con dominio configurado, tanto este link como el QR son https: abren la app si está instalada y la landing si no (ver [`us-compartir-ruta.md`](us-compartir-ruta.md)). |
| RN-086 | Importar crea una **plantilla copia** en el perfil del receptor. Editar o eliminar el viaje/ruta fuente **no** altera plantillas ya importadas. El link sigue resolviendo su snapshot aunque se borre la fuente. |
| RN-087 | Pueden obtener el link los integrantes con estado `confirmado` (incluye al creador). Solo el **creador** del viaje puede **revocar** el token. El link **no expira** al pasar a `en_curso`/`finalizado`. |
| RN-088 | El token es **opaco** y único por ruta compartida; no se usa el `viajeId` como secreto. Reimportar el mismo link es **idempotente** por `(usuario, ruta_compartida)`. |

**Contrato API:** link de ruta en `backend/openapi/paths/rutas-compartidas.yaml` (deep link `mesh://ruta?token=...`, US [`us-compartir-ruta.md`](us-compartir-ruta.md)); recorridos publicados, exploración, importación y valoraciones en `backend/openapi/paths/recorridos-publicados.yaml` (spec modular, ver [[adr-documentacion-api]]).

### 2.10 Reglas de Asistencia IA

| ID | Regla |
|---|---|
| RN-090 | La recomendación climática distingue por tipo de actividad (lluvia impacta diferente en moto que en trekking). |
| RN-091 | Los niveles de recomendación son: "Condiciones favorables", "Condiciones regulares", "No recomendado" — siempre con motivo. |
| RN-092 | Los itinerarios generados por IA son editables y se pueden importar como paradas del viaje. |
| RN-093 | Se registra un historial de recomendaciones vs. condiciones reales para evaluar precisión. |

### 2.11 Reglas de Información de Ruta Externa

| ID | Regla |
|---|---|
| RN-100 | Si la API externa no está disponible, el mapa base funciona sin interrupciones. |
| RN-101 | Los reportes comunitarios de incidentes tienen vigencia limitada y desaparecen automáticamente al vencerse. |
| RN-102 | Los usuarios pueden marcar reportes como resueltos. |

### 2.12 Reglas Transversales de Fecha y Hora

| ID | Regla |
|---|---|
| RN-105 | **Toda fecha y hora del sistema se expresa en la zona horaria de Argentina (UTC-3)**, sin importar la zona configurada en el dispositivo o en el servidor. Aplica a la fecha programada de un viaje, horas de inicio y fin, marcas de tiempo de GPS, alertas e historial. Argentina no aplica horario de verano desde 2009, por lo que el offset es fijo. |
| RN-106 | El **almacenamiento y el transporte** siguen usando instantes absolutos en **UTC** (ISO 8601, `timestamptz` en PostgreSQL). La conversión a UTC-3 ocurre únicamente en los bordes: al presentar una fecha al usuario y al interpretar lo que el usuario elige en un selector de fecha/hora. Nunca se guardan horas "locales" sin zona. |
| RN-108 | **Alertas meteorológicas previas (SCRUM-27):** antes de iniciar, la pantalla del viaje muestra el pronóstico sobre la ruta planificada (origen, paradas, tramos intermedios y destino, hasta 8 puntos) para la hora estimada de paso por cada uno, y alerta si hay **lluvia** (probabilidad ≥ 50 %, precipitación ≥ 0,5 mm o código WMO de lluvia/tormenta) o **viento fuerte** (≥ 35 km/h o ráfagas ≥ 55 km/h). Proveedor: Open-Meteo (gratuito, sin API key, política de costo cero como OSM). Horizonte: 15 días; sin ruta o con el viaje finalizado no hay pronóstico. Endpoint `GET /api/viajes/{id}/clima`, cacheado 15 min. |
| RN-107 | La **fecha programada de un viaje debe ser futura** respecto del instante actual. Se valida en frontend (bloqueo del selector y del botón de crear) y en backend (schema Zod + servicio, error `FECHA_PASADA`). Ver RN-028. **Excepción — "Viaje YA":** con `inmediato: true` en `POST /api/viajes` no se envía `fechaProgramada` y el backend usa la hora actual; mandar ambas cosas es un 400. El viaje igual nace `planificado`, así el QR sigue vigente (RN-015) hasta que el líder lo inicia. Ver [[us-viaje-ya]]. |

#### Implementación de RN-105

- **Frontend:** `frontend/lib/tiempoArg.ts` centraliza la conversión. `formatearEnArg()` para mostrar;
  `aCamposArg()` / `desdeCamposArg()` para traducir entre el instante real y lo que muestra un
  date picker nativo (que siempre trabaja en la zona del dispositivo). Ningún componente debe
  llamar a `toLocaleString` directamente.
- **Backend:** `backend/src/config/timezone.ts` fija `TZ` del proceso para alinear los logs. La lógica
  de negocio compara instantes absolutos (`Date.now()`), por lo que es correcta en cualquier región
  de despliegue.

### 2.13 Reglas de Privacidad y Geolocalización

| ID | Regla |
|---|---|
| RN-110 | **Consentimiento informado de geolocalización.** Antes de publicar la posición de una persona al grupo, la app le explica qué se recolecta, con qué frecuencia, quiénes lo ven y cómo apagarlo, y la persona lo acepta explícitamente. El consentimiento se registra con la **versión del texto** aceptado (`consentimiento_ubicacion_at` + `consentimiento_ubicacion_version` en `usuario`): si se publica una versión nueva, el consentimiento anterior deja de estar vigente y hay que volver a pedirlo. **Sin consentimiento vigente el backend no publica la posición**, aunque el interruptor del viaje esté encendido y los permisos del sistema operativo estén otorgados. El punto de consentimiento coincide con el pedido de permiso de GPS (iniciar un viaje o unirse a uno en curso) y también está en la pantalla de privacidad del perfil. |
| RN-111 | **Compartir ubicación es por viaje y lo decide cada persona.** Cada integrante puede activar o desactivar el compartir en cada viaje (`privacidad_viaje`); el perfil guarda el valor por defecto con el que arrancan los viajes nuevos (`comparte_ubicacion_default`). Ni el líder ni ningún otro integrante pueden cambiar la decisión ajena (RN-030). **Con el compartir apagado:** los pings se siguen guardando en `registro_gps` (RN-038: cero pérdida — son datos propios y alimentan las métricas personales), pero **no** se publican en `ubicacion_viva`, no aparecen en el mapa grupal ni en el leaderboard (RN-071), y el **motor de eventos deja de evaluar a esa persona**: no se generan alertas de desvío, atraso ni posible incidente sobre ella, porque incluyen su ubicación exacta (RN-043). Apagarlo **borra la posición ya publicada** y emite `viaje:ubicacion_oculta` a la sala: dejar el último marcador congelado seguiría revelando dónde estaba al apagarlo. |
| RN-112 | **Registro de accesos a la posición.** Cada vez que alguien obtiene la posición de otra persona, queda constancia de quién accedió, a quién, en qué viaje y cuándo (`acceso_ubicacion`). La persona puede consultarlo por viaje y de forma global. Es un **agregado** por trío (viaje, observado, observador) con `primera_vez`, `ultima_vez` y `veces`, no un log por lectura: con 150–200 integrantes por viaje (RN-033) y el mapa refrescándose cada pocos segundos, un registro por consulta sería inviable e ilegible. La ventana de agregación es de **10 minutos**: releer la posición de la misma persona dentro de la ventana no genera una entrada nueva. Mirarse a uno mismo no cuenta como acceso. |
| RN-113 | **Revocación con efecto inmediato.** Revocar el consentimiento de geolocalización apaga el compartir en **todos** los viajes, borra las posiciones vivas ya publicadas y avisa a cada sala. Los recorridos históricos y las métricas propias se conservan: son datos de la persona, no del grupo. |
| RN-114 | **Minimización.** La posición en vivo solo la reciben los integrantes **confirmados** del viaje que la comparten; quien salió del viaje deja de recibirla (ver RN-037). El link de ruta compartida nunca incluye ubicación en vivo (RN-085). No se rastrean menores de edad: quedan fuera del alcance del sistema en esta etapa. |

#### Implementación

- **Backend:** módulo `backend/src/modules/privacidad/`. `privacidad.acceso.ts` expone el punto de
  control que consume `viajes.service.ts` (`estadoCompartirUbicacion`, `filtrarQuienesComparten`,
  `registrarAccesosUbicacion`). El gate se aplica en `assertPuedeEnviarGps`, que ya resuelve la
  autorización de los tres puntos de entrada de GPS (REST de a una, lote offline y socket), y en las
  dos lecturas (`listarUbicacionesVivas`, `obtenerLeaderboard`).
- **Tablas:** `privacidad_viaje` (PK `viaje_id` + `usuario_id`) y `acceso_ubicacion` (PK
  `viaje_id` + `observado_id` + `observador_id`), más tres columnas en `usuario`.
  `privacidad_viaje` va en tabla propia y no como columna de `viaje_integrante` porque el creador
  del viaje no siempre tiene fila ahí y también necesita poder apagar el compartir.
- **Frontend:** `frontend/lib/privacidadApi.ts`, `app/privacidad.tsx` (perfil) y
  `app/viaje/[viajeId]/privacidad.tsx` (por viaje). El texto del consentimiento vive en
  `components/AvisoUbicacion.tsx` para que el modal de permisos, el aviso al unirse y la pantalla de
  privacidad digan exactamente lo mismo — **si cambia ese texto, hay que subir
  `VERSION_CONSENTIMIENTO_UBICACION`** en `backend/src/modules/privacidad/privacidad.schemas.ts`.

### 2.14 Reglas de Administración de la Plataforma (Superadmin)

| ID | Regla |
|---|---|
| RN-120 | Existe un rol de **plataforma**, `superadmin` (`usuario.rol_sistema`, default `usuario`), **ortogonal a los roles de grupo**: no es un tercer rol dentro de un grupo y RN-011 sigue vigente (dentro de un grupo un superadmin es `lider` o `participante` como cualquiera). Habilita únicamente el backoffice `/api/admin`. El rol se resuelve desde la base en cada request (`requireUser` → `requireSuperadmin`), nunca desde un claim del token ni de algo que mande el cliente (RN-030). La app usa el rol solo para mostrar la entrada *Perfil → Administración*. |
| RN-121 | **Toda acción del backoffice queda auditada** en `auditoria_admin` (quién, qué acción, sobre qué entidad, cuándo y una foto mínima de lo afectado: email, nombre, motivo, resultado; en las acciones sobre viajes solo el estado, nunca nombre ni creador, y las filas anteriores a esta regla se leen con ese mismo filtro, RN-126). Es append-only y no tiene FK hacia la entidad afectada, para sobrevivir a su eliminación. Si se elimina la cuenta del superadmin que actuó, el registro queda con actor nulo. |
| RN-122 | Solo un superadmin otorga o quita el rol superadmin, y **nadie cambia su propio rol**; como consecuencia siempre queda al menos un superadmin. El primero se nombra desde la consola del servidor (`npm run admin:promover -- <email>`), y eso también se audita (actor nulo, `origen: cli`). |
| RN-123 | **Suspensión de cuenta.** Un superadmin puede suspender una cuenta indicando un motivo, y reactivarla. Mientras está suspendida, el backend responde `403 ACCOUNT_SUSPENDED` en toda la API y rechaza el handshake de Socket.io, aunque su token de Firebase siga vigente; además se cortan sus sockets abiertos y la cuenta se deshabilita en Firebase para que no pueda iniciar sesión. Los datos se conservan. Nadie puede suspenderse a sí mismo. |
| RN-124 | **Eliminación de cuenta** (definitiva, solo superadmin). No se permite si la persona está en un viaje `en_curso` (como creadora o integrante confirmada): primero hay que finalizarlo. Los grupos que lideraba pasan al integrante más antiguo, o se eliminan si no queda nadie (RN-013); los viajes que creó pasan al integrante más antiguo que participó (`confirmado` o `salido`), o se eliminan si no hubo nadie más, para no borrar el historial ajeno. Todo lo demás de la persona (GPS, métricas, paradas, amistades, checklist, gastos) se borra en cascada. La cuenta de Firebase se elimina **antes** que la fila local: al revés, un login en el medio la recrearía vacía. Nadie puede eliminarse a sí mismo. |
| RN-125 | **Gestión de grupos y viajes ajenos.** Un superadmin puede, sin ser líder ni creador: reasignar el líder de un grupo (sigue habiendo un único líder), quitar a un integrante (si es el líder aplica RN-013), eliminar un grupo, **forzar la finalización** de un viaje `en_curso` que quedó colgado (mismo cierre que hace el creador, con push a todos los confirmados) y eliminar un viaje `planificado` o `finalizado` (uno `en_curso` primero se finaliza). Como las fechas no se muestran (RN-126), el backend avisa con `posiblemente_colgado` los viajes que llevan más de **24 horas** en curso, y el filtro `en_curso` los ordena del más viejo al más nuevo. Es solo un aviso: no cierra el viaje ni bloquea el cierre forzado. |
| RN-126 | **El backoffice gestiona, no vigila.** Ningún endpoint de `/api/admin` expone posiciones GPS, ubicaciones vivas, recorridos ni velocidades: el superadmin no se salta las reglas de privacidad (RN-110 a RN-114) ni la exclusión de moto de toda comparación de velocidades (RN-070). Tampoco puede cambiar el consentimiento ni el compartir ubicación de otra persona (RN-111). **Los viajes se ven siempre anónimos:** solo código, actividad, grupal o individual, estado, cantidad de integrantes y el aviso de colgado (RN-125). Nunca nombre, creador, integrantes, grupos, ruta ni fechas, ni se puede buscar un viaje por nombre: no se pueden ver los datos de un viaje de una persona. De una persona solo se ven totales (viajes creados, participaciones). Las estadísticas de viajes se consultan en la reportería, agregadas (RN-127). |
| RN-132 | **Checklist sugerido editable.** El superadmin puede redefinir, para cada tipo de actividad, la lista de ítems que el sistema sugiere al armar el checklist de preparativos (RN-026): agregar, quitar y reordenar (entre 1 y 30 ítems de hasta 120 caracteres, sin repetidos), o volver a la lista por defecto del sistema. Mientras una actividad no se personalice rige la lista por defecto. El cambio **solo afecta a los checklists que se siembren después**: los ya armados son de cada persona y no se tocan. Guardar y restaurar se auditan (RN-121). |

#### Implementación

- **Backend:** módulo `backend/src/modules/admin/` montado en `/api/admin` con `requireUser` +
  `requireSuperadmin` (`src/middleware/requireSuperadmin.ts`). El superadmin actúa a través de
  estos endpoints y no con bypasses dentro de los servicios de dominio: así cada acción se audita
  en un solo lugar y los chequeos de RN-030 de cada módulo quedan intactos. La finalización forzada
  reutiliza el cierre de `ViajesService` (`finalizarComoAdmin`). El bloqueo de cuentas suspendidas
  vive en `requireUser` y `sockets/auth.ts`. Bootstrap: `src/scripts/promover-superadmin.ts`.
- **Tablas:** columnas `rol_sistema`, `suspendido_at`, `motivo_suspension` y `created_at` en
  `usuario`, y la tabla `auditoria_admin` (migración `20261016120000_superadmin`).
- **Contrato:** `backend/openapi/paths/admin.yaml` (tag `Admin`). `GET /api/usuarios/me` devuelve
  `rol_sistema`.
- **Checklist sugerido (RN-132):** `GET /api/admin/checklist`, `PUT` y `DELETE
  /api/admin/checklist/{tipoActividad}`. Tabla `checklist_actividad` (migración
  `20261106120000_checklist_actividad`); sin fila, `ChecklistService` usa
  `checklistDefaults.ts`.
- **Frontend:** `frontend/lib/adminApi.ts`, pantallas en `frontend/app/admin/` (panel, usuarios,
  grupos, viajes, checklist, auditoría) y componentes en `frontend/components/admin/AdminUI.tsx`.
  `AuthContext` expone `esSuperadmin` y cierra la sesión si el backend responde
  `ACCOUNT_SUSPENDED`.

#### Reportería de negocio (RN-127 a RN-131)

| ID | Regla |
|---|---|
| RN-127 | El superadmin tiene una sección de **reportería** para el PO y el directorio (`/api/admin/reportes/*`, *Perfil → Administración → Reportes*). Todos los reportes son **agregados**: ninguno devuelve nombres, emails, ids ni ningún dato que identifique a una persona. Cada reporte se puede exportar a CSV (separador `;`, coma decimal, UTF-8 con BOM, para Excel/Sheets en castellano). |
| RN-128 | Los períodos se piden como **fechas calendario de Argentina** (`desde`/`hasta`, ambas inclusive) y las series se agrupan en baldes de día, semana (arranca el lunes) o mes **en hora argentina** (RN-105): un viaje que sale un lunes a las 22:00 cuenta para el lunes. Sin fechas: últimos 90 días. Rango máximo: 2 años. Los KPIs se comparan contra el período anterior de igual duración. |
| RN-129 | La reportería **no expone velocidades de ninguna actividad** (RN-070): ni promedios por actividad ni comparaciones. Distancia y duración sí. Tampoco lee posiciones GPS, ubicaciones vivas ni recorridos (RN-126). Un test (`reportes.service.test.ts`) falla si el servicio llega a leer columnas de velocidad, posiciones o datos personales. |
| RN-130 | **k-anonimato en lugares.** Los rankings de destinos y orígenes salen de los nombres de las rutas planificadas y un lugar solo aparece si lo usaron al menos **3 creadores distintos**: un destino que eligió una sola persona la identificaría. |
| RN-131 | **Definiciones operativas** (ver tabla de abajo). Cualquier indicador nuevo tiene que sumar su definición acá antes de publicarse en un tablero. |

| Indicador | Definición |
|---|---|
| Usuario activo | Persona que **participó** en al menos un viaje que **arrancó** en el período: el creador, o un integrante `confirmado` o `salido`. |
| Alta | Cuenta creada en el período (`usuario.created_at`). Las cuentas existentes antes de la migración `20261016120000_superadmin` tienen esa fecha como alta, así que la retención de cohortes anteriores no es representativa. |
| Activación | De las altas del período, cuántas ya participaron en algún viaje, y la mediana de días entre el alta y el primer viaje. |
| Retención (cohortes) | Por mes de alta, proporción de la cohorte que participó en un viaje en el mes N desde el alta. Los meses que todavía no ocurrieron se informan vacíos, no en 0. |
| Km recorridos | Suma de `resumen_viaje.distancia_real_m` de los viajes iniciados: **un valor por viaje** (traza del creador), no por persona. |
| Viajes finalizados | En el panel: total histórico de viajes en estado `finalizado`, único contador de viajes (el desglose por estado se retiró porque casi todos terminan finalizados). En los reportes: viajes con `fecha_fin_real` en el período. |
| Tasa de realización | De los viajes con `fecha_programada` en el período y ya vencida, cuántos se iniciaron. Los que siguen `planificado` cuentan como "no realizados". |
| Falsas alarmas | Posibles incidentes del motor de eventos (`parada.tipo = incidente_detectado`) en los que la persona confirmó "estoy bien". Una tasa alta en una actividad indica que conviene subir su umbral de detección. |
| Aceptación de invitaciones | Aceptadas / (aceptadas + rechazadas); las pendientes no cuentan. En viajes, `confirmado`, `salido` y `ausente` cuentan como aceptadas (`ausente` aceptó aunque después no fue, RN-029c). |
| Canal de incorporación | `viaje_integrante.origen` de quienes se sumaron en el período, sin contar al creador (QR, link, grupo, amigo). |
| Ubicación apagada | Participaciones en las que la persona tenía el compartir apagado: preferencia del viaje o, si no eligió, su default del perfil (RN-111). |
| Gastos | Montos tal como se cargaron: la app no registra moneda. Promedio por persona = monto / personas que participaron en esos viajes. |

- **Backend:** módulo `backend/src/modules/reportes/` montado en `/api/admin/reportes` (antes que
  `/admin`) con `requireUser` + `requireSuperadmin`. El cálculo se hace en PostgreSQL con SQL
  agregado; `reportes.periodo.ts` resuelve períodos, baldes y la matriz de cohortes (funciones puras,
  con tests). Contrato: `backend/openapi/paths/reportes.yaml` (tag `Reportes`).
- **Frontend:** `app/admin/reportes.tsx`, secciones en `components/admin/reportes/Secciones.tsx`,
  gráficos en `components/admin/charts.tsx` (paleta validada para daltonismo, máximo 3 series por
  gráfico, vista de tabla en cada uno), tablas y CSV en `lib/reportesTablas.ts`.

---

## 3. Flujos del Sistema

### 3.1 Flujo de Registro y Autenticación

```
[Usuario no autenticado]
    │
    ├── Registrarse ──► Ingresar nombre, apellido, teléfono, email, contraseña
    │                       │
    │                       ├── Validar email único
    │                       ├── Validar formato teléfono (Argentina)
    │                       ├── Validar contraseña ≥ 8 caracteres
    │                       └── Enviar email de confirmación
    │                              │
    │                              └── Confirmar email ──► Cuenta activa
    │
    ├── Iniciar sesión ──► Email + Contraseña
    │                       │
    │                       ├── [OK] ──► Token de sesión generado ──► Pantalla principal
    │                       └── [Error] ──► Mensaje de error
    │                              └── 5 intentos fallidos ──► Bloqueo temporal
    │
    └── Recuperar contraseña ──► Ingresar email
                                   │
                                   └── Link enviado (expira 24hs) ──► Reset ──► Sesiones previas invalidadas
```

### 3.2 Flujo de Gestión de Grupos

```
[Usuario autenticado]
    │
    ├── Crear grupo ──► Nombre + foto + invitar usuarios
    │                     │
    │                     ├── Creador = Líder automático
    │                     ├── Buscar usuarios por nombre/email
    │                     └── Asignar roles (líder/participante)
    │
    ├── Invitar personas al grupo
    │     ├── Por link de invitación al grupo
    │     └── Desde otro grupo existente (RN-018) ──► Bandeja de invitaciones
    │           └── Invitado acepta o rechaza membresía
    │
    ├── Gestionar amigos ──► Buscar, solicitud de amistad, eliminar
    │
    ├── Ver miembros ──► Lista con foto y rol
    │
    └── Abandonar/eliminar grupo
          ├── Si líder abandona ──► Transferir rol o eliminar grupo
          └── Confirmación requerida
```

### 3.3 Flujo de Creación de Viaje (Pre-viaje)

```
[Creador del viaje]
    │
    ├── Crear viaje
    │     ├── ¿Individual o grupal? (RN-020)
    │     ├── Tipo de actividad (moto / auto / bici / running / trekking / otro)
    │     ├── Fecha y hora de salida
    │     ├── Modo de viaje (competitivo / recreativo / entrenamiento)
    │     └── [Si grupal] Seleccionar 1+ grupos (solo donde soy miembro) ──► RN-028/029
    │
    ├── Crear ruta
    │     ├── Marcar origen en mapa (Google Maps)
    │     ├── Marcar destino
    │     ├── Agregar paradas intermedias (reordenables)
    │     │     └── Categorizar: combustible / descanso / gastronomía / sanitario / otro
    │     └── Trazado automático de ruta entre puntos
    │
    ├── Configurar parámetros
    │     ├── Velocidad promedio esperada (default según actividad)
    │     ├── Distancia máxima de separación del grupo
    │     └── Tiempo de tolerancia de atraso
    │
    ├── Estimación de tiempos ──► Cálculo automático según actividad + paradas
    │
    ├── Checklist de preparativos
    │     ├── Ítems sugeridos según actividad
    │     └── Ítems personalizados
    │
    ├── Consultar alertas meteorológicas para la zona de la ruta
    │
    ├── [Deseable] Solicitar itinerario IA
    │     └── Origen + destino + duración ──► IA sugiere paradas, horarios, gastronomía
    │                                           └── Importar como paradas del viaje
    │
    └── Invitar personas al viaje
          ├── Por QR (RN-015/016) ──► Unión directa al viaje
          ├── Por link al viaje
          └── Por grupos seleccionados (RN-028) ──► Invitación con confirmación (RN-029)
                └── Creador del viaje ve confirmados/rechazados/pendientes
```

### 3.4 Flujo de Ejecución del Viaje (Tiempo Real)

```
[Líder] ──► Iniciar viaje (play)
    │
    ├── Notificación de inicio a todos los integrantes
    ├── Activar tracking GPS cada 5 segundos
    └── Mostrar mapa con:
          ├── Ruta planificada
          ├── Marcadores de integrantes (con foto)
          ├── Tiempo transcurrido y distancia recorrida
          └── Paradas planificadas con íconos por categoría

    [Durante el viaje - Acciones de integrantes]
    │
    ├── Iniciar parada voluntaria
    │     ├── Estado cambia a "detenido" en mapa
    │     ├── Notificación a todos los integrantes del viaje
    │     ├── Elección de categoría de la parada (RN-022)
    │     └── Registro de hora y ubicación
    │
    ├── Finalizar parada
    │     ├── Estado vuelve a "en movimiento"
    │     └── Se calcula tiempo total de parada
    │
    └── Solicitar parada al grupo
          └── Líder aprueba o rechaza

    [Durante el viaje - Motor de eventos automático]
    │
    ├── Detección de desvío
    │     └── Integrante > X metros fuera de ruta
    │           ├── Push al líder con nombre del integrante
    │           └── Marcador de desvío en mapa
    │
    ├── Detección de atraso
    │     └── Posición vs. bloque principal > tolerancia configurada
    │           ├── Push al líder
    │           └── Distancia de separación visible en tiempo real
    │
    └── Detección de posible incidente
          └── Detenido > N minutos SIN parada manual registrada
                ├── Alerta "posible incidente" a líder y grupo
                ├── Marcador diferenciado en mapa
                └── Integrante puede confirmar "estoy bien" ──► Cancela alerta

    [Alertas del líder]
    │
    ├── Crear alerta manual (tipo + mensaje) ──► Push a todos
    ├── Pausar/cancelar alertas activas
    └── Visualizar panel de alertas en tiempo real

    [Modo offline]
    │
    └── Sin señal ──► GPS almacenado localmente
                        └── Reconexión ──► Sincronización automática y transparente
```

### 3.5 Flujo de Finalización del Viaje

```
[Líder] ──► Finalizar viaje
    │
    ├── Se detiene tracking de todos los integrantes
    │
    ├── Generación automática de métricas (mismas tablas para todo E06)
    │     ├── Individuales: distancia, tiempo movimiento, vel. promedio/máxima
    │     ├── Grupales: desglose por integrante (hechos, no podio)
    │     └── Resumen: totales del viaje + métricas de quien consulta
    │
    ├── Ranking / recap del viaje (RN-063): cards + tabs sobre esas métricas
    │     └── EXCEPCIÓN: moto, auto e individual no tienen ranking
    │
    ├── [Avanzado] Wrapped de período (RN-064, mensual/anual)
    │     └── Compartible como imagen — no es el recap de un viaje
    │
    ├── [Avanzado] Métricas de entrenamiento
    │     └── Comparación con promedio de últimas N salidas (mejora/empeora)
    │
    └── Viaje queda en historial consultable con mapa del recorrido
```

### 3.6 Flujo de Ghost Tracking

```
[Usuario] ──► Seleccionar recorrido histórico como referencia
    │           ├── Viaje propio del historial
    │           └── Ruta compartida por otro usuario
    │
    └── Iniciar viaje con ghost
          ├── Marcador fantasma se mueve en tiempo real según recorrido histórico
          ├── Indicador: "vas adelante" / "vas atrás" del fantasma
          └── Se puede pausar o quitar el fantasma en cualquier momento
```

### 3.7 Flujo de Red Social de Recorridos

```
[Usuario] ──► Publicar recorrido de su historial
    │           ├── Muestra: mapa, tipo de actividad, distancia, tiempo
    │           └── Puede despublicar en cualquier momento
    │
    ├── Explorar recorridos publicados
    │     ├── Filtrar por tipo de actividad y zona geográfica (cerca mío / lugar + radio)
    │     ├── Ver autor, distancia, actividad, valoración
    │     └── Importar como base para viaje nuevo (plantilla en "Mis rutas" → Crear viaje)
    │
    └── Valorar recorrido
          ├── "Recomiendo" / "No recomiendo" (una vez por recorrido, definitiva; no el propio)
          └── Se muestra porcentaje de recomendaciones
```

---

## 4. Modelo de Datos — Entidades Principales

```
Usuario
├── id (PK)
├── nombre
├── apellido
├── email (unique)
├── teléfono
├── password_hash
├── foto_perfil
├── actividad_preferida (enum: moto, auto, bici, running, trekking, otro)
├── consentimiento_ubicacion_at (timestamp, nullable)       ← RN-110
├── consentimiento_ubicacion_version (text, nullable)       ← RN-110
├── comparte_ubicacion_default (bool, default true)         ← RN-111
├── visibilidad_logros (enum: todos, amigos, solo_yo)       ← RN-077
├── rol_sistema (enum: usuario, superadmin)                 ← RN-120
├── suspendido_at (timestamp, nullable)                     ← RN-123
├── motivo_suspension (text, nullable)                      ← RN-123
└── created_at

AuditoriaAdmin                                              ← RN-121
├── id (PK)
├── actor_id (FK → Usuario, nullable, SET NULL)
├── accion (p. ej. usuario.suspender, viaje.finalizar, checklist.definir_sugeridos)
├── entidad (usuario | grupo | viaje | checklist)
├── entidad_id (uuid, sin FK: sobrevive a la eliminación)
├── detalle (json)
└── created_at

PrivacidadViaje                                             ← RN-111
├── viaje_id (FK, PK compuesta)
├── usuario_id (FK, PK compuesta)
├── comparte_ubicacion (bool, default true)
└── updated_at

AccesoUbicacion                                             ← RN-112
├── viaje_id (FK, PK compuesta)
├── observado_id (FK → Usuario, PK compuesta)   # dueño de la posición
├── observador_id (FK → Usuario, PK compuesta)  # quien la vio
├── primera_vez
├── ultima_vez
└── veces (int)

Grupo
├── id (PK)
├── nombre
├── foto
├── líder_id (FK → Usuario)
└── created_at

GrupoMiembro
├── grupo_id (FK)
├── usuario_id (FK)
├── rol (enum: líder, participante)
└── joined_at

GrupoInvitacion
├── id (PK)
├── grupo_id (FK → grupo destino)
├── usuario_id (FK → invitado)
├── invitado_por_id (FK)
├── grupo_origen_id (FK → grupo origen, nullable)
├── estado (enum: pendiente, aceptada, rechazada)
└── created_at

Amistad
├── usuario_id (FK)
├── amigo_id (FK)
├── estado (enum: pendiente, aceptada)
└── created_at

Viaje
├── id (PK)
├── creador_id (FK → Usuario) — líder del viaje (RN-030)
├── codigo_invitacion (string, unique) — código corto para sumarse sin QR; lo genera la base (RN-015)
├── nombre (string, 1–100) — identificador principal mostrado en listas e invitaciones; nullable en viajes antiguos
├── es_grupal (boolean)
├── tipo_actividad (enum: moto, auto, bici, running, trekking, otro)
├── modo (enum: recreativo, competitivo, entrenamiento)
├── fecha_salida
├── estado (enum: planificado, en_curso, finalizado)
├── velocidad_esperada
├── distancia_max_separacion
├── tolerancia_atraso
├── created_at
├── started_at
└── finished_at

Ruta
├── id (PK)
├── viaje_id (FK)
├── origen (point geoespacial)
├── destino (point geoespacial)
├── geometria_trazado (linestring PostGIS)
└── tiempo_estimado

ParadaIntermedia
├── id (PK)
├── ruta_id (FK)
├── orden (int)
├── ubicacion (point)
├── categoria (enum: accidente, combustible, descanso, gastronomía, punto_control, sanitario, otro)
├── nombre
└── tiempo_estimado_parada

ViajeIntegrante
├── viaje_id (FK)
├── usuario_id (FK)
├── estado (enum: pendiente, confirmado, rechazado, salido, ausente) — RN-029 / RN-029c; QR usa confirmado directo (RN-016)
├── check_in_at (nullable) — RN-029b: se sumó al viaje en curso; sin esto no hay tracking ni alertas en vivo
├── fecha_salida (nullable) — cuándo abandonó en curso (`salido`)
└── origen (enum: creador, qr, link, grupo, amigo) — trazabilidad del modo de invitación (amigo = invitado individualmente por amistad, RN-028)

RegistroGPS
├── id (PK)
├── viaje_id (FK)
├── usuario_id (FK)
├── ubicacion (point)
├── timestamp
├── velocidad
├── synced (boolean — para offline)
└── source (enum: live, offline_sync)

Parada
├── id (PK)
├── viaje_id (FK)
├── usuario_id (FK)
├── ubicacion (point)
├── tipo (enum: voluntaria, incidente_detectado)
├── categoria (enum CategoriaParada, nullable)
├── inicio
├── fin (nullable)
└── confirmado_bien (boolean, nullable)

SolicitudParada
├── id (PK)
├── viaje_id (FK)
├── solicitante_id (FK)
├── ubicacion (point, nullable)
├── motivo (nullable)
├── estado (enum: pendiente, aprobada, rechazada, cancelada)
├── resuelta_por_id (FK, nullable — el líder que respondió)
├── created_at
└── resolved_at (nullable)

Alerta
├── id (PK)
├── viaje_id (FK)
├── creada_por_id (FK, nullable)
├── tipo (enum: parada, combustible, desvio, peligro, informacion)   ← tema de la alerta
├── origen (enum: lider, sistema)                                     ← quién la generó
├── ubicacion (point, nullable)
├── mensaje
├── estado (enum: activa, pausada, cancelada, resuelta)
├── created_at
└── resolved_at

MetricaViaje
├── id (PK)
├── viaje_id (FK)
├── usuario_id (FK)
├── distancia_total
├── tiempo_total
├── tiempo_movimiento
├── tiempo_detenido
├── velocidad_promedio
└── created_at

ChecklistItem
├── id (PK)
├── viaje_id (FK)
├── usuario_id (FK)          ← dueño de la fila: el checklist es personal
├── origen_item_id (FK, null) ← si es copia de un ítem base, apunta al original del creador
├── texto (varchar 120)
├── origen (sugerido|lider|personal)
├── completado (boolean)
├── orden (int)
├── created_at
└── updated_at

    UNIQUE (viaje_id, usuario_id, texto)   ← siembra e importación idempotentes
    FK origen_item_id ON DELETE CASCADE    ← el creador borra el ítem base y caen las copias

ChecklistActividad                                          ← RN-132
├── id (PK)
├── tipo_actividad (enum, unique)   ← una fila por actividad personalizada
├── items (text[])                  ← sugeridos en el orden de siembra
└── updated_at

RecorridoPublicado                                          ← RN-081
├── id (PK)
├── viaje_id (FK)
├── usuario_id (FK)
├── nombre (nullable)
├── tipo_actividad
├── distancia_m
├── tiempo_seg (en movimiento; nunca velocidad, RN-070)
├── segmentos (json [lat, lng][][], snapshot de la traza)
├── inicio_lat / inicio_lng (nullable; filtro por zona, SCRUM-62)
├── comentario (varchar 280, nullable; nota del autor)
├── checklist (text[]; vacío si el autor no lo compartió)
├── publicado_at
└── activo (boolean)

    UNIQUE (viaje_id, usuario_id)

ValoracionRecorrido                                         ← RN-082 / RN-083
├── recorrido_publicado_id (FK, PK compuesta)
├── usuario_id (FK, PK compuesta)
├── recomiendo (boolean)
└── created_at

RutaPlantilla                                               ← RN-084 / RN-086
├── id (PK)
├── usuario_id (FK)
├── ruta_compartida_id (FK, nullable)      # origen: link de ruta
├── recorrido_publicado_id (FK, nullable, SET NULL)  # origen: recorrido de la comunidad
├── nombre, tipo_actividad, origen, destino, linestring_geojson
├── distancia_planeada_m, tiempo_estimado_seg
├── checklist (text[]; vacío si no se guardó)
└── created_at

    UNIQUE (usuario_id, ruta_compartida_id)
    UNIQUE (usuario_id, recorrido_publicado_id)

Insignia
├── id (PK)
├── codigo (unique)
├── nombre
├── descripcion (nullable)
├── icono
├── rareza (enum: comun, rara, epica, legendaria)           ← RN-078
├── criterio_distancia_m (nullable)
├── criterio_duracion_seg (nullable)
├── criterio_actividad (nullable)
├── activa
└── created_at

UsuarioInsignia
├── id (PK)
├── usuario_id (FK)
├── insignia_id (FK)
├── viaje_id (FK, nullable)
└── obtenida_at

    UNIQUE (usuario_id, insignia_id)

RachaActividad
├── usuario_id (PK, FK)
├── semanas_consecutivas (int)
├── inicio_racha
├── ultima_actividad
└── updated_at
```

---

## 5. Estados y Transiciones

### 5.1 Estados de un Viaje

```
[planificado] ──► [en_curso] ──► [finalizado]
                      │
                      └── (solo líder puede iniciar/finalizar)
```

### 5.2 Estados de un Integrante durante el viaje

```
[en_movimiento] ──► [detenido_voluntario] ──► [en_movimiento]
       │                                            ▲
       └──► [posible_incidente] ────────────────────┘
                    │                    (confirma "estoy bien")
                    └── (no registró parada manual + detenido > N min)
```

### 5.3 Estados de una Alerta

```
[activa] ──► [pausada] ──► [activa]
   │              │
   ├── [cancelada] ◄──┘
   └── [resuelta]
```

### 5.4 Estados de Confirmación de Asistencia y Presencia (RN-029, RN-029b, RN-029c)

```
                 (planificado)                       (en_curso)
[pendiente] ──► [confirmado] ──"Me sumo"──► [confirmado + check_in_at] ──salir──► [salido]
      │              │   │                                (trackeado, evaluado,
      │              │   └──"No voy a ir" / al finalizar sin check-in──► [ausente]
      │              └──"Ya no voy" antes del inicio──► [rechazado]
      └──► [rechazado]
```

- Solo `confirmado + check_in_at` (o el líder) envía GPS, lo evalúa el motor y recibe alertas en vivo.
- El líder hace check-in implícito al iniciar; puede ceder el viaje (RN-029d) y, para bajarse, tiene que cederlo.

---

## 6. Restricciones Técnicas y No Funcionales

### 6.1 Rendimiento

- Latencia de actualización de ubicación: **≤ 10 segundos**.
- Frecuencia de recolección GPS: **cada 5 segundos**.
- Soporte de usuarios concurrentes por viaje: **150–200**.
- Estimación de volumen: 100 usuarios × 4 horas = **280.000 inserciones de coordenadas** por sesión.

### 6.2 Disponibilidad

- Uptime objetivo del backend: **99.5%** (máximo 1.83 días de inactividad anual).
- La app complementa con capacidad offline: la operación en campo no se detiene aunque el servidor tenga caída momentánea.

### 6.3 Disponibilidad Offline

- En zonas sin conectividad, los datos GPS se almacenan localmente.
- La sincronización es **automática y transparente** al reconectar.
- **Cero pérdida de registros** durante brechas de conectividad.

### 6.4 Usabilidad

- Interfaz diseñada para uso outdoor: botones grandes, brillo alto, texto legible.
- Interfaz adaptativa por tipo de actividad (moto/auto = pantalla completa; trekking = háptica).
- Se muestra lo mínimo necesario en pantalla.

### 6.5 Arquitectura

- **API-First** con API RESTful documentada bajo OpenAPI.
- Mapas: **Google Maps Platform** (mapa nativo, Places, Routes) con servicios OpenStreetMap como respaldo automático. Ver [[adr-mapas-google]].
- Base de datos: **Supabase** (PostgreSQL + PostGIS administrado, extensión PostGIS habilitada).
- Tiempo real: **WebSockets** vía **Socket.io**.
- Hosting: **VPS** (DigitalOcean / Donweb) con CI/CD.
- Autenticación: **Firebase Authentication**.

### 6.6 Privacidad

Detalle completo en **2.13 Reglas de Privacidad y Geolocalización** (RN-110 a RN-114).

- El usuario puede activar/desactivar compartir ubicación por viaje (RN-111).
- Se solicita permiso GPS con explicación clara del uso, y el consentimiento queda
  registrado con la versión del texto aceptado (RN-110).
- El usuario puede ver quiénes acceden a su posición (RN-112).
- El consentimiento se puede revocar, con efecto inmediato sobre todos los viajes (RN-113).
- Minimización: la posición en vivo solo llega a integrantes confirmados del viaje (RN-114).
- No se rastrean menores de edad.

---

## 7. Tiers de Funcionalidad

### Tier Core (MVP)

Las funcionalidades sin las cuales la app **no cumple su propósito mínimo viable**:

1. **E01** — Gestión de usuarios y autenticación (registro, login, perfil, privacidad)
2. **E02** — Gestión de grupos (crear, invitar, confirmar asistencia)
3. **E03** — Planificación de viajes y rutas (crear viaje, definir ruta, paradas, checklist). **No** incluye compartir ruta a terceros fuera del grupo (eso es E10 / puente; ver abajo).
4. **E04** — Ejecución y seguimiento en tiempo real (tracking GPS, detección de desvíos/atrasos/incidentes, offline)
5. **E05** — Alertas y comunicación operativa (alertas manuales/automáticas, interfaz adaptativa)

### Tier Avanzado

Funcionalidades de alto valor que **diferencian al producto** de la competencia:

6. **E06** — Cierre, métricas y estadísticas (resumen de viaje, ranking/recap, wrapped, entrenamiento). Recap de un viaje: [`us-ranking-viaje.md`](us-ranking-viaje.md).
7. **E07** — Ghost tracking y competición (fantasma, modo competitivo/recreativo)

### Tier Deseable

Funcionalidades para **fases futuras**:

8. **E08** — Gamificación con hitos, POIs, gastos colaborativos, wearables, itinerario IA
9. **E09** — Gamificación extendida (insignias, rachas, tabla global). **Recortes implementados:** premios por recorridos completados (insignias otorgadas automáticamente, RN-074) — [`us-insignias.md`](us-insignias.md); recompensas por rachas de actividad (RN-075) — [`us-rachas.md`](us-rachas.md); tabla de posiciones global por actividad (RN-076) — [`us-tabla-posiciones.md`](us-tabla-posiciones.md).
10. **E10** — Red social de recorridos (publicar, explorar, valorar). **Puente E03→E10:** compartir ruta planificada por link + plantilla en perfil + reutilizar al crear viaje — [`us-compartir-ruta.md`](us-compartir-ruta.md). No mezclar con QR RN-015. **Implementadas:** publicar recorrido (SCRUM-61) — [`us-publicar-recorrido.md`](us-publicar-recorrido.md); explorar por actividad y zona e importar como base de un viaje (SCRUM-62) — [`us-explorar-recorridos.md`](us-explorar-recorridos.md); valorar Recomiendo/No recomiendo (SCRUM-63) — [`us-valorar-recorridos.md`](us-valorar-recorridos.md).
11. **E11** — Asistencia inteligente IA (recomendación climática, itinerarios)
12. **E12** — Información de ruta en tiempo real (cortes, radares, reportes comunitarios)

---

## 8. Parámetros por Defecto según Tipo de Actividad

Valores por defecto asignados al crear el viaje (RN-021, SCRUM-25). Unidades: velocidad en **km/h**, separación en **metros**.

| Parámetro | Moto | Auto | Bici | Running | Trekking | Otro |
|---|---|---|---|---|---|---|
| Velocidad máxima esperada (`velocidad_esperada`) | 120 km/h | 100 km/h | 35 km/h | 15 km/h | 5 km/h | 20 km/h |
| Distancia máx. separación grupo (`distancia_max_separacion`) | 1000 m (1 km) | 1000 m (1 km) | 300 m | 100 m | 50 m | 200 m |
| Tolerancia de atraso (`tolerancia_atraso_min`, RN-025) | 10 min | 10 min | 5 min | 3 min | 3 min | 5 min |
| Interfaz | Pantalla completa, alto contraste, botones grandes | Pantalla completa, alto contraste, botones grandes | Estándar outdoor | Háptica + visual | Háptica + visual | Estándar outdoor |
| Ranking competitivo | **PROHIBIDO** | **PROHIBIDO** | Sí | Sí | Sí | Sí |
| Tabla de posiciones global | **EXCLUIDA** | **EXCLUIDA** | Sí | Sí | Sí | Sí |
| Perfil de ruta (Google `DRIVE`/`BICYCLE`/`WALK`, OSRM de respaldo) | `driving` | `driving` | `cycling` | `walking` | `walking` | `walking` |

Implementación: el backend aplica estos defaults en `POST /api/viajes` según `tipo_actividad`; el líder puede sobreescribir los tres parámetros al crear o con `PATCH` (RN-025, SCRUM-26). La tolerancia vive en `motorEventos.config.ts` y `activityDefaults.ts` la reexpone, así el motor y la API leen la misma tabla.

> **Nota crítica**: La exclusión de moto y auto de rankings y tablas competitivas es una decisión de seguridad vial irrevocable. Nunca se debe incentivar la competencia de velocidad en vehículos motorizados.

---

## 9. Mapa de Procesos

### Procesos Estratégicos
- Definición de parámetros por actividad
- Gestión de privacidad y consentimiento de ubicación
- Planificación y mejora continua

### Procesos Operativos
- Sincronización de ubicación geoespacial
- Gestión de alertas y monitoreo
- Comunicación operativa
- Configuración de rutas
- Ejecución de actividades
- Resumen de actividad

### Procesos de Apoyo
- Registro y gestión de perfiles
- Gestión de amigos/contactos

---

## 10. Glosario

| Término | Definición |
|---|---|
| **Bloque principal** | El subconjunto mayoritario de integrantes del grupo que viajan juntos. Se usa como referencia para calcular atrasos. |
| **Posta** | Parada intermedia planificada dentro de una ruta. |
| **Ghost / Fantasma** | Marcador virtual que reproduce un recorrido histórico sobre el mapa en tiempo real para comparar rendimiento. |
| **Motor de eventos** | Lógica backend autónoma que analiza las coordenadas GPS en tiempo real y detecta desvíos, atrasos y detenciones sospechosas. |
| **Wrapped** | Resumen visual de estadísticas de un **período** (mensual/anual, RN-064). No es el recap de un viaje. |
| **Recap de viaje** | Cards post-cierre del **mismo** viaje grupal (RN-063): puestos por distancia, ritmo o tiempo en movimiento. Fuera de moto. |
| **Wearable** | Dispositivo electrónico portátil (reloj inteligente, pulsera de actividad) con sensores de movimiento y conectividad. |
| **QR de invitación** | Código QR único generado por viaje que permite unirse **al viaje** escaneándolo (RN-015/016). Expira al iniciar el viaje. No agrega al usuario a ningún grupo. |
| **Link de ruta / plantilla** | Link con token opaco que comparte el **snapshot planificado** de una ruta (geometría + postas) para que otro usuario lo guarde en su perfil y lo use como base de un viaje propio. **No** une al viaje fuente ni expira al iniciar (contraste con QR). Backlog: [`us-compartir-ruta.md`](us-compartir-ruta.md) (E10). |
| **Modo competitivo** | Perfil de viaje que activa leaderboard dinámico y métricas comparativas entre integrantes. |
| **Modo recreativo** | Perfil de viaje que desactiva rankings y comparaciones, manteniendo solo navegación y alertas de seguridad. |
| **Freemium** | Modelo de negocio donde funcionalidades básicas son gratuitas y las avanzadas requieren suscripción. |

---

## 11. Metodología de Desarrollo

- **Framework**: Scrum con sprints de 15 días.
- **Roles**: PO (Manuel Viale), SM (Pedro Gabrielli), Dev Team (Peñafort, Giorda, Casoria, Ferraro).
- **Estimación**: Poker Planning con serie Fibonacci (1, 2, 3, 5, 8).
- **Gestión**: Jira.
- **Versionado**: GitHub con ramas main → dev → feature.
- **Revisión**: Code review obligatorio por pares antes de merge.
- **DoR**: US cargada en Jira + criterios de aceptación + estimación.
- **DoD**: Code review + estándares de código + tests unitarios + tests de integración + criterios de aceptación cumplidos + aprobación del PO.
- **Comunicación**: Discord (técnica), WhatsApp (informal), GitHub (código).

---

## 12. Competencia y Diferenciación

| Sistema | Foco principal | ¿Coordinación grupal en tiempo real? |
|---|---|---|
| Strava | Rendimiento deportivo individual | No |
| Komoot | Planificación de rutas y navegación | No |
| REVER | Rutas para motociclismo | No |
| Garmin GroupTrack | Tracking grupal | Parcial (requiere hardware Garmin) |
| Google Maps | Navegación punto a punto | No |
| Life360 | Seguridad y seguimiento familiar | No |
| **Mesh** | **Coordinación grupal en actividades en movimiento** | **Sí — foco central del producto** |

---

*Este documento debe actualizarse con cada Sprint Review. Ante cualquier duda sobre una regla de negocio, el Product Owner (Manuel Viale) tiene la última palabra.*