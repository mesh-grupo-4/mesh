import type { Request, RequestHandler, Response } from 'express'
import { calcularRutaSchema } from './routing.schemas'
import type { RoutingService } from './routing.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearRoutingController(service: RoutingService) {
  return {
    calcular: asyncHandler(async (req, res) => {
      const input = calcularRutaSchema.parse(req.body)
      const ruta = await service.calcularRuta(input)
      res.json(ruta)
    }),
  }
}
