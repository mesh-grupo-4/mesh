import { Router } from 'express'
import { googleMapsApiKey } from '../../config/googleMaps'
import { requireUser } from '../../middleware/requireUser'
import { crearLugaresController } from './lugares.controller'
import { LugaresService } from './lugares.service'

const service = new LugaresService(googleMapsApiKey())
const c = crearLugaresController(service)

export const lugaresRouter = Router()

lugaresRouter.post('/en-ruta', requireUser, c.enRuta)
lugaresRouter.get('/cercanos', requireUser, c.cercanos)
