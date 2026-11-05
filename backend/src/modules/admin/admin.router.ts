import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { requireSuperadmin } from '../../middleware/requireSuperadmin'
import { AdminService } from './admin.service'
import { crearAdminController } from './admin.controller'

const service = new AdminService(prisma)
const c = crearAdminController(service)

/** Backoffice de la plataforma (RN-120 a RN-126): todo exige rol superadmin. */
export const adminRouter = Router()

adminRouter.use(requireUser, requireSuperadmin)

adminRouter.get('/estadisticas', c.estadisticas)

adminRouter.get('/usuarios', c.listarUsuarios)
adminRouter.get('/usuarios/:usuarioId', c.detalleUsuario)
adminRouter.patch('/usuarios/:usuarioId', c.actualizarUsuario)
adminRouter.put('/usuarios/:usuarioId/rol', c.cambiarRol)
adminRouter.post('/usuarios/:usuarioId/suspender', c.suspender)
adminRouter.post('/usuarios/:usuarioId/reactivar', c.reactivar)
adminRouter.delete('/usuarios/:usuarioId', c.eliminarUsuario)

adminRouter.get('/grupos', c.listarGrupos)
adminRouter.get('/grupos/:grupoId', c.detalleGrupo)
adminRouter.put('/grupos/:grupoId/lider', c.reasignarLider)
adminRouter.delete('/grupos/:grupoId/miembros/:usuarioId', c.quitarMiembro)
adminRouter.delete('/grupos/:grupoId', c.eliminarGrupo)

adminRouter.get('/viajes', c.listarViajes)
adminRouter.get('/viajes/:viajeId', c.detalleViaje)
adminRouter.post('/viajes/:viajeId/finalizar', c.finalizarViaje)
adminRouter.delete('/viajes/:viajeId', c.eliminarViaje)

adminRouter.get('/auditoria', c.auditoria)
