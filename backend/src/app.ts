import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { router } from './routes'
import { errorHandler } from './middleware/errorHandler'

/** App Express sin Socket.io ni listen — útil para tests HTTP. */
export function createApp() {
  const app = express()
  app.use(helmet())
  app.use(cors({ origin: true }))
  // GeoJSON LineString de rutas OSM/OSRM supera el default 100kb (p. ej. ~170kb).
  app.use(express.json({ limit: '2mb' }))
  app.use('/api', router)
  app.use(errorHandler)
  return app
}
