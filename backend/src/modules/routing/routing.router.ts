import { Router, type RequestHandler } from 'express'
import { googleMapsApiKey } from '../../config/googleMaps'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { obtenerDuracionesVigentes } from '../paradas/duracionesParada'
import { crearRoutingController } from './routing.controller'
import { RoutingService } from './routing.service'

const service = new RoutingService(googleMapsApiKey())
const c = crearRoutingController(service)

/** RN-134: minutos promedio por categoría, para estimar el tiempo con paradas al planificar. */
const duracionesParada: RequestHandler = (_req, res, next) => {
  obtenerDuracionesVigentes(prisma)
    .then((minutos) => res.json({ minutos }))
    .catch(next)
}

export const routingRouter = Router()

routingRouter.post('/calcular', requireUser, c.calcular)
routingRouter.get('/duraciones-parada', requireUser, duracionesParada)
