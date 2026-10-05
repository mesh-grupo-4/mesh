import type { Request, RequestHandler, Response } from 'express'
import { alertaIdParamSchema, cambiarEstadoAlertaSchema, crearAlertaSchema } from './alertas.schemas'
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

    cambiarEstado: asyncHandler(async (req, res) => {
      const { viajeId, alertaId } = alertaIdParamSchema.parse(req.params)
      const body = cambiarEstadoAlertaSchema.parse(req.body)
      const alerta = await service.cambiarEstado(req.userId!, viajeId, alertaId, body)
      res.json(alerta)
    }),
  }
}
