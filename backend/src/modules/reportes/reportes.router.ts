import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { requireSuperadmin } from '../../middleware/requireSuperadmin'
import { crearReportesController } from './reportes.controller'
import { ReportesService } from './reportes.service'

const service = new ReportesService(prisma)
const c = crearReportesController(service)

/**
 * Reportería del backoffice (RN-127 a RN-131): solo superadmin, solo agregados.
 * Se monta en `/api/admin/reportes` como router propio —y antes que `/admin`—
 * para que el test de contrato lo vea y para no autenticar dos veces.
 */
export const reportesRouter = Router()

reportesRouter.use(requireUser, requireSuperadmin)

reportesRouter.get('/resumen', c.resumen)
reportesRouter.get('/crecimiento', c.crecimiento)
reportesRouter.get('/retencion', c.retencion)
reportesRouter.get('/viajes', c.viajes)
reportesRouter.get('/comunidad', c.comunidad)
reportesRouter.get('/seguridad', c.seguridad)
reportesRouter.get('/destinos', c.destinos)
reportesRouter.get('/adopcion', c.adopcion)
reportesRouter.get('/gastos', c.gastos)
