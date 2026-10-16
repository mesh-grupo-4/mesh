import { Router } from 'express'
import { googleMapsApiKey } from '../../config/googleMaps'
import { requireUser } from '../../middleware/requireUser'
import { crearGeocodingController } from './geocoding.controller'
import { GeocodingService } from './geocoding.service'

const service = new GeocodingService(googleMapsApiKey())
const c = crearGeocodingController(service)

export const geocodingRouter = Router()

geocodingRouter.get('/buscar', requireUser, c.buscar)
geocodingRouter.get('/reverse', requireUser, c.reverse)
