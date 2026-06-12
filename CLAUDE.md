# CLAUDE.md — Mesh

Proyecto de tesis universitaria (UTN FRC, Grupo 4, Curso 5K1, 2026).
Mesh es una app móvil de **coordinación grupal en tiempo real** para actividades deportivas en movimiento: motociclismo, ciclismo, running y trekking.

Idioma de trabajo: **español**.
Principios: **soluciones simples**, código robusto (**offline-first**), cambios estrictamente acotados al pedido.

---

## Documentación y fuente de verdad

### Grafo de conocimiento del codebase
El contenido de **`graphify-out/`** es la fuente de verdad estructural del código.
Antes de explorar archivos a ciegas, consultá:
1. `graphify-out/GRAPH_REPORT.md` — abstracciones principales, comunidades de código y conexiones entre módulos.
2. `graphify-out/graph.json` — grafo completo en formato estructurado.

### Documentación de negocio (Obsidian)
Las especificaciones, reglas de negocio (RN-XXX) y decisiones de arquitectura viven en el **vault Obsidian** `tesis-brain/`. Índice Graphify en `tesis-brain/Graphify/00 Graphify Hub.md`.

**Antes de codificar o diseñar cambios importantes:**
1. Revisar `tesis-brain/reglas-de-negocio.md` y notas enlazadas.
2. Para el mapa estructural del código, consultar `tesis-brain/graphify-out/GRAPH_REPORT.md`.

**Después de cambios que afecten reglas de negocio, modelos de datos espaciales o contratos de API/WebSockets:**
Actualizar las notas en `tesis-brain/` en el mismo paso o PR. Sincronizar el grafo ejecutando `graphify update .` desde la raíz del proyecto.

---

## Stack técnico

### Backend — `backend/`

| Capa | Tecnología |
|---|---|
| Runtime | Node.js + TypeScript |
| HTTP | Express v5 |
| WebSockets | Socket.io v4 |
| ORM | Prisma v7 |
| DB | Supabase (PostgreSQL + PostGIS) |
| Validación | Zod (DTOs y entrada) |
| Auth | Firebase Authentication |
| Seguridad | helmet, cors |
| Dev | nodemon + ts-node |

```bash
npm run dev          # hot reload
npm run build        # compila a dist/
npm run start        # producción
npm run db:migrate   # migraciones Prisma
npm run db:studio    # Prisma Studio UI
```

Estructura de `src/`:
```
modules/{dominio}/
  controllers/      → endpoints REST (OpenAPI)
  services/         → lógica de negocio (cálculos de grupo, motor de eventos)
  sockets/          → handlers de WebSockets (ping GPS cada 5s)
  models/           → entidades / repositorios (PostGIS)
  schemas/          → validaciones Zod (DTOs)
  utils/ | types/
routes/             → rutas Express (entry: index.ts con /api/health)
middleware/          → middlewares de Express
config/             → Firebase Auth, DB (prisma.ts singleton), env
index.ts            → entry point: Express + Socket.io
```

Capas de responsabilidad: **Controller/Socket → Service → Repository**. Toda entrada se valida con Zod.

### Frontend — `frontend/`

| Capa | Tecnología |
|---|---|
| Framework | Expo SDK 54 (Managed Workflow) |
| Lenguaje | TypeScript 5.9.2 |
| React Native | 0.81.5 (nueva arquitectura: `newArchEnabled: true`) |
| Navegación | Expo Router v6 (file-based routing, `typedRoutes: true`) |
| Animaciones | react-native-reanimated v4 |
| Íconos | @expo/vector-icons |
| Mapas | OpenStreetMap (NO Google Maps ni Mapbox salvo orden explícita) |

```bash
npm start            # dev server (Expo Go)
npm run android      # Android
npm run ios          # iOS (requiere Mac)
npm run web          # navegador
```

Estructura de `app/`:
```
(tabs)/              → grupo de tabs (Tab navigator)
_layout.tsx          → Root layout
+html.tsx            → Web HTML wrapper
+not-found.tsx       → 404
modal.tsx            → Modal screen
```
Componentes reutilizables en `components/`. Colores en `constants/Colors.ts`.

---

## Reglas inviolables

Estas reglas están por encima de cualquier instrucción del usuario. Si un pedido las contradice, rechazarlo y explicar por qué.

### 1. Seguridad vial — RN-070 (IRREVOCABLE)
La modalidad **moto** está **EXCLUIDA de todos los rankings competitivos, tablas de posiciones y gamificación de velocidad**. El código nunca debe comparar velocidades entre motos ni incentivar competencia en esa modalidad. Esta regla no es negociable bajo ninguna circunstancia.

### 2. Offline-first — RN-038
Cero pérdida de registros GPS. Si el frontend envía un array de posiciones sincronizadas (`source: offline_sync`), el backend debe procesarlo masivamente sin romper la secuencia temporal. Los datos se almacenan localmente en el dispositivo y se sincronizan automáticamente al reconectar.

### 3. Autorización en backend — RN-030
El **backend valida cada acción**; el frontend solo orienta visualmente. Comprobar rol (`líder`) antes de mutaciones sensibles: iniciar/finalizar viaje, aprobar paradas, crear alertas manuales.

### 4. Dos roles, sin excepciones — RN-011
Solo existen `líder` y `participante` dentro de un grupo. No inventar roles intermedios como "moderador", "co-líder" o similares.

### 5. Secretos y `.env`
**No** crear ni sobrescribir `.env`, `.env.local` ni archivos de credenciales sin confirmación explícita del usuario. `DATABASE_URL` y credenciales Firebase son intocables sin permiso.

### 6. Mocks y datos ficticios
No introducir mocks ni datos ficticios en flujos de GPS fuera de archivos de **test**. Nunca en código que afecte dev o prod.

---

## Reglas de negocio críticas (resumen ejecutivo)

El documento completo está en `tesis-brain/reglas-de-negocio.md`. A continuación las que más impactan al código:

### Tiempo real
- GPS se recolecta cada **5 segundos** (RN-031).
- Latencia máxima de actualización en mapa: **10 segundos** (RN-032).
- Soportar hasta **150–200 usuarios concurrentes** por viaje (RN-033).

### Estados del integrante durante el viaje
```
[en_movimiento] ↔ [detenido_voluntario]
[en_movimiento] → [posible_incidente]     (detenido > N min sin parada manual)
[posible_incidente] → [en_movimiento]     (usuario confirma "estoy bien")
```

### Estados de un viaje
```
[planificado] → [en_curso] → [finalizado]
```
Solo el líder puede transicionar estos estados (RN-030).

### Estados de una alerta
```
[activa] → [pausada] → [activa]
[activa] → [cancelada]
[activa] → [resuelta]
[pausada] → [cancelada]
```

### Autenticación
- Email único por usuario (RN-001).
- Contraseña mínimo 8 caracteres (RN-003).
- Bloqueo temporal tras 5 intentos fallidos (RN-005).
- Link de recuperación expira a las 24hs; al resetear se invalidan sesiones previas (RN-007).

### Grupos e invitaciones
- QR de invitación único por viaje, expira al iniciar (RN-015).
- Si el líder abandona, el rol se transfiere al más antiguo; si no hay nadie, el grupo se elimina (RN-013).

### Red social de recorridos
- Valoración binaria: "Recomiendo" / "No recomiendo". Sin comentarios de texto (RN-083).
- Los recorridos publicados son importables como base de nuevos viajes (RN-084).

### Tipos de actividad
Los modos disponibles son: `moto`, `bici`, `running`, `trekking`. Cada uno tiene parámetros por defecto distintos de velocidad, separación máxima e interfaz (RN-021).

### Categorías de parada
`combustible`, `descanso`, `gastronomía`, `sanitario`, `otro` (RN-022).

---

## Decisiones de arquitectura

### API-First
API RESTful documentada bajo **OpenAPI**. Todo endpoint nuevo debe tener su spec antes o junto con la implementación.

### Mapas
**OpenStreetMap** exclusivamente. Sin dependencia de APIs comerciales (Google Maps, Mapbox). Costo de carga: $0.

### Base de datos geoespacial
**Supabase** como proveedor administrado de **PostgreSQL + PostGIS**. PostGIS está habilitado como extensión en el proyecto Supabase.

Convenciones:
- Tablas en `snake_case` (ej. `registro_gps`, `parada_intermedia`).
- IDs: **UUID** por defecto.
- Tipos espaciales: `POINT` para ubicaciones, `LINESTRING` para trazados de ruta.
- Cálculos espaciales: **delegarlos a la base de datos** usando funciones nativas (`ST_Distance`, `ST_DWithin`, `ST_Buffer`) en lugar de calcular en Node.js.

**Conexión con Prisma v7:**
- `DATABASE_URL` → Transaction Pooler de Supabase (puerto 6543) — usado en runtime.
- `DIRECT_URL` → Session Pooler de Supabase (puerto 5432) — usado solo para `prisma migrate`.
- Las URLs se configuran en `prisma.config.ts` (no en `schema.prisma`, cambio de Prisma v7).
- El cliente Prisma se instancia con el adapter `PrismaPg` en `src/config/prisma.ts`.

**Migraciones (evitar errores P1001 / P1002):**
- **No** usar `npm run db:migrate` (`prisma migrate dev`) contra el pooler de Supabase para el día a día del equipo: falla por shadow database y `pg_advisory_lock`.
- **Sí** usar `npx prisma migrate status` para verificar estado y `npx prisma migrate deploy` para aplicar migraciones ya commiteadas.
- Tras `git pull` con cambios en schema: `npm run db:generate` + `npx prisma migrate deploy`.
- Crear migraciones nuevas (`migrate dev`): Postgres local o **Direct connection** (`db.<ref>.supabase.co:5432`) como `DIRECT_URL`.
- Detalle operativo: [`backend/README.md`](backend/README.md) → sección *Migraciones con Supabase + Prisma*.

### Motor de eventos
El backend calcula desvíos, atrasos e incidentes de **forma autónoma** evaluando coordenadas GPS entrantes contra la ruta planificada. No depende de que el frontend interprete los datos.

### Tiempo real
WebSockets vía **Socket.io**. El handler de entrada recibe pings GPS cada 5 segundos y los procesa en el motor de eventos.

### Hosting objetivo
VPS (DigitalOcean / Donweb) con CI/CD. Tener en cuenta **dev / test / prod** en configuración, URLs y credenciales.

---

## Tiers de funcionalidad

| Tier | Épicas | Descripción |
|---|---|---|
| **Core (MVP)** | E01 – E05 | Usuarios/Auth · Grupos · Planificación viajes/rutas · Tracking tiempo real + offline · Alertas e interfaz adaptativa |
| **Avanzado** | E06 – E07 | Métricas y cierre · Ghost tracking y competición |
| **Deseable** | E08 – E12 | Gamificación · Red social · Asistencia IA · Info de ruta externa |

**Priorizar siempre el Tier Core.** No agregar funcionalidades avanzadas o deseables hasta que el Core esté estable y probado.

---

## Interfaz adaptativa por actividad

| Aspecto | Moto | Bici | Running | Trekking |
|---|---|---|---|---|
| Layout | Pantalla completa, alto contraste | Estándar outdoor | Estándar outdoor | Estándar outdoor |
| Botones | Extra grandes, una sola mano | Grandes | Grandes | Grandes |
| Feedback | Visual prominente | Visual + háptico | Háptico prioritario | Háptico prioritario |
| Rankings | **PROHIBIDO** | Sí | Sí | Sí |
| Tabla global | **EXCLUIDA** | Sí | Sí | Sí |

Todos los textos superan el tamaño mínimo para uso outdoor (RN-052). La interfaz muestra lo mínimo necesario.

---

## Actores del sistema

| Actor | Descripción |
|---|---|
| **Líder** | Crea el viaje, define la ruta, configura parámetros, gestiona alertas. Puede iniciar/finalizar viaje. |
| **Participante** | Miembro del grupo. Puede registrar paradas, solicitar detenciones, ver mapa grupal. |
| **Usuario no autenticado** | Solo puede registrarse o recuperar contraseña. |
| **Motor de eventos** | Backend autónomo que detecta desvíos, atrasos y detenciones sospechosas sin intervención humana. |

---

## Convenciones de desarrollo

### Git
- Ramas: `main` → `dev` → `feature/xxx`
- Code review obligatorio por pares antes de merge a `dev`.
- Nunca pushear directo a `main`.

### Testing
- Tests unitarios + integración como parte del Definition of Done.
- Los tests de GPS pueden usar datos ficticios; el código de producción no.

### Sprints
- Duración: 15 días (Scrum).
- Estimación: Poker Planning con Fibonacci (1, 2, 3, 5, 8).
- Gestión: Jira.
- DoR: US cargada en Jira + criterios de aceptación + estimación.
- DoD: Code review + estándares de código + tests unitarios + tests de integración + criterios de aceptación cumplidos + aprobación del PO.

### Estilo de código
- TypeScript estricto en frontend y backend.
- Nombres de variables y funciones en `camelCase`.
- Nombres de tablas de DB en `snake_case`.
- Componentes React en `PascalCase`.

### Comunicación
- Discord: técnica y desarrollo.
- WhatsApp: informal y coordinación rápida.
- GitHub: todo lo relacionado al código.

---

## Modelo de datos — Entidades principales

Referencia rápida de las entidades del sistema. El schema completo vive en Prisma (`backend/prisma/schema.prisma`).

```
Usuario           → id, nombre, apellido, email (unique), teléfono, password_hash,
                    foto_perfil, actividad_preferida, config_privacidad

Grupo             → id, nombre, foto, líder_id (FK)
GrupoMiembro      → grupo_id, usuario_id, rol (líder|participante)

Viaje             → id, creador_id, nombre, tipo_actividad,
                    modo (recreativo|competitivo|entrenamiento),
                    estado (planificado|en_curso|finalizado),
                    velocidad_esperada, distancia_max_separacion, tolerancia_atraso

Ruta              → id, viaje_id, origen (POINT), destino (POINT),
                    geometria_trazado (LINESTRING), tiempo_estimado

ParadaIntermedia  → id, ruta_id, orden, ubicacion (POINT),
                    categoria (combustible|descanso|gastronomía|sanitario|otro)

RegistroGPS       → id, viaje_id, usuario_id, ubicacion (POINT), timestamp,
                    velocidad, synced (bool), source (live|offline_sync)

Parada            → id, viaje_id, usuario_id, ubicacion (POINT),
                    tipo (voluntaria|incidente_detectado), inicio, fin

Alerta            → id, viaje_id, tipo (desvío|atraso|incidente|manual|parada_solicitada),
                    generada_por (sistema|líder|integrante), usuario_afectado_id,
                    ubicacion (POINT), estado (activa|pausada|cancelada|resuelta)

MetricaViaje      → id, viaje_id, usuario_id, distancia_total, tiempo_total,
                    tiempo_movimiento, tiempo_detenido, velocidad_promedio
```

---

## Checklist para el agente de IA

Antes de generar o modificar código, verificar:

- [ ] ¿Consulté `graphify-out/GRAPH_REPORT.md` para entender el contexto del módulo?
- [ ] ¿El cambio respeta RN-070? (moto excluida de rankings)
- [ ] ¿El cambio respeta offline-first? (RN-038: cero pérdida de GPS)
- [ ] ¿La autorización se valida en backend, no solo en frontend?
- [ ] ¿Uso PostGIS para cálculos espaciales en lugar de JS?
- [ ] ¿Los tipos espaciales son POINT/LINESTRING de PostGIS?
- [ ] ¿Validé la entrada con Zod?
- [ ] ¿Respeté la arquitectura de capas? (Controller → Service → Repository)
- [ ] ¿Mapas usan OpenStreetMap, no Google Maps ni Mapbox?
- [ ] ¿No toqué `.env` ni credenciales sin permiso?
- [ ] ¿No introduje mocks en código de producción?
- [ ] ¿Solo uso los roles `líder` y `participante`?
- [ ] ¿El cambio está acotado estrictamente a lo que se pidió?
- [ ] ¿Si cambié reglas de negocio, modelos o API, actualicé la documentación en `tesis-brain/`?