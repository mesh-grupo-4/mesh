import type { Request, RequestHandler, Response } from 'express'
import {
  iniciarParadaSchema,
  responderSolicitudSchema,
  solicitarParadaSchema,
} from './paradas.schemas'
import type { ParadasService } from './paradas.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearParadasController(service: ParadasService) {
  return {
    iniciar: asyncHandler(async (req, res) => {
      const body = iniciarParadaSchema.parse(req.body)
      const parada = await service.iniciarParada(req.userId!, (req.params.viajeId as string), body)
      res.status(201).json(parada)
    }),

    finalizar: asyncHandler(async (req, res) => {
      const parada = await service.finalizarParada(req.userId!, (req.params.viajeId as string))
      res.json(parada)
    }),

    activa: asyncHandler(async (req, res) => {
      const parada = await service.miParadaActiva(req.userId!, (req.params.viajeId as string))
      res.json(parada)
    }),

    solicitar: asyncHandler(async (req, res) => {
      const body = solicitarParadaSchema.parse(req.body ?? {})
      const solicitud = await service.solicitarParada(req.userId!, (req.params.viajeId as string), body)
      res.status(201).json(solicitud)
    }),

    listarSolicitudes: asyncHandler(async (req, res) => {
      const solicitudes = await service.listarSolicitudes(req.userId!, (req.params.viajeId as string))
      res.json(solicitudes)
    }),

    responderSolicitud: asyncHandler(async (req, res) => {
      const body = responderSolicitudSchema.parse(req.body)
      const solicitud = await service.responderSolicitud(
        req.userId!,
        (req.params.viajeId as string),
        (req.params.solicitudId as string),
        body
      )
      res.json(solicitud)
    }),

    cancelarSolicitud: asyncHandler(async (req, res) => {
      const solicitud = await service.cancelarSolicitud(
        req.userId!,
        (req.params.viajeId as string),
        (req.params.solicitudId as string)
      )
      res.json(solicitud)
    }),
  }
}
