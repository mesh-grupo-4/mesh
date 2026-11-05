import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearInsigniasController } from './insignias.controller'
import { InsigniasService } from './insignias.service'

const service = new InsigniasService(prisma)
const c = crearInsigniasController(service)

export const insigniasRouter = Router()

insigniasRouter.get('/', requireUser, c.catalogo)
insigniasRouter.get('/mias', requireUser, c.mias)
insigniasRouter.get('/usuario/:usuarioId', requireUser, c.deUsuario)
