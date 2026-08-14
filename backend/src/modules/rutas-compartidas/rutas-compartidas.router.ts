import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { RutasCompartidasService } from './rutas-compartidas.service'
import { crearRutasCompartidasController } from './rutas-compartidas.controller'

const service = new RutasCompartidasService(prisma)
const c = crearRutasCompartidasController(service)

export const rutasCompartidasRouter = Router()
export const rutasPlantillaRouter = Router()

rutasCompartidasRouter.get('/:token', requireUser, c.preview)
rutasCompartidasRouter.post('/:token/importaciones', requireUser, c.importar)

rutasPlantillaRouter.get('/', requireUser, c.listarPlantillas)
rutasPlantillaRouter.get('/:plantillaId', requireUser, c.obtenerPlantilla)
rutasPlantillaRouter.delete('/:plantillaId', requireUser, c.eliminarPlantilla)

/** Handlers reutilizados desde el router de viajes. */
export const rutasCompartirHandlers = {
  compartir: c.compartir,
  revocar: c.revocar,
}

export { service as rutasCompartidasService }
