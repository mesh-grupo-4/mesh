import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearAmistadesController } from './amistades.controller'
import { AmistadesService } from './amistades.service'

const service = new AmistadesService(prisma)
const c = crearAmistadesController(service)

export const amistadesRouter = Router()

amistadesRouter.get('/', requireUser, c.listarAmigos)
amistadesRouter.get('/buscar', requireUser, c.buscarUsuarios)
amistadesRouter.get('/solicitudes/pendientes', requireUser, c.solicitudesPendientes)
amistadesRouter.post('/solicitar', requireUser, c.solicitar)
amistadesRouter.post('/solicitudes/:solicitudId/responder', requireUser, c.responderSolicitud)
amistadesRouter.delete('/:usuarioId', requireUser, c.eliminarAmigo)
