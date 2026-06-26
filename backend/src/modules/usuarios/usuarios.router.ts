import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { UsuariosService } from './usuarios.service'
import { crearUsuariosController } from './usuarios.controller'

const service = new UsuariosService(prisma)
const c = crearUsuariosController(service)

export const usuariosRouter = Router()

usuariosRouter.get('/me', requireUser, c.getMe)
usuariosRouter.post('/sync', requireUser, c.sync)
usuariosRouter.put('/push-token', requireUser, c.upsertPushToken)
