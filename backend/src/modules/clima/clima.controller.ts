import type { Request, RequestHandler, Response } from 'express'
import { viajeIdParamSchema } from '../viajes/viajes.schemas'
import type { ClimaService } from './clima.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearClimaController(service: ClimaService) {
  return {
    obtener: asyncHandler(async (req, res) => {
      const { viajeId } = viajeIdParamSchema.parse(req.params)
      res.json(await service.obtenerParaViaje(req.userId!, viajeId))
    }),
  }
}
