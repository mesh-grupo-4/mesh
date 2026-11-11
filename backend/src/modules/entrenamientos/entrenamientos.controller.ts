import type { Request, RequestHandler, Response } from 'express'
import {
  circuitoParamSchema,
  circuitoSesionParamSchema,
  listarCircuitosQuerySchema,
  listarSesionesQuerySchema,
  renombrarCircuitoSchema,
  sesionParamSchema,
} from './entrenamientos.schemas'
import type { EntrenamientosService } from './entrenamientos.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearEntrenamientosController(service: EntrenamientosService) {
  return {
    listarSesiones: asyncHandler(async (req, res) => {
      const q = listarSesionesQuerySchema.parse(req.query)
      res.json(await service.listarSesiones(req.userId!, q))
    }),

    obtenerSesion: asyncHandler(async (req, res) => {
      const { viajeId } = sesionParamSchema.parse(req.params)
      res.json(await service.obtenerSesion(req.userId!, viajeId))
    }),

    listarCircuitos: asyncHandler(async (req, res) => {
      const q = listarCircuitosQuerySchema.parse(req.query)
      res.json(await service.listarCircuitos(req.userId!, q))
    }),

    renombrarCircuito: asyncHandler(async (req, res) => {
      const { circuitoId } = circuitoParamSchema.parse(req.params)
      const { nombre } = renombrarCircuitoSchema.parse(req.body)
      res.json(await service.renombrarCircuito(req.userId!, circuitoId, nombre))
    }),

    sacarSesion: asyncHandler(async (req, res) => {
      const { circuitoId, viajeId } = circuitoSesionParamSchema.parse(req.params)
      await service.sacarSesion(req.userId!, circuitoId, viajeId)
      res.status(204).send()
    }),
  }
}
