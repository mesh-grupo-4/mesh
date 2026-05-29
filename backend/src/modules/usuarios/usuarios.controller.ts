import type { Request, RequestHandler, Response } from 'express'
import { syncUsuarioSchema } from './usuarios.schemas'
import type { UsuariosService } from './usuarios.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearUsuariosController(service: UsuariosService) {
  return {
    sync: asyncHandler(async (req, res) => {
      const body = syncUsuarioSchema.parse(req.body)
      const usuario = await service.sync(body)
      res.status(200).json(usuario)
    }),
  }
}
