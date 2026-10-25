import type { Request, RequestHandler, Response } from 'express'
import { obtenerTablaPosicionesQuery } from './tabla-posiciones.schemas'
import type { TablaPosicionesService } from './tabla-posiciones.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearTablaPosicionesController(service: TablaPosicionesService) {
  return {
    obtener: asyncHandler(async (req, res) => {
      const q = obtenerTablaPosicionesQuery.parse(req.query)
      const tabla = await service.obtener(req.userId!, q.tipoActividad, q.periodo, q.orden)
      res.json(tabla)
    }),
  }
}
