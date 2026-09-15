import type { Request, RequestHandler, Response } from 'express'
import { fantasmaQuerySchema, viajeIdParamSchema } from '../viajes/viajes.schemas'
import type { FantasmaService } from './fantasma.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearFantasmaController(service: FantasmaService) {
  return {
    candidatos: asyncHandler(async (req, res) => {
      const { viajeId } = viajeIdParamSchema.parse(req.params)
      res.json(await service.listarCandidatos(req.userId!, viajeId))
    }),
    obtener: asyncHandler(async (req, res) => {
      const { viajeId } = viajeIdParamSchema.parse(req.params)
      const q = fantasmaQuerySchema.parse(req.query)
      res.json(await service.obtener(req.userId!, viajeId, q))
    }),
  }
}
