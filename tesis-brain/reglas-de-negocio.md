# Mesh — Especificación Completa del Sistema

> **Documento de referencia para el equipo de desarrollo y agentes de IA**
> Proyecto Final 2026 · UTN FRC · Grupo 4 · Curso 5K1
> Versión: 1.0 · Fecha: 08/05/2026

---

## 1. ¿Qué es Mesh?

Mesh es una aplicación móvil diseñada para la **coordinación grupal en tiempo real** durante actividades deportivas y recreativas en movimiento: motociclismo, ciclismo, running, trekking y rollers.

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
| RN-017 | Las solicitudes de amistad requieren aceptación del receptor. |
| RN-018 | Invitar personas **al grupo** crea registros en `grupo_invitacion` con estado `pendiente`. Fuentes válidas (SCRUM-18): amigos aceptados, búsqueda global de usuarios registrados, o co-miembros de otro grupo del líder. Solo el **líder** del grupo destino puede invitar; se excluye al invitador y a quienes ya son miembros o tienen invitación pendiente. `grupo_origen_id` es nullable cuando la invitación no proviene de otro grupo. **Flujo distinto** de invitar grupos a un viaje (RN-028/RN-029). |
| RN-019 | El invitado a un grupo puede aceptar o rechazar una invitación pendiente (SCRUM-17). Aceptar la marca como `aceptada` y agrega al usuario como `participante` del grupo; rechazar la marca como `rechazada` sin modificar membresía. |
| RN-027 | Los grupos son **listas persistentes de contactos** para facilitar invitaciones masivas. La membresía de un grupo es **independiente** de la participación en un viaje: un usuario puede estar en un viaje sin pertenecer al grupo que originó la invitación, y viceversa. |

**Contrato API MVP (SCRUM-11 / SCRUM-13 / SCRUM-14 / SCRUM-17 / SCRUM-18):** OpenAPI en `backend/openapi/grupos.yaml` y `backend/openapi/amistades.yaml`. Endpoints destacados: `POST /api/usuarios/sync`, `POST /api/grupos`, `GET /api/grupos/:grupoId`, `GET /api/grupos/:grupoId/amigos-para-invitar`, `GET /api/grupos/:grupoId/buscar-usuarios`, `POST /api/grupos/:grupoId/invitar-usuarios`, `GET /api/grupos/invitaciones/pendientes`, `POST /api/grupos/invitaciones/:invitacionId/responder`, `GET /api/amistades`, `GET /api/amistades/buscar`, `DELETE /api/amistades/:usuarioId`, `POST /api/amistades/solicitar`, `POST /api/amistades/solicitudes/:id/responder`. Auth: Bearer Firebase ID token.

**Contrato API viajes (RN-015–029):** OpenAPI en `backend/openapi/viajes-qr.yaml`. Endpoints destacados: `POST /api/viajes`, `GET /api/viajes/planificados`, `GET /api/viajes/invitaciones/pendientes`, `POST /api/viajes/:viajeId/invitacion/responder`, `GET /api/viajes/:viajeId/participantes`, `POST /api/viajes/:viajeId/unirse-qr`.

### 2.3 Reglas de Viajes y Rutas

| ID | Regla |
|---|---|
| RN-015 | El código QR de invitación es único por viaje y expira al iniciar el viaje. |
| RN-016 | El escaneo del QR agrega al usuario **al viaje** directamente, sin aprobación manual. No modifica la membresía de ningún grupo. |
| RN-020 | Un viaje puede ser **individual** (sin invitados iniciales) o **grupal** (con uno o más participantes). |
| RN-028 | Al crear un viaje grupal, el creador puede seleccionar **uno o más grupos** de los que es **miembro** para invitar en bloque a sus integrantes. Si un usuario pertenece a varios grupos seleccionados, recibe **una sola invitación** al viaje. |
| RN-029 | Las invitaciones al viaje originadas por selección de grupos requieren **confirmación** del invitado (aceptar/rechazar asistencia). El creador del viaje ve la lista de confirmados y rechazados. Distinto de RN-016 (QR al viaje) y de RN-018 (membresía de grupo). |
| RN-021 | Los tipos de actividad disponibles son: **moto**, **bici**, **running**, **trekking**. Cada uno tiene parámetros por defecto diferentes. |
| RN-022 | Las categorías de parada intermedia son: **combustible**, **descanso**, **gastronomía**, **sanitario**, **otro**. |
| RN-023 | La estimación de tiempos depende del tipo de actividad seleccionado y la distancia, más el tiempo configurable de cada parada. |
| RN-024 | Las rutas se trazan sobre OpenStreetMap; las paradas son reordenables. |
| RN-025 | Los parámetros configurables por el líder son: velocidad promedio esperada, distancia máxima de separación del grupo y tiempo de tolerancia de atraso. |
| RN-026 | El checklist de preparativos sugiere ítems según tipo de actividad y permite agregar personalizados. Los checklists son reutilizables. |

### 2.4 Reglas de Ejecución en Tiempo Real

| ID | Regla |
|---|---|
| RN-030 | Solo el **creador del viaje** (`creador_id`) puede iniciar y finalizar un viaje. Esto es independiente del rol de líder en cualquier grupo. |
| RN-031 | Al iniciar, el sistema recolecta ubicación GPS cada **5 segundos**. |
| RN-032 | La latencia máxima aceptable de actualización de posición en el mapa es **10 segundos**. |
| RN-033 | El sistema soporta hasta **150–200 usuarios concurrentes** por viaje. |
| RN-034 | **Detección de desvío**: se dispara alerta cuando un integrante supera X metros fuera de la ruta planificada (X es configurable). |
| RN-035 | **Detección de atraso**: se calcula comparando la posición del integrante con el bloque principal del grupo. Se dispara según la tolerancia configurada. |
| RN-036 | **Detección de incidente vs. parada voluntaria**: si un usuario se detiene por más de N minutos SIN registrar parada manual, se genera alerta de "posible incidente". El integrante puede confirmar que está bien para cancelarla. |
| RN-037 | Los estados visibles de un integrante en el mapa son: **en movimiento**, **detenido-voluntario**, **posible incidente**. |
| RN-038 | En modo offline, los datos GPS se almacenan localmente y se sincronizan automáticamente al reconectar. No se pierden registros. |

### 2.5 Reglas de Alertas

| ID | Regla |
|---|---|
| RN-040 | Las alertas se envían como notificación push a todos los integrantes del viaje. |
| RN-041 | El líder puede crear alertas manuales con tipo y mensaje personalizado. |
| RN-042 | Las alertas activas pueden pausarse o cancelarse individualmente por el líder. |
| RN-043 | Las alertas automáticas de incidente incluyen la ubicación exacta del evento. |
| RN-044 | Un integrante puede solicitar una parada al grupo; el líder puede aprobarla o rechazarla. |

### 2.6 Reglas de Interfaz Adaptativa

| ID | Regla |
|---|---|
| RN-050 | En **modo moto**: pantalla completa, botones grandes, alto contraste. Prioridad a la seguridad vial. |
| RN-051 | En **modo trekking/running**: retroalimentación háptica (vibración) priorizada sobre visual. |
| RN-052 | Todos los textos superan el tamaño mínimo para uso outdoor. La interfaz muestra lo mínimo necesario. |

### 2.7 Reglas de Métricas y Cierre

| ID | Regla |
|---|---|
| RN-060 | Al finalizar un viaje se detiene el tracking de todos los integrantes y se genera automáticamente el resumen. |
| RN-061 | Métricas individuales: distancia recorrida, tiempo total, tiempo en movimiento, tiempo detenido, velocidad promedio. |
| RN-062 | Métricas grupales: integrantes totales, distancia promedio, cantidad de alertas generadas. |
| RN-063 | El ranking de viaje se ordena por velocidad promedio, distancia o tiempo en movimiento. |
| RN-064 | El resumen visual (tipo "Wrapped") se genera mensual y anualmente; es compartible como imagen. |

### 2.8 Reglas de Gamificación y Competición

| ID | Regla |
|---|---|
| RN-070 | **La modalidad moto queda EXCLUIDA de todos los rankings competitivos y tablas de posiciones** para evitar conductas de riesgo asociadas a la competencia. Esta es una regla de seguridad vial no negociable. |
| RN-071 | El modo competitivo activa un leaderboard en tiempo real basado en posición y tiempos relativos. |
| RN-072 | El modo recreativo desactiva rankings y comparaciones pero mantiene navegación y alertas de seguridad. |
| RN-073 | El ghost tracking superpone un marcador fantasma de un recorrido histórico que se mueve en tiempo real. El usuario ve si va adelante o atrás. |
| RN-074 | Las insignias se otorgan automáticamente al cumplir criterios de logro (distancia, duración, tipo de actividad). |
| RN-075 | Las rachas se miden en semanas consecutivas con al menos una actividad. Al romperse, el contador se reinicia. |
| RN-076 | La tabla global de posiciones está segmentada por tipo de actividad y filtrable por período (semanal, mensual, anual). |

### 2.9 Reglas de Red Social de Recorridos

| ID | Regla |
|---|---|
| RN-080 | La red social es **deliberadamente acotada**: no es una red social generalista. |
| RN-081 | Los usuarios publican recorridos de su historial; pueden despublicarlos en cualquier momento. |
| RN-082 | La valoración es binaria: "Recomiendo" / "No recomiendo". Un usuario solo puede valorar una vez por recorrido. |
| RN-083 | **No se permiten comentarios de texto** para mantener la simplicidad y evitar moderación. |
| RN-084 | Los recorridos publicados son importables como base para nuevos viajes. |

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
    │     ├── Tipo de actividad (moto / bici / running / trekking)
    │     ├── Fecha y hora de salida
    │     ├── Modo de viaje (competitivo / recreativo / entrenamiento)
    │     └── [Si grupal] Seleccionar 1+ grupos (solo donde soy miembro) ──► RN-028/029
    │
    ├── Crear ruta
    │     ├── Marcar origen en mapa (OpenStreetMap)
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
    │     ├── Notificación al líder
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
    ├── Generación automática de métricas
    │     ├── Individuales: distancia, tiempo total/movimiento/detenido, velocidad promedio
    │     └── Grupales: integrantes totales, distancia promedio, alertas generadas
    │
    ├── Ranking del viaje (por velocidad, distancia o tiempo)
    │     └── EXCEPCIÓN: moto no tiene ranking
    │
    ├── [Avanzado] Resumen visual tipo "Wrapped" / Spotify
    │     └── Compartible como imagen
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
    │     ├── Filtrar por tipo de actividad y zona geográfica
    │     ├── Ver autor, distancia, actividad, valoración
    │     └── Importar como base para viaje nuevo
    │
    └── Valorar recorrido
          ├── "Recomiendo" / "No recomiendo" (una vez por recorrido)
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
├── actividad_preferida (enum: moto, bici, running, trekking)
├── config_privacidad
└── created_at

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
├── es_grupal (boolean)
├── tipo_actividad (enum: moto, bici, running, trekking)
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
├── categoria (enum: combustible, descanso, gastronomía, sanitario, otro)
├── nombre
└── tiempo_estimado_parada

ViajeIntegrante
├── viaje_id (FK)
├── usuario_id (FK)
├── estado (enum: pendiente, confirmado, rechazado) — RN-029; QR usa confirmado directo (RN-016)
└── origen (enum: creador, qr, link, grupo) — opcional, trazabilidad

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
├── inicio
├── fin (nullable)
└── confirmado_bien (boolean, nullable)

Alerta
├── id (PK)
├── viaje_id (FK)
├── tipo (enum: desvío, atraso, incidente, manual, parada_solicitada)
├── generada_por (enum: sistema, líder, integrante)
├── usuario_afectado_id (FK, nullable)
├── ubicacion (point)
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
├── texto
├── sugerido_por_sistema (boolean)
├── completado (boolean)
└── usuario_id (FK)

RecorridoPublicado
├── id (PK)
├── viaje_id (FK)
├── usuario_id (FK)
├── tipo_actividad
├── distancia
├── tiempo
├── publicado_at
└── activo (boolean)

Valoracion
├── recorrido_publicado_id (FK)
├── usuario_id (FK)
└── recomiendo (boolean)

Insignia
├── id (PK)
├── nombre
├── criterio_distancia
├── criterio_duracion
├── criterio_actividad
└── icono

UsuarioInsignia
├── usuario_id (FK)
├── insignia_id (FK)
└── obtenida_at

RachaActividad
├── usuario_id (FK)
├── semanas_consecutivas (int)
├── inicio_racha
└── ultima_actividad
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

### 5.4 Estados de Confirmación de Asistencia

```
[pendiente] ──► [confirmado]
      │
      └──► [rechazado]
```

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
- Interfaz adaptativa por tipo de actividad (moto = pantalla completa; trekking = háptica).
- Se muestra lo mínimo necesario en pantalla.

### 6.5 Arquitectura

- **API-First** con API RESTful documentada bajo OpenAPI.
- Mapas: **OpenStreetMap** (costo $0, sin dependencia de APIs comerciales).
- Base de datos: **Supabase** (PostgreSQL + PostGIS administrado, extensión PostGIS habilitada).
- Tiempo real: **WebSockets** vía **Socket.io**.
- Hosting: **VPS** (DigitalOcean / Donweb) con CI/CD.
- Autenticación: **Firebase Authentication**.

### 6.6 Privacidad

- El usuario puede activar/desactivar compartir ubicación por viaje.
- Se solicita permiso GPS con explicación clara del uso.
- El usuario puede ver quiénes acceden a su posición.
- Cumplimiento con normativa de privacidad de datos.
- No se rastrean menores de edad.

---

## 7. Tiers de Funcionalidad

### Tier Core (MVP)

Las funcionalidades sin las cuales la app **no cumple su propósito mínimo viable**:

1. **E01** — Gestión de usuarios y autenticación (registro, login, perfil, privacidad)
2. **E02** — Gestión de grupos (crear, invitar, confirmar asistencia)
3. **E03** — Planificación de viajes y rutas (crear viaje, definir ruta, paradas, checklist)
4. **E04** — Ejecución y seguimiento en tiempo real (tracking GPS, detección de desvíos/atrasos/incidentes, offline)
5. **E05** — Alertas y comunicación operativa (alertas manuales/automáticas, interfaz adaptativa)

### Tier Avanzado

Funcionalidades de alto valor que **diferencian al producto** de la competencia:

6. **E06** — Cierre, métricas y estadísticas (resumen de viaje, ranking, wrapped, entrenamiento)
7. **E07** — Ghost tracking y competición (fantasma, modo competitivo/recreativo)

### Tier Deseable

Funcionalidades para **fases futuras**:

8. **E08** — Gamificación con hitos, POIs, gastos colaborativos, wearables, itinerario IA
9. **E09** — Gamificación extendida (insignias, rachas, tabla global)
10. **E10** — Red social de recorridos (publicar, explorar, valorar)
11. **E11** — Asistencia inteligente IA (recomendación climática, itinerarios)
12. **E12** — Información de ruta en tiempo real (cortes, radares, reportes comunitarios)

---

## 8. Parámetros por Defecto según Tipo de Actividad

| Parámetro | Moto | Bici | Running | Trekking |
|---|---|---|---|---|
| Velocidad promedio esperada | Alta | Media | Baja | Muy baja |
| Distancia máx. separación grupo | Mayor | Media | Menor | Menor |
| Tolerancia de atraso | Mayor | Media | Menor | Menor |
| Interfaz | Pantalla completa, alto contraste, botones grandes | Estándar outdoor | Háptica + visual | Háptica + visual |
| Ranking competitivo | **PROHIBIDO** | Sí | Sí | Sí |
| Tabla de posiciones global | **EXCLUIDA** | Sí | Sí | Sí |

> **Nota crítica**: La exclusión de moto de rankings y tablas competitivas es una decisión de seguridad vial irrevocable. Nunca se debe incentivar la competencia de velocidad en motocicletas.

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
| **Wrapped** | Resumen visual y atractivo de estadísticas de un período (inspirado en Spotify Wrapped). |
| **Wearable** | Dispositivo electrónico portátil (reloj inteligente, pulsera de actividad) con sensores de movimiento y conectividad. |
| **QR de invitación** | Código QR único generado por viaje que permite unirse **al viaje** escaneándolo (RN-015/016). Expira al iniciar el viaje. No agrega al usuario a ningún grupo. |
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