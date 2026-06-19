import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { ViajesService } from './viajes.service'
import { crearViajesController } from './viajes.controller'

const service = new ViajesService(prisma)
const c = crearViajesController(service)

export const viajesRouter = Router()

viajesRouter.post('/', requireUser, c.crear)
viajesRouter.get('/planificados', requireUser, c.listarPlanificados)
viajesRouter.get('/finalizados', requireUser, c.listarFinalizados)
viajesRouter.get('/en-curso', requireUser, c.enCurso)
viajesRouter.get('/estadisticas', requireUser, c.estadisticas)
viajesRouter.get('/invitaciones/pendientes', requireUser, c.listarInvitacionesPendientes)
viajesRouter.post('/:viajeId/unirse-qr', requireUser, c.unirseQr)
viajesRouter.post('/:viajeId/invitacion/responder', requireUser, c.responderInvitacion)
viajesRouter.get('/:viajeId/participantes', requireUser, c.listarParticipantes)
viajesRouter.get('/:viajeId', requireUser, c.detalle)
viajesRouter.patch('/:viajeId', requireUser, c.actualizar)
viajesRouter.post('/:viajeId/posiciones', requireUser, c.ingresarPosiciones)
viajesRouter.put('/:viajeId/ubicacion-viva', requireUser, c.upsertUbicacionViva)
viajesRouter.get('/:viajeId/ubicaciones-vivas', requireUser, c.listarUbicacionesVivas)
viajesRouter.get('/:viajeId/ruta', requireUser, c.obtenerRuta)
viajesRouter.put('/:viajeId/ruta', requireUser, c.guardarRuta)
viajesRouter.post('/:viajeId/iniciar', requireUser, c.iniciar)
viajesRouter.post('/:viajeId/finalizar', requireUser, c.finalizar)
