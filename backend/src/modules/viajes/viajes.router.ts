import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { ViajesService } from './viajes.service'
import { crearViajesController } from './viajes.controller'

const service = new ViajesService(prisma)
const c = crearViajesController(service)

export const viajesRouter = Router()

viajesRouter.post('/', requireUser, c.crear)
viajesRouter.get('/:viajeId', requireUser, c.detalle)
viajesRouter.post('/:viajeId/posiciones', requireUser, c.ingresarPosiciones)
viajesRouter.put('/:viajeId/ruta', requireUser, c.guardarRuta)
viajesRouter.post('/:viajeId/iniciar', requireUser, c.iniciar)
viajesRouter.post('/:viajeId/finalizar', requireUser, c.finalizar)
