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
    getMe: asyncHandler(async (req, res) => {
      const usuario = await service.getMe(req.userId!)
      if (!usuario) {
        res.status(404).json({ error: 'Usuario no encontrado' })
        return
      }
      res.json(usuario)
    }),

    sync: asyncHandler(async (req, res) => {
      const body = syncUsuarioSchema.parse(req.body)
      const usuario = await service.sync(req.userId!, body)
      res.status(200).json(usuario)
    }),

    upsertPushToken: asyncHandler(async (req, res) => {
      const { token } = req.body as { token?: unknown }
      if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'token requerido' })
        return
      }
      await service.upsertPushToken(req.userId!, token)
      res.json({ ok: true })
    }),
  }
}
