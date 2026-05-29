import type { Socket } from 'socket.io'
import { firebaseAuth } from '../config/firebase'
import { findOrCreateByFirebaseUid } from '../modules/usuarios/usuarios.service'

export async function socketRequireUser(socket: Socket, next: (err?: Error) => void): Promise<void> {
  const authHeader = socket.handshake.headers['authorization']
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader

  if (!raw?.startsWith('Bearer ')) {
    next(new Error('UNAUTHORIZED'))
    return
  }

  const token = raw.slice(7)
  try {
    const decoded = await firebaseAuth.verifyIdToken(token)
    const usuario = await findOrCreateByFirebaseUid(decoded.uid)
    socket.data.userId = usuario.id
    next()
  } catch {
    next(new Error('UNAUTHORIZED'))
  }
}
