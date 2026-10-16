import type { RequestHandler } from 'express'

/**
 * RN-120/RN-030: guard del backoffice. Va siempre después de `requireUser`, que
 * resuelve `req.rolSistema` desde la base: el rol nunca se toma de un claim del
 * token ni de nada que mande el cliente.
 */
export const requireSuperadmin: RequestHandler = (req, res, next) => {
  if (req.rolSistema !== 'superadmin') {
    res.status(403).json({
      error: 'Esta acción requiere rol de superadministrador',
      code: 'NOT_SUPERADMIN',
    })
    return
  }
  next()
}
