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
| **Zod** | Validación de toda la entrada (body, query, path params) |
| **swagger-ui-express** | Sirve la documentación interactiva en `/api/docs` |
| **@redocly/cli** | Valida y bundlea el spec OpenAPI modular |
| **Vitest** | Tests unitarios y de contrato |
| **helmet** | Headers de seguridad HTTP |
| **cors** | Control de acceso cross-origin |
| **dotenv** | Variables de entorno desde `.env` |
| **nodemon** | Hot reload en desarrollo |
| **ts-node** | Ejecución de TypeScript sin compilación previa |

### Por qué cada uno

**Express** maneja las rutas REST clásicas (CRUD, autenticación, etc.). **Socket.io** se encarga de los eventos en tiempo real que necesitan push del servidor al cliente. Ambos comparten el mismo servidor HTTP para no abrir dos puertos.

**Prisma** genera un cliente tipado a partir del `schema.prisma`, lo que permite autocompletado y verificación de tipos en todas las queries a la base de datos, sin escribir SQL a mano.

**helmet** y **cors** se configuran en `app.ts` como middlewares globales para cubrir los vectores de seguridad más comunes desde el arranque.

**Zod** valida toda la entrada antes de que llegue a la lógica de negocio, y su `ZodError` se traduce a una respuesta 400 uniforme en el manejador global de errores.

**@redocly/cli** valida el spec OpenAPI contra un ruleset propio (`redocly.yaml`) y resuelve sus `$ref` en un único documento, que **swagger-ui-express** sirve en `/api/docs`.

---

## Estructura del proyecto

```
backend/
├── openapi/                # Spec OpenAPI 3.0.3 modular (fuente de verdad de la API REST)
│   ├── openapi.yaml        # Documento raíz: info, servers, security, tags, paths por $ref
│   ├── components/         # securitySchemes, parameters, responses y schemas compartidos
│   └── paths/              # Un archivo por módulo de dominio
├── docs/
│   └── websockets.md       # Especificación del canal Socket.io (OpenAPI no cubre WebSockets)
├── src/
│   ├── app.ts              # createApp(): Express sin listen ni Socket.io (usable en tests)
│   ├── index.ts            # Entry point: HTTP + Socket.io + listen
│   ├── config/             # prisma, firebase, timezone
│   ├── docs/               # Router de Swagger UI + test de contrato spec ↔ router
│   ├── lib/                # Utilidades: httpError, geo, postgis, qrInvite, expoPush
│   ├── middleware/         # requireUser (Firebase) y errorHandler
│   ├── realtime/           # Registro del servidor Socket.io
│   ├── routes/
│   │   └── index.ts        # Router principal, monta los sub-routers por dominio
│   ├── sockets/            # Handlers de eventos Socket.io
│   ├── types/              # Ampliaciones de tipos (Express.Request, SocketData)
│   └── modules/            # Un directorio por dominio
│       ├── usuarios/
│       ├── amistades/
│       ├── grupos/
│       ├── viajes/
│       └── rutas-compartidas/
├── prisma/
│   ├── schema.prisma       # Definición de modelos y relaciones de la DB
│   └── migrations/         # Migraciones SQL versionadas
├── dist/                   # Output de compilación TypeScript (generado, no versionar)
├── .env                    # Variables de entorno locales (no versionar)
├── redocly.yaml            # Reglas de lint del spec OpenAPI
├── nodemon.json            # Configuración de hot reload para desarrollo
├── package.json
└── tsconfig.json
```

Cada módulo de `modules/` agrupa los archivos de su dominio con el mismo patrón:

```
modules/viajes/
├── viajes.router.ts        # Rutas Express del dominio
├── viajes.controller.ts    # Valida la entrada con Zod y delega en el service
├── viajes.service.ts       # Lógica de negocio y acceso a Prisma
├── viajes.schemas.ts       # Schemas Zod de request y path params
└── *.test.ts               # Tests unitarios, junto al código que prueban
```

### Convenciones

Las capas son **Controller/Socket → Service → Repository**, y viven juntas dentro del
módulo de su dominio en vez de repartidas por carpetas técnicas.

- **`*.router.ts`** — conecta las URLs con los handlers. Se montan en `routes/index.ts`.
- **`*.controller.ts`** — recibe el `Request`, valida con Zod y devuelve la `Response`. Sin lógica de negocio.
- **`*.service.ts`** — toda la lógica de negocio y las autorizaciones (RN-030). Llama a Prisma.
- **`*.schemas.ts`** — schemas Zod de body, query y path params.
- **`sockets/`** — handlers de eventos Socket.io. Reutilizan los mismos services.
- **`middleware/`** — piezas reutilizables: autenticación Firebase y manejo global de errores.
- **`types/`** — ampliaciones de tipos compartidas entre capas.

Toda entrada se valida con Zod, sin excepciones.

---

## Variables de entorno

Crear un `.env` en `backend/` con los valores del entorno.

### Todas las variables

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | sí | Conexión de runtime (`src/config/prisma.ts`) |
| `DIRECT_URL` | sí | Conexión para migraciones Prisma (`prisma.config.ts`) |
| `FIREBASE_PROJECT_ID` | sí | Verificación de ID tokens (`src/config/firebase.ts`) |
| `FIREBASE_CLIENT_EMAIL` | sí | Ídem |
| `FIREBASE_PRIVATE_KEY` | sí | Ídem. Los `\n` literales se convierten en saltos de línea |
| `NODE_ENV` | no | `development` por defecto |
| `PORT` | no | `3000` por defecto |
| `HOST` | no | `0.0.0.0` por defecto |
| `CORS_ORIGIN` | no | Origen permitido en producción. Solo aplica a Socket.io |
| `DOCS_ENABLED` | no | `false` apaga Swagger UI en `/api/docs` |

### Supabase (entorno del equipo)

| Variable | Origen en Supabase Dashboard |
|---|---|
| `DATABASE_URL` | **Connection pooling** → Transaction mode → puerto **6543** |
| `DIRECT_URL` | **Connection pooling** → Session mode → puerto **5432** |

```env
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://...@aws-....pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...@aws-....pooler.supabase.com:5432/postgres"

FIREBASE_PROJECT_ID="mesh-xxxxx"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@mesh-xxxxx.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

CORS_ORIGIN=http://localhost:5173
```

> Las credenciales de Firebase y las URLs de base son secretos: no se versionan ni se
> comparten fuera del canal del equipo.

---

## Migraciones con Supabase + Prisma

> **Importante para el equipo:** no usar `npm run db:migrate` (`prisma migrate dev`) contra Supabase pooler salvo que tengáis una conexión directa configurada. Suele fallar con **P1001** (no alcanza el servidor) o **P1002** (timeout en `pg_advisory_lock`), aunque la base responda bien al backend.

### Comandos correctos

| Objetivo | Comando | Cuándo |
|---|---|---|
| Ver si hay migraciones pendientes | `npx prisma migrate status` | Siempre, antes de asumir que falta migrar |
| Aplicar migraciones ya commiteadas | `npx prisma migrate deploy` | Dev compartido, CI, prod |
| Crear migración nueva (local) | `npx prisma migrate dev --name <nombre>` | Solo con **Direct connection** (`db.<ref>.supabase.co:5432`) como `DIRECT_URL`, o Postgres local |
| Regenerar cliente tras editar schema | `npm run db:generate` | Tras pull con cambios en `schema.prisma` |

### Flujo recomendado del equipo

1. Quien cambia `schema.prisma` crea la migración (idealmente con Postgres local o **Direct connection** de Supabase).
2. Commitea la carpeta `prisma/migrations/`.
3. El resto del equipo, tras `git pull`:
   ```bash
   npm run db:generate
   npx prisma migrate deploy   # NO npm run db:migrate
   ```
4. Si `migrate status` dice *"Database schema is up to date"*, **no hace falta migrar** aunque `migrate dev` haya fallado antes.

### Si `migrate dev` falla pero el backend conecta

- Es esperado con Session/Transaction pooler: Prisma intenta shadow DB y advisory locks que el pooler no soporta bien.
- Verificá con `npx prisma migrate status` y, si hace falta, aplicá con `migrate deploy`.
- Para desarrollo de migraciones contra Supabase remoto: en Dashboard → Database → **Direct connection** → usá esa URL temporalmente como `DIRECT_URL`.

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

# Aplicar migraciones pendientes (Supabase / CI) — preferir este
npx prisma migrate deploy

# Crear migración local (solo con Direct connection o Postgres local)
npm run db:migrate

# Ver estado de migraciones
npx prisma migrate status

# Generar cliente Prisma (después de editar schema.prisma)
npm run db:generate

# Explorar la DB visualmente
npm run db:studio

# Tests (incluye el test de contrato del spec OpenAPI)
npm test

# Documentación de la API
npm run docs:lint      # Valida el spec OpenAPI
npm run docs:bundle    # Bundlea el spec a src/docs/openapi.bundled.json
npm run docs:preview   # Previsualiza la documentación
```

---

## Flujo de una request REST

```
Request HTTP
    └── Express (middlewares globales: helmet, cors, json 2mb)
            └── routes/index.ts  → monta los sub-routers por dominio
                    └── modules/<dominio>/*.router.ts
                            └── middleware/requireUser   (Firebase ID token → req.userId)
                                    └── *.controller.ts  (valida con Zod)
                                            └── *.service.ts  (lógica de negocio + autorización)
                                                    └── Prisma Client → PostgreSQL + PostGIS
                                                            └── middleware/errorHandler
```

---

## Documentación de la API

La API REST está especificada en **OpenAPI 3.0.3**, siguiendo el principio API-First:
todo endpoint nuevo se documenta junto con su implementación.

### Dónde vive

| Qué | Dónde |
|---|---|
| Spec modular (fuente de verdad) | [`openapi/`](openapi/) |
| Documentación interactiva | `http://localhost:3000/api/docs` |
| Spec crudo, ya bundleado | `http://localhost:3000/api/docs.json` |
| Eventos Socket.io | [`docs/websockets.md`](docs/websockets.md) |

El spec está partido en un documento raíz (`openapi/openapi.yaml`) que referencia por
`$ref` un archivo de paths por módulo y los componentes compartidos. Se bundlea a
`src/docs/openapi.bundled.json`, que es lo que sirve Swagger UI.

Ese JSON es un **artefacto generado y no versionado**: `predev`, `pretest` y `build` lo
regeneran siempre, de modo que nunca puede quedar viejo.

### Comandos

```bash
npm run docs:lint      # Valida el spec contra el ruleset de redocly.yaml
npm run docs:bundle    # Resuelve los $ref → src/docs/openapi.bundled.json
npm run docs:preview   # Previsualiza la documentación con recarga en vivo
```

Para apagar la documentación en un despliegue, `DOCS_ENABLED=false`.

### Cómo se mantiene sincronizada

[`src/docs/contrato.test.ts`](src/docs/contrato.test.ts) recorre la tabla de montajes de
`routes/index.ts` y compara la superficie REST real contra el spec. Falla si:

- hay un endpoint sin documentar, o una operación documentada que ya no existe;
- falta `operationId`, `summary` o `tags`, o un `operationId` está repetido;
- una operación autenticada no documenta su 401, o hay públicas además de `/api/health`;
- falta declarar un parámetro de path, o una respuesta 2xx.

Es lo que impide que el spec y el código vuelvan a divergir. Corre con `npm test`.

### Contrato de errores

Toda respuesta de error tiene la misma forma, producida por `middleware/errorHandler.ts`:

```jsonc
{ "error": "Solo el creador puede iniciar el viaje", "code": "NOT_CREATOR" }
```

`error` es texto en español apto para mostrar al usuario; `code` es un identificador estable
para que el cliente ramifique lógica. Los errores de validación Zod agregan `details` con el
resultado de `flatten()`. El catálogo completo de códigos está en el schema `ErrorCode` del spec.

### Autenticación

Todos los endpoints salvo `GET /api/health` exigen el header:

```
Authorization: Bearer <Firebase ID token>
```

El backend verifica el token contra Firebase, resuelve el `Usuario` local a partir del
`firebase_uid` y expone su UUID como `req.userId`. Los WebSockets usan el mismo token en el
handshake (ver [`docs/websockets.md`](docs/websockets.md)).

### GeoJSON (contrato)

- `Point`: `{ "type": "Point", "coordinates": [lng, lat] }`
- `LineString`: `{ "type": "LineString", "coordinates": [[lng, lat], ...] }` (mínimo 2 puntos)

**Atención al orden**: GeoJSON usa longitud primero, al revés de la convención habitual
`lat, lng`. Los cálculos espaciales se delegan a PostGIS.

---

## Flujo de un evento WebSocket

```
Cliente emite evento
    └── Socket.io Server
            └── sockets/auth.ts (verifica el Firebase ID token del handshake)
                    └── sockets/index.ts (handler registrado, payload validado con Zod)
                            └── modules/viajes/viajes.service.ts (misma lógica que REST)
                                    └── io.to('viaje:<id>').emit(...) → integrantes de la sala
```

Especificación completa de los 7 eventos: [`docs/websockets.md`](docs/websockets.md).
