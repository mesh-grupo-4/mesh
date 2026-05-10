import type { Socket } from 'socket.io'
import { z } from 'zod'

const uuid = z.string().uuid()

export function socketRequireUser(socket: Socket, next: (err?: Error) => void): void {
  const raw = socket.handshake.headers['x-user-id']
  const id = Array.isArray(raw) ? raw[0] : raw
  const parsed = uuid.safeParse(id)
  if (!parsed.success) {
    next(new Error('UNAUTHORIZED'))
    return
  }
  socket.data.userId = parsed.data
  next()
}
