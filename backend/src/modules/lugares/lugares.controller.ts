import type { Request, RequestHandler, Response } from 'express'
import { buscarCercanosQuerySchema, buscarEnRutaSchema } from './lugares.schemas'
import type { LugaresService } from './lugares.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearLugaresController(service: LugaresService) {
  return {
    enRuta: asyncHandler(async (req, res) => {
      const input = buscarEnRutaSchema.parse(req.body)
      res.json(await service.buscarEnRuta(input))
    }),

    cercanos: asyncHandler(async (req, res) => {
      const query = buscarCercanosQuerySchema.parse(req.query)
      res.json(await service.buscarCercanos(query))
    }),
  }
}
