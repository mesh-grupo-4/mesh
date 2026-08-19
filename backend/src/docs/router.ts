import { Router } from 'express'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import { openapiSpec } from './index'

/**
 * Router de documentación interactiva.
 *
 * - `GET /api/docs`      → Swagger UI
 * - `GET /api/docs.json` → spec OpenAPI crudo (para clientes, Postman o codegen)
 */
export const docsRouter = Router()

/**
 * Swagger UI necesita estilos y un script inline que la Content-Security-Policy
 * por defecto de helmet bloquea. En vez de desactivar la CSP —lo que dejaría la
 * página sin ninguna protección—, se define una política propia y acotada a este
 * sub-router: mismo origen para todo, `unsafe-inline` únicamente donde la UI lo
 * exige, y `object-src 'none'`. El header se reescribe sobre el que puso el
 * helmet global de `src/app.ts`, sin alterarlo para el resto de la API.
 */
docsRouter.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'self'"],
      },
    },
  })
)

docsRouter.get('/docs.json', (_req, res) => {
  res.json(openapiSpec)
})

docsRouter.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'Mesh API — Documentación',
    swaggerOptions: {
      // Con 55 endpoints, expandir todo de entrada vuelve la página inmanejable:
      // se listan las operaciones plegadas y agrupadas por tag.
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  })
)
