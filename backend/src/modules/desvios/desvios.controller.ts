import type { Request, RequestHandler, Response } from 'express'
import type { DesviosService } from './desvios.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearDesviosController(service: DesviosService) {
  return {
    estado: asyncHandler(async (req, res) => {
      res.json(await service.estado(req.userId!, req.params.viajeId as string))
    }),

    confirmar: asyncHandler(async (req, res) => {
      res.json(await service.confirmar(req.userId!, req.params.viajeId as string))
    }),

    rechazar: asyncHandler(async (req, res) => {
      res.json(await service.rechazar(req.userId!, req.params.viajeId as string))
    }),

    voluntario: asyncHandler(async (req, res) => {
      await service.desvioVoluntario(req.userId!, req.params.viajeId as string)
      res.status(204).end()
    }),
  }
}
