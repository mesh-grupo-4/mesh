# Mesh — Backend

Backend del proyecto de tesis **Mesh**. API REST con soporte en tiempo real via WebSockets.

---

## Stack tecnológico

| Tecnología | Rol |
|---|---|
| **Node.js** | Runtime de JavaScript en el servidor |
| **TypeScript** | Tipado estático sobre JavaScript |
| **Express v5** | Framework HTTP para la API REST |
| **Socket.io** | Comunicación bidireccional en tiempo real |
| **Prisma** | ORM para interactuar con la base de datos |
| **PostgreSQL** | Base de datos relacional |
| **helmet** | Headers de seguridad HTTP |
| **cors** | Control de acceso cross-origin |
| **dotenv** | Variables de entorno desde `.env` |
| **nodemon** | Hot reload en desarrollo |
| **ts-node** | Ejecución de TypeScript sin compilación previa |

### Por qué cada uno

**Express** maneja las rutas REST clásicas (CRUD, autenticación, etc.). **Socket.io** se encarga de los eventos en tiempo real que necesitan push del servidor al cliente. Ambos comparten el mismo servidor HTTP para no abrir dos puertos.

**Prisma** genera un cliente tipado a partir del `schema.prisma`, lo que permite autocompletado y verificación de tipos en todas las queries a la base de datos, sin escribir SQL a mano.

**helmet** y **cors** se configuran en el entry point como middlewares globales para cubrir los vectores de seguridad más comunes desde el arranque.

---

## Estructura del proyecto

```
backend/
├── src/
│   ├── controllers/        # Funciones que procesan cada request HTTP
│   ├── routes/
│   │   └── index.ts        # Router principal, monta sub-routers por dominio
│   ├── middleware/         # Middlewares personalizados (auth, validación, errores)
│   ├── services/           # Lógica de negocio, acceso a Prisma
│   ├── sockets/
│   │   └── index.ts        # Registro de handlers de eventos Socket.io
│   ├── types/              # Tipos e interfaces TypeScript compartidos
│   └── index.ts            # Entry point: configura Express, Socket.io y arranca el servidor
├── prisma/
│   └── schema.prisma       # Definición de modelos y relaciones de la DB
├── dist/                   # Output de compilación TypeScript (generado, no versionar)
├── .env                    # Variables de entorno locales (no versionar)
├── .env.example            # Plantilla de variables de entorno
├── .gitignore
├── nodemon.json            # Configuración de hot reload para desarrollo
├── package.json
└── tsconfig.json
```

### Convenciones

- **`controllers/`** — un archivo por recurso (ej: `user.controller.ts`). Solo reciben el `Request` y devuelven la `Response`. No contienen lógica de negocio.
- **`services/`** — un archivo por dominio (ej: `user.service.ts`). Contienen toda la lógica de negocio y llaman a Prisma directamente.
- **`routes/`** — conectan las URLs con los controladores. Sub-routers por dominio montados en `index.ts`.
- **`sockets/`** — handlers de eventos Socket.io organizados por dominio, registrados desde `index.ts`.
- **`middleware/`** — funciones reutilizables que se inyectan en las rutas (autenticación JWT, validación de body, manejo de errores global).
- **`types/`** — interfaces y tipos compartidos entre capas para evitar duplicación.

---

## Variables de entorno

Copiar `.env.example` a `.env` y completar los valores:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://user:password@localhost:5432/mesh_db"

CORS_ORIGIN=http://localhost:5173
```

---

## Comandos

```bash
# Instalar dependencias
npm install

# Desarrollo con hot reload
npm run dev

# Compilar a JavaScript
npm run build

# Producción (requiere build previo)
npm run start

# Crear/aplicar migraciones de base de datos
npm run db:migrate

# Generar cliente Prisma (después de editar schema.prisma)
npm run db:generate

# Explorar la DB visualmente
npm run db:studio
```

---

## Flujo de una request REST

```
Request HTTP
    └── Express (middleware globales: helmet, cors, json)
            └── routes/index.ts
                    └── controllers/*.ts
                            └── services/*.ts
                                    └── Prisma Client
                                            └── PostgreSQL
```

## API Grupos (SCRUM-11)

Ver especificación OpenAPI: [`openapi/grupos.yaml`](openapi/grupos.yaml).

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/usuarios/sync` | No | Upsert usuario por email (MVP; sin Firebase en backend). |
| `POST` | `/api/grupos` | `x-user-id` | Crea grupo; creador queda como `líder`. |
| `GET` | `/api/grupos/:grupoId` | `x-user-id` | Detalle básico (solo miembros). |

## API Viajes (MVP — iniciar salida)

Autenticación temporal: header `x-user-id: <uuid>` (debe existir en tabla `usuario`). WebSockets: mismo header en el handshake.

### REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/viajes` | Crea viaje (`planificado`). Body: `esGrupal`, `grupoId?`, `tipoActividad`, `fechaProgramada` (ISO). |
| `PUT` | `/api/viajes/:viajeId/ruta` | Guarda ruta: `origen`/`destino` GeoJSON Point, `linestring` GeoJSON LineString, `paradas` (≤10), `tiempoEstimadoSeg?`. Distancia planeada vía PostGIS. |
| `POST` | `/api/viajes/:viajeId/iniciar` | Creador → `en_curso`, emite `viaje:iniciado`. |
| `POST` | `/api/viajes/:viajeId/finalizar` | Creador → `finalizado`, resumen + `viaje:finalizado`. |

### Socket.io

Tras conectar, unirse a la sala del viaje:

- Evento cliente → servidor: `join_viaje` con `{ viajeId: "<uuid>" }`
- Salir: `leave_viaje`

Eventos servidor → cliente (broadcast a la sala `viaje:<id>`):

- `viaje:iniciado` `{ viajeId, estado, fechaInicioReal }`
- `viaje:finalizado` `{ viajeId, estado, fechaFinReal }`

### GeoJSON (contrato)

- `Point`: `{ "type": "Point", "coordinates": [lng, lat] }`
- `LineString`: `{ "type": "LineString", "coordinates": [[lng, lat], ...] }` (mínimo 2 puntos)

## Flujo de un evento WebSocket

```
Cliente emite evento
    └── Socket.io Server
            └── sockets/index.ts (handler registrado)
                    └── services/*.ts (misma lógica de negocio)
                            └── io.emit() / socket.emit() → Cliente(s)
```
