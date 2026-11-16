import 'dotenv/config'
import './config/timezone'
import { createServer } from 'http'
import { Server } from 'socket.io'

import { createApp } from './app'
import { registerSocketHandlers } from './sockets'
import { setIo } from './realtime/ioRegistry'
import { iniciarJobRachas } from './jobs/rachasJob'

// Una promesa rechazada sin catch no tiene que tirar el proceso: se caerían los sockets
// y el estado en memoria del motor de eventos en medio de un viaje.
process.on('unhandledRejection', (motivo) => {
  console.error('[proceso] unhandledRejection:', motivo)
})
process.on('uncaughtException', (err) => {
  console.error('[proceso] uncaughtException:', err)
})

const app = createApp()
const httpServer = createServer(app)

const isDev = process.env.NODE_ENV !== 'production'

const corsOptions = isDev
  ? {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }
  : {
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }

const io = new Server(httpServer, {
  cors: corsOptions,
})

setIo(io)

registerSocketHandlers(io)

// RN-075: notifica rachas rotas por inactividad una vez por día.
iniciarJobRachas()

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`)
  if (isDev) {
    console.log('Expo Go: el frontend usará la IP de Metro + puerto 3000')
  }
})

export { io, app }
