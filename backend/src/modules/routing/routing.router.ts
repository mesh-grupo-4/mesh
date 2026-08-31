import { Router } from 'express'
import { requireUser } from '../../middleware/requireUser'
import { crearRoutingController } from './routing.controller'
import { RoutingService } from './routing.service'

const service = new RoutingService()
const c = crearRoutingController(service)

export const routingRouter = Router()

routingRouter.post('/calcular', requireUser, c.calcular)
