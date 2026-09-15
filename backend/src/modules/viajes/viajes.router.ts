import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { ViajesService } from './viajes.service'
import { crearViajesController } from './viajes.controller'
import { rutasCompartirHandlers } from '../rutas-compartidas/rutas-compartidas.router'
import { paradasHandlers } from '../paradas/paradas.router'
import { alertasHandlers } from '../alertas/alertas.router'
import { climaHandlers } from '../clima/clima.router'
import { fantasmaHandlers } from '../fantasma/fantasma.router'
import { checklistHandlers } from '../checklist/checklist.router'
import { gastosHandlers } from '../gastos/gastos.router'
import { privacidadViajeHandlers } from '../privacidad/privacidad.router'

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
viajesRouter.get('/:viajeId/resumen', requireUser, c.resumen)
viajesRouter.get('/:viajeId/metricas-grupales', requireUser, c.metricasGrupales)
viajesRouter.get('/:viajeId/mis-metricas', requireUser, c.misMetricas)
// US2: traza GPS realmente recorrida por quien consulta.
viajesRouter.get('/:viajeId/recorrido', requireUser, c.recorrido)
viajesRouter.get('/:viajeId', requireUser, c.detalle)
viajesRouter.patch('/:viajeId', requireUser, c.actualizar)
viajesRouter.delete('/:viajeId', requireUser, c.eliminar)
viajesRouter.post('/:viajeId/posiciones', requireUser, c.ingresarPosiciones)
viajesRouter.put('/:viajeId/ubicacion-viva', requireUser, c.upsertUbicacionViva)
viajesRouter.get('/:viajeId/ubicaciones-vivas', requireUser, c.listarUbicacionesVivas)

// RN-111/112: interruptor de compartir ubicación en este viaje y quién la vio.
viajesRouter.get('/:viajeId/privacidad', ...privacidadViajeHandlers.obtener)
viajesRouter.put('/:viajeId/privacidad', ...privacidadViajeHandlers.actualizar)
viajesRouter.get('/:viajeId/accesos-ubicacion', ...privacidadViajeHandlers.accesos)
viajesRouter.get('/:viajeId/ruta', requireUser, c.obtenerRuta)
// Pronóstico sobre la ruta planificada (SCRUM-27, RN-108).
viajesRouter.get('/:viajeId/clima', ...climaHandlers.obtener)
// Modo competitivo (RN-071) y ghost tracking (RN-073).
viajesRouter.get('/:viajeId/leaderboard', requireUser, c.leaderboard)
viajesRouter.get('/:viajeId/fantasma/candidatos', ...fantasmaHandlers.candidatos)
viajesRouter.get('/:viajeId/fantasma', ...fantasmaHandlers.obtener)
viajesRouter.put('/:viajeId/ruta', requireUser, c.guardarRuta)
viajesRouter.post('/:viajeId/ruta/compartir', requireUser, rutasCompartirHandlers.compartir)
viajesRouter.delete('/:viajeId/ruta/compartir', requireUser, rutasCompartirHandlers.revocar)
viajesRouter.post('/:viajeId/iniciar', requireUser, c.iniciar)
viajesRouter.post('/:viajeId/finalizar', requireUser, c.finalizar)
viajesRouter.post('/:viajeId/salir', requireUser, c.salir)

// Paradas voluntarias y solicitudes de parada (US1–US3, RN-037 / RN-044).
viajesRouter.get('/:viajeId/paradas/activa', ...paradasHandlers.activa)
viajesRouter.post('/:viajeId/paradas', ...paradasHandlers.iniciar)
viajesRouter.post('/:viajeId/paradas/finalizar', ...paradasHandlers.finalizar)
viajesRouter.post('/:viajeId/paradas/confirmar-bien', ...paradasHandlers.confirmarBien)
viajesRouter.get('/:viajeId/solicitudes-parada', ...paradasHandlers.listarSolicitudes)
viajesRouter.post('/:viajeId/solicitudes-parada', ...paradasHandlers.solicitar)
viajesRouter.post(
  '/:viajeId/solicitudes-parada/:solicitudId/responder',
  ...paradasHandlers.responderSolicitud
)
viajesRouter.post(
  '/:viajeId/solicitudes-parada/:solicitudId/cancelar',
  ...paradasHandlers.cancelarSolicitud
)

// Alertas del viaje (US1, RN-040 / RN-041).
viajesRouter.get('/:viajeId/alertas', ...alertasHandlers.listar)
viajesRouter.post('/:viajeId/alertas', ...alertasHandlers.crear)
viajesRouter.patch('/:viajeId/alertas/:alertaId', ...alertasHandlers.cambiarEstado)

// Checklist de preparativos pre-ruta (SCRUM-22, RN-026).
viajesRouter.get('/:viajeId/checklist', ...checklistHandlers.listar)
viajesRouter.post('/:viajeId/checklist', ...checklistHandlers.agregar)
viajesRouter.post('/:viajeId/checklist/importar', ...checklistHandlers.importar)
viajesRouter.patch('/:viajeId/checklist/:itemId', ...checklistHandlers.actualizar)
viajesRouter.delete('/:viajeId/checklist/:itemId', ...checklistHandlers.eliminar)

// Gastos compartidos y liquidación del viaje.
viajesRouter.get('/:viajeId/gastos', ...gastosHandlers.listar)
viajesRouter.post('/:viajeId/gastos', ...gastosHandlers.registrar)
viajesRouter.get('/:viajeId/gastos/balance', ...gastosHandlers.balance)
viajesRouter.patch('/:viajeId/gastos/:gastoId', ...gastosHandlers.actualizar)
viajesRouter.delete('/:viajeId/gastos/:gastoId', ...gastosHandlers.eliminar)
