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
  try {
    const decoded = await firebaseAuth.verifyIdToken(token)
    const usuario = await findOrCreateByFirebaseUid(decoded.uid)
    req.userId = usuario.id
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
