import type { RequestHandler } from 'express'
import { firebaseAuth } from '../config/firebase'
import { findOrCreateByFirebaseUid } from '../modules/usuarios/usuarios.service'

// RN-030: el backend valida identidad vía Firebase ID Token.
export const requireUser: RequestHandler = async (req, res, next) => {
  const authHeader = req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Se requiere header Authorization: Bearer <token>' })
    return
  }

  const token = authHeader.slice(7)
  let decoded
  try {
    decoded = await firebaseAuth.verifyIdToken(token)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[requireUser] Token rechazado:', err instanceof Error ? err.message : err)
    }
    res.status(401).json({ error: 'Token inválido o expirado' })
    return
  }

  try {
    const usuario = await findOrCreateByFirebaseUid(decoded.uid)
    req.userId = usuario.id
    next()
  } catch (err) {
    console.error('[requireUser] Error al resolver usuario:', err)
    res.status(500).json({ error: 'Error interno al resolver usuario' })
  }
}
