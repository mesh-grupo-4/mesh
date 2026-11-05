import type { Request, RequestHandler, Response } from 'express'
import type { RachasService } from './rachas.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearRachasController(service: RachasService) {
  return {
    mia: asyncHandler(async (req, res) => {
      const racha = await service.obtenerRachaVigente(req.userId!)
      res.json(racha)
    }),

    deUsuario: asyncHandler(async (req, res) => {
      const racha = await service.obtenerRachaDeUsuario(req.params.usuarioId as string)
      res.json(racha)
    }),
  }
}
