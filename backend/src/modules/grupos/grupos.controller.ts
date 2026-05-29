import type { Request, RequestHandler, Response } from 'express'
import { createGrupoSchema } from './grupos.schemas'
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
      const grupoId = req.params.grupoId as string
      const grupo = await service.detalleParaMiembro(req.userId!, grupoId)
      res.json(grupo)
    }),
  }
}
