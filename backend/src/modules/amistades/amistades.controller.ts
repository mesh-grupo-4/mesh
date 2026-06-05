import type { Request, RequestHandler, Response } from 'express'
import {
  amigoUsuarioIdParamSchema,
  buscarUsuariosAmistadQuerySchema,
  responderSolicitudAmistadSchema,
  solicitarAmistadSchema,
  solicitudIdParamSchema,
} from './amistades.schemas'
import type { AmistadesService } from './amistades.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearAmistadesController(service: AmistadesService) {
  return {
    listarAmigos: asyncHandler(async (req, res) => {
      const amigos = await service.listarAmigos(req.userId!)
      res.json(amigos)
    }),

    solicitudesPendientes: asyncHandler(async (req, res) => {
      const solicitudes = await service.listarSolicitudesPendientes(req.userId!)
      res.json(solicitudes)
    }),

    solicitar: asyncHandler(async (req, res) => {
      const body = solicitarAmistadSchema.parse(req.body)
      const result = await service.solicitarAmistad(req.userId!, body)
      res.status(201).json(result)
    }),

    responderSolicitud: asyncHandler(async (req, res) => {
      const { solicitudId } = solicitudIdParamSchema.parse(req.params)
      const body = responderSolicitudAmistadSchema.parse(req.body)
      const result = await service.responderSolicitud(req.userId!, solicitudId, body)
      res.json(result)
    }),

    buscarUsuarios: asyncHandler(async (req, res) => {
      const { q } = buscarUsuariosAmistadQuerySchema.parse(req.query)
      const usuarios = await service.buscarUsuarios(req.userId!, q)
      res.json(usuarios)
    }),

    eliminarAmigo: asyncHandler(async (req, res) => {
      const { usuarioId } = amigoUsuarioIdParamSchema.parse(req.params)
      const result = await service.eliminarAmigo(req.userId!, usuarioId)
      res.json(result)
    }),
  }
}
