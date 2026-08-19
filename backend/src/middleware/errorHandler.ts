import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../lib/httpError'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
    })
    return
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.too.large'
  ) {
    res.status(413).json({
      error: 'El trazado de la ruta es demasiado grande. Simplificá el recorrido o acortalo.',
      code: 'PAYLOAD_TOO_LARGE',
    })
    return
  }
  if (err instanceof ZodError) {
    const fechaPasada = err.issues.find(
      (i) => i.path.includes('fechaProgramada') && i.message.includes('futura')
    )
    if (fechaPasada) {
      res.status(400).json({
        error: fechaPasada.message,
        code: 'FECHA_PASADA',
      })
      return
    }
    res.status(400).json({
      error: 'Validación fallida',
      code: 'VALIDATION_ERROR',
      details: err.flatten(),
    })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' })
}
