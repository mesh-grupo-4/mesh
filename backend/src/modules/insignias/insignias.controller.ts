import type { Request, RequestHandler, Response } from 'express'
import type { InsigniasService } from './insignias.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearInsigniasController(service: InsigniasService) {
  return {
    catalogo: asyncHandler(async (_req, res) => {
      const insignias = await service.listarCatalogo()
      res.json(insignias)
    }),

    mias: asyncHandler(async (req, res) => {
      const insignias = await service.listarDeUsuario(req.userId!)
      res.json(insignias)
    }),

    deUsuario: asyncHandler(async (req, res) => {
      const insignias = await service.listarDeUsuario(req.params.usuarioId as string)
      res.json(insignias)
    }),
  }
}
