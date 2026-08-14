import 'dotenv/config'
import './config/timezone'
import { createServer } from 'http'
import { Server } from 'socket.io'

import { createApp } from './app'
import { registerSocketHandlers } from './sockets'
import { setIo } from './realtime/ioRegistry'

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

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`)
  if (isDev) {
    console.log('Expo Go: el frontend usará la IP de Metro + puerto 3000')
  }
})

export { io, app }
