import type { Request, RequestHandler, Response } from 'express'
import { createViajeSchema, postPosicionesSchema, putRutaSchema } from './viajes.schemas'
import type { ViajesService } from './viajes.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearViajesController(service: ViajesService) {
  return {
    crear: asyncHandler(async (req, res) => {
      const body = createViajeSchema.parse(req.body)
      const viaje = await service.crearViaje(req.userId!, body)
      res.status(201).json(viaje)
    }),

    detalle: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const viaje = await service.detalleParaUsuario(req.userId!, viajeId)
      res.json(viaje)
    }),

    ingresarPosiciones: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const body = postPosicionesSchema.parse(req.body)
      const out = await service.ingresarPosiciones(req.userId!, viajeId, body)
      res.status(201).json(out)
    }),

    guardarRuta: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const body = putRutaSchema.parse(req.body)
      const ruta = await service.guardarRuta(req.userId!, viajeId, body)
      res.json(ruta)
    }),

    iniciar: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const viaje = await service.iniciar(req.userId!, viajeId)
      res.json(viaje)
    }),

    finalizar: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const viaje = await service.finalizar(req.userId!, viajeId)
      res.json(viaje)
    }),
  }
}
