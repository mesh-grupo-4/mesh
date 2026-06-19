import type { Request, RequestHandler, Response } from 'express'
import {
  actualizarViajeSchema,
  createViajeSchema,
  postPosicionesSchema,
  putRutaSchema,
  responderInvitacionViajeSchema,
  upsertUbicacionVivaSchema,
} from './viajes.schemas'
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

    listarPlanificados: asyncHandler(async (req, res) => {
      const viajes = await service.listarPlanificados(req.userId!)
      res.json(viajes)
    }),

    listarFinalizados: asyncHandler(async (req, res) => {
      const viajes = await service.listarFinalizados(req.userId!)
      res.json(viajes)
    }),

    listarInvitacionesPendientes: asyncHandler(async (req, res) => {
      const invitaciones = await service.listarInvitacionesPendientes(req.userId!)
      res.json(invitaciones)
    }),

    enCurso: asyncHandler(async (req, res) => {
      const viaje = await service.viajeEnCurso(req.userId!)
      res.json(viaje)
    }),

    estadisticas: asyncHandler(async (req, res) => {
      const stats = await service.estadisticasUsuario(req.userId!)
      res.json(stats)
    }),

    responderInvitacion: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const body = responderInvitacionViajeSchema.parse(req.body)
      const result = await service.responderInvitacion(req.userId!, viajeId, body)
      res.json(result)
    }),

    listarParticipantes: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const participantes = await service.listarParticipantes(req.userId!, viajeId)
      res.json(participantes)
    }),

    detalle: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const viaje = await service.detalleParaUsuario(req.userId!, viajeId)
      res.json(viaje)
    }),

    actualizar: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const body = actualizarViajeSchema.parse(req.body)
      const viaje = await service.actualizarViaje(req.userId!, viajeId, body)
      res.json(viaje)
    }),

    ingresarPosiciones: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const body = postPosicionesSchema.parse(req.body)
      const out = await service.ingresarPosiciones(req.userId!, viajeId, body)
      res.status(201).json(out)
    }),

    upsertUbicacionViva: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const body = upsertUbicacionVivaSchema.parse(req.body)
      const out = await service.upsertUbicacionViva(req.userId!, viajeId, body)
      res.json(out)
    }),

    listarUbicacionesVivas: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const out = await service.listarUbicacionesVivas(req.userId!, viajeId)
      res.json(out)
    }),

    obtenerRuta: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const ruta = await service.obtenerRuta(req.userId!, viajeId)
      res.json(ruta)
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

    unirseQr: asyncHandler(async (req, res) => {
      const viajeId = req.params.viajeId as string
      const result = await service.unirsePorQr(req.userId!, viajeId)
      res.json(result)
    }),
  }
}
