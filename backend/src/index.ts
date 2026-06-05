import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'

import { router } from './routes'
import { registerSocketHandlers } from './sockets'
import { setIo } from './realtime/ioRegistry'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const httpServer = createServer(app)

const isDev = process.env.NODE_ENV !== 'production'

const corsOptions = isDev
  ? {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }
  : {
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }

const io = new Server(httpServer, {
  cors: corsOptions,
})

setIo(io)

app.use(helmet())
app.use(cors(corsOptions))
app.use(express.json())

app.use('/api', router)

app.use(errorHandler)

registerSocketHandlers(io)

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`)
  if (isDev) {
    console.log('Expo Go: el frontend usará la IP de Metro + puerto 3000')
  }
})

export { io }
