import type { Request, RequestHandler, Response } from 'express'
import { crearAlertaSchema } from './alertas.schemas'
import type { AlertasService } from './alertas.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearAlertasController(service: AlertasService) {
  return {
    crear: asyncHandler(async (req, res) => {
      const body = crearAlertaSchema.parse(req.body)
      const alerta = await service.crear(req.userId!, req.params.viajeId as string, body)
      res.status(201).json(alerta)
    }),

    listar: asyncHandler(async (req, res) => {
      const alertas = await service.listar(req.userId!, req.params.viajeId as string)
      res.json(alertas)
    }),
  }
}
