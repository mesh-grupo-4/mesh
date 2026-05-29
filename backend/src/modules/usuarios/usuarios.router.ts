import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { UsuariosService } from './usuarios.service'
import { crearUsuariosController } from './usuarios.controller'

const service = new UsuariosService(prisma)
const c = crearUsuariosController(service)

export const usuariosRouter = Router()

usuariosRouter.post('/sync', c.sync)
