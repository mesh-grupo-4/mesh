# Estructura del repositorio — Mesh

Monorepo con dos aplicaciones principales (`backend/` y `frontend/`), más documentación de tesis (`tesis-brain/`) y el grafo de conocimiento del código (`graphify-out/`).

```
mesh/
├── CLAUDE.md                     # Instrucciones del proyecto para el agente de IA
├── README.md                     # README raíz
├── .cursorrules                  # Reglas para Cursor
├── .gitignore
├── package-lock.json
│
├── backend/                      # API REST + WebSockets (Node + TS + Express v5 + Socket.io)
│   ├── openapi/                  # Spec OpenAPI 3.0.3 modular (API-First, fuente de verdad)
│   │   ├── openapi.yaml          # Raíz: info, servers, security, tags, paths por $ref
│   │   ├── components/           # securitySchemes, parameters, responses, schemas
│   │   └── paths/                # Un archivo por módulo de dominio
│   ├── docs/
│   │   └── websockets.md         # Eventos Socket.io (OpenAPI no cubre WebSockets)
│   ├── redocly.yaml              # Reglas de lint del spec
│   │
│   ├── prisma/
│   │   ├── schema.prisma         # Modelo de datos (fuente de verdad)
│   │   └── migrations/           # Migraciones SQL versionadas
│   └── src/
│       ├── config/
│       ├── docs/                 # Swagger UI en /api/docs + test de contrato spec↔router
│       ├── lib/
│       ├── middleware/
│       ├── realtime/
│       ├── routes/
│       ├── types/
│       │   └── socket.d.ts
│       └── modules/              # Dominios (Controller → Service → Repository)
│           ├── usuarios/
│           ├── amistades/
│           ├── grupos/
│           └── viajes/
│
├── frontend/                     # App móvil (Expo SDK 54 + RN 0.81 + Expo Router v6)
│   ├── app/                      # Rutas (file-based routing, typedRoutes)
│   │   ├── (auth)/               # Flujo de autenticación
│   │   ├── (tabs)/               # Tab navigator
│   │   ├── amigos/
│   │   ├── configurar-ruta/
│   │   ├── grupo/
│   │   └── viaje/
│   ├── components/               # Componentes reutilizables
│   │   ├── route-config/         # UI de configuración de rutas (mapa OSM)
│   ├── lib/                      # Clientes de API, sockets y utilidades
│   │   ├── apiClient.ts
│   │   ├── meshSocket.ts         # Cliente Socket.io
│   │   └── tracking/
│   ├── context/
│   ├── assets/│
├── graphify-out/                 # Grafo de conocimiento del código (fuente de verdad estructural)
│   ├── GRAPH_REPORT.md
│   ├── graph.json
│   └── cache/
│
└── tesis-brain/                  # Vault Obsidian: reglas de negocio, specs y decisiones de arquitectura
```

## Notas

- **Arquitectura backend:** capas `Controller/Socket → Service → Repository`. Toda entrada se valida con Zod.
- **Documentación de la API:** spec OpenAPI modular en `backend/openapi/`, servido con Swagger UI en `/api/docs`. `backend/src/docs/contrato.test.ts` falla el build si el spec y el router de Express divergen.
- **Tiempo real:** Socket.io recibe pings GPS cada 5 s y los procesa en el motor de eventos del backend.
- **Offline-first:** los registros GPS se encolan en el dispositivo (`lib/tracking/gpsQueue.ts`) y se sincronizan al reconectar.
- **Mapas:** OpenStreetMap (Nominatim para geocoding, OSRM para ruteo). Sin Google Maps ni Mapbox.
- **Base de datos:** Supabase (PostgreSQL + PostGIS) vía Prisma v7. Cálculos espaciales delegados a PostGIS.
- Se omiten `node_modules/`, `dist/`, `.expo/` y archivos de credenciales.
```
```
