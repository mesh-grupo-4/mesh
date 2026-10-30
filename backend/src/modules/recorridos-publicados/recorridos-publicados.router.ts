import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearRecorridosPublicadosController } from './recorridos-publicados.controller'
import { RecorridosPublicadosService } from './recorridos-publicados.service'

const service = new RecorridosPublicadosService(prisma)
const c = crearRecorridosPublicadosController(service)

export const recorridosPublicadosRouter = Router()

recorridosPublicadosRouter.get('/', requireUser, c.listar)
// Antes que '/:recorridoId': si no, "mios" se interpretaría como un id.
recorridosPublicadosRouter.get('/mios', requireUser, c.mios)
recorridosPublicadosRouter.get('/:recorridoId', requireUser, c.obtener)
recorridosPublicadosRouter.post('/:recorridoId/importaciones', requireUser, c.importar)
recorridosPublicadosRouter.post('/:recorridoId/valoracion', requireUser, c.valorar)

/** Publicar/despublicar cuelgan del viaje: se montan desde viajes.router. */
export const recorridoPublicadoViajeHandlers = {
  publicar: c.publicar,
  despublicar: c.despublicar,
}
