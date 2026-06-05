import type { Request, RequestHandler, Response } from 'express'
import {
  abandonarGrupoSchema,
  buscarUsuariosQuerySchema,
  cambiarRolMiembroSchema,
  createGrupoSchema,
  grupoIdParamSchema,
  invitacionIdParamSchema,
  invitarDesdeGruposSchema,
  invitarUsuariosSchema,
  miembroParamsSchema,
  responderInvitacionSchema,
} from './grupos.schemas'
import type { GruposService } from './grupos.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearGruposController(service: GruposService) {
  return {
    listar: asyncHandler(async (req, res) => {
      const grupos = await service.listarParaUsuario(req.userId!)
      res.json(grupos)
    }),

    invitacionesPendientes: asyncHandler(async (req, res) => {
      const invitaciones = await service.listarInvitacionesPendientes(req.userId!)
      res.json(invitaciones)
    }),

    responderInvitacion: asyncHandler(async (req, res) => {
      const { invitacionId } = invitacionIdParamSchema.parse(req.params)
      const body = responderInvitacionSchema.parse(req.body)
      const result = await service.responderInvitacion(req.userId!, invitacionId, body)
      res.json(result)
    }),

    crear: asyncHandler(async (req, res) => {
      const body = createGrupoSchema.parse(req.body)
      const grupo = await service.crearGrupo(req.userId!, body)
      res.status(201).json(grupo)
    }),

    detalle: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const grupo = await service.detalleParaMiembro(req.userId!, grupoId)
      res.json(grupo)
    }),

    miembros: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const miembros = await service.listarMiembros(req.userId!, grupoId)
      res.json(miembros)
    }),

    cambiarRol: asyncHandler(async (req, res) => {
      const { grupoId, usuarioId } = miembroParamsSchema.parse(req.params)
      const body = cambiarRolMiembroSchema.parse(req.body)
      const result = await service.cambiarRolMiembro(req.userId!, grupoId, usuarioId, body)
      res.json(result)
    }),

    gruposParaInvitar: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const grupos = await service.listarGruposParaInvitar(req.userId!, grupoId)
      res.json(grupos)
    }),

    usuariosParaInvitar: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const usuarios = await service.listarUsuariosParaInvitar(req.userId!, grupoId)
      res.json(usuarios)
    }),

    amigosParaInvitar: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const amigos = await service.listarAmigosParaInvitar(req.userId!, grupoId)
      res.json(amigos)
    }),

    buscarUsuarios: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const { q } = buscarUsuariosQuerySchema.parse(req.query)
      const usuarios = await service.buscarUsuariosParaInvitar(req.userId!, grupoId, q)
      res.json(usuarios)
    }),

    invitarUsuarios: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const body = invitarUsuariosSchema.parse(req.body)
      const result = await service.invitarUsuarios(req.userId!, grupoId, body)
      res.status(201).json(result)
    }),

    invitarDesdeGrupos: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const body = invitarDesdeGruposSchema.parse(req.body)
      const result = await service.invitarDesdeGrupos(req.userId!, grupoId, body)
      res.status(201).json(result)
    }),

    abandonar: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const body = abandonarGrupoSchema.parse(req.body ?? {})
      const result = await service.abandonarGrupo(req.userId!, grupoId, body)
      res.json(result)
    }),

    eliminar: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const result = await service.eliminarGrupo(req.userId!, grupoId)
      res.json(result)
    }),
  }
}
