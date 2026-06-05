import type { Request, RequestHandler, Response } from 'express'
import {
  abandonarGrupoSchema,
  cambiarRolMiembroSchema,
  createGrupoSchema,
  grupoIdParamSchema,
  miembroParamsSchema,
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

    viajesPlanificados: asyncHandler(async (req, res) => {
      const { grupoId } = grupoIdParamSchema.parse(req.params)
      const viajes = await service.listarViajesPlanificados(req.userId!, grupoId)
      res.json(viajes)
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
