import type { Server } from 'socket.io'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { HttpError } from '../lib/httpError'
import { ViajesService } from '../modules/viajes/viajes.service'
import { socketRequireUser } from './auth'

const joinPayload = z.object({
  viajeId: z.string().uuid(),
})

const gpsPingSchema = z.object({
  viajeId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().optional(),
  recordedAt: z.string().datetime(),
  source: z.enum(['live', 'offline_sync']).optional().default('live'),
})

const viajesService = new ViajesService(prisma)

export function registerSocketHandlers(io: Server): void {
  io.use(socketRequireUser)

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id} user=${socket.data.userId}`)

    socket.on('join_viaje', (payload: unknown) => {
      const p = joinPayload.safeParse(payload)
      if (!p.success) return
      void socket.join(`viaje:${p.data.viajeId}`)
    })

    socket.on('leave_viaje', (payload: unknown) => {
      const p = joinPayload.safeParse(payload)
      if (!p.success) return
      void socket.leave(`viaje:${p.data.viajeId}`)
    })

    socket.on('viaje:gps_ping', (payload: unknown, ack?: (r: unknown) => void) => {
      const p = gpsPingSchema.safeParse(payload)
      if (!p.success) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD' })
        return
      }
      void viajesService
        .registrarPingUbicacion(socket.data.userId, p.data)
        .then(() => ack?.({ ok: true }))
        .catch((err: unknown) => {
          const msg = err instanceof HttpError ? err.message : 'ERROR'
          ack?.({ ok: false, error: msg })
        })
    })

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
    })
  })
}
