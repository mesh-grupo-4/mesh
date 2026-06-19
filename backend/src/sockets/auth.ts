import type { Socket } from 'socket.io'
import { firebaseAuth } from '../config/firebase'
import { findOrCreateByFirebaseUid } from '../modules/usuarios/usuarios.service'

function extractBearerToken(socket: Socket): string | null {
  const authHeader = socket.handshake.headers['authorization']
  const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader
  if (rawHeader?.startsWith('Bearer ')) {
    return rawHeader.slice(7)
  }

  const auth = socket.handshake.auth as { token?: string; authorization?: string } | undefined
  if (typeof auth?.token === 'string' && auth.token.length > 0) {
    return auth.token.startsWith('Bearer ') ? auth.token.slice(7) : auth.token
  }
  if (typeof auth?.authorization === 'string' && auth.authorization.startsWith('Bearer ')) {
    return auth.authorization.slice(7)
  }

  return null
}

export async function socketRequireUser(socket: Socket, next: (err?: Error) => void): Promise<void> {
  const token = extractBearerToken(socket)
  if (!token) {
    next(new Error('UNAUTHORIZED'))
    return
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(token)
    const usuario = await findOrCreateByFirebaseUid(decoded.uid)
    socket.data.userId = usuario.id
    next()
  } catch {
    next(new Error('UNAUTHORIZED'))
  }
}
