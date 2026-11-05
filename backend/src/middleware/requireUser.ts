import type { RequestHandler } from 'express'
import { firebaseAuth } from '../config/firebase'
import { findOrCreateByFirebaseUid } from '../modules/usuarios/usuarios.service'

function esUsuarioFirebaseInexistente(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: unknown }).code === 'auth/user-not-found'
  )
}

// RN-030: el backend valida identidad vía Firebase ID Token.
export const requireUser: RequestHandler = async (req, res, next) => {
  const authHeader = req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Se requiere header Authorization: Bearer <token>',
      code: 'UNAUTHENTICATED',
    })
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
    res.status(401).json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' })
    return
  }

  try {
    const usuario = await findOrCreateByFirebaseUid(decoded.uid)
    // RN-123: una cuenta suspendida no opera, aunque su token de Firebase siga vigente
    // (el ID token dura hasta 1 h después de deshabilitarla en Firebase).
    if (usuario.suspendido_at) {
      res.status(403).json({
        error: 'Tu cuenta está suspendida. Contactá al soporte de Mesh.',
        code: 'ACCOUNT_SUSPENDED',
      })
      return
    }
    req.userId = usuario.id
    req.rolSistema = usuario.rol_sistema
    next()
  } catch (err) {
    // RN-124: cuenta eliminada por un superadmin con un ID token todavía vigente.
    if (esUsuarioFirebaseInexistente(err)) {
      res.status(401).json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' })
      return
    }
    console.error('[requireUser] Error al resolver usuario:', err)
    res.status(500).json({
      error: 'Error interno al resolver usuario',
      code: 'AUTH_RESOLUTION_FAILED',
    })
  }
}
