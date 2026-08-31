import { Router } from 'express'
import { requireUser } from '../../middleware/requireUser'
import { crearGeocodingController } from './geocoding.controller'
import { GeocodingService } from './geocoding.service'

const service = new GeocodingService()
const c = crearGeocodingController(service)

export const geocodingRouter = Router()

geocodingRouter.get('/buscar', requireUser, c.buscar)
geocodingRouter.get('/reverse', requireUser, c.reverse)
