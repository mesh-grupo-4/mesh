import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { UsuariosService } from './usuarios.service'
import { crearUsuariosController } from './usuarios.controller'
import { privacidadUsuarioHandlers } from '../privacidad/privacidad.router'

const service = new UsuariosService(prisma)
const c = crearUsuariosController(service)

export const usuariosRouter = Router()

usuariosRouter.get('/me', requireUser, c.getMe)
usuariosRouter.post('/sync', requireUser, c.sync)
usuariosRouter.put('/push-token', requireUser, c.upsertPushToken)

// Privacidad de geolocalización (RN-110 a RN-113).
usuariosRouter.get('/me/privacidad', ...privacidadUsuarioHandlers.obtener)
usuariosRouter.put('/me/privacidad', ...privacidadUsuarioHandlers.actualizar)
usuariosRouter.get('/me/accesos-ubicacion', ...privacidadUsuarioHandlers.accesos)
