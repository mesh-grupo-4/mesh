import type { RequestHandler } from 'express'
import { z } from 'zod'

const uuid = z.string().uuid()

/**
 * RN-030: el backend exige identidad; reemplazar por Firebase Auth cuando esté listo.
 */
export const requireUser: RequestHandler = (req, res, next) => {
  const raw = req.header('x-user-id')
  const parsed = uuid.safeParse(raw)
  if (!parsed.success) {
    res.status(401).json({
      error: 'Se requiere header x-user-id con un UUID válido',
    })
    return
  }
  req.userId = parsed.data
  next()
}
