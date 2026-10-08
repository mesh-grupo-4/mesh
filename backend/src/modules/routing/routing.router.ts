import { Router } from 'express'
import { googleMapsApiKey } from '../../config/googleMaps'
import { requireUser } from '../../middleware/requireUser'
import { crearRoutingController } from './routing.controller'
import { RoutingService } from './routing.service'

const service = new RoutingService(googleMapsApiKey())
const c = crearRoutingController(service)

export const routingRouter = Router()

routingRouter.post('/calcular', requireUser, c.calcular)
