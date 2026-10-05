import type { Request, RequestHandler, Response } from 'express'
import {
  actualizarPrivacidadUsuarioSchema,
  actualizarPrivacidadViajeSchema,
} from './privacidad.schemas'
import type { PrivacidadService } from './privacidad.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearPrivacidadController(service: PrivacidadService) {
  return {
    miPrivacidad: asyncHandler(async (req, res) => {
      res.json(await service.miPrivacidad(req.userId!))
    }),

    actualizarMiPrivacidad: asyncHandler(async (req, res) => {
      const body = actualizarPrivacidadUsuarioSchema.parse(req.body)
      res.json(await service.actualizarMiPrivacidad(req.userId!, body))
    }),

    misAccesos: asyncHandler(async (req, res) => {
      res.json(await service.misAccesos(req.userId!))
    }),

    privacidadViaje: asyncHandler(async (req, res) => {
      res.json(await service.privacidadViaje(req.userId!, req.params.viajeId as string))
    }),

    actualizarPrivacidadViaje: asyncHandler(async (req, res) => {
      const body = actualizarPrivacidadViajeSchema.parse(req.body)
      res.json(
        await service.actualizarPrivacidadViaje(req.userId!, req.params.viajeId as string, body)
      )
    }),

    accesosViaje: asyncHandler(async (req, res) => {
      res.json(await service.accesosViaje(req.userId!, req.params.viajeId as string))
    }),
  }
}
