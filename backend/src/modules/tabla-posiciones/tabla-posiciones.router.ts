import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearTablaPosicionesController } from './tabla-posiciones.controller'
import { TablaPosicionesService } from './tabla-posiciones.service'

const service = new TablaPosicionesService(prisma)
const c = crearTablaPosicionesController(service)

export const tablaPosicionesRouter = Router()

tablaPosicionesRouter.get('/', requireUser, c.obtener)
