import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearAlertasController } from './alertas.controller'
import { AlertasService } from './alertas.service'

const service = new AlertasService(prisma)
const c = crearAlertasController(service)

/** Se monta sobre el router de viajes (`/api/viajes/:viajeId/alertas`). */
export const alertasHandlers = {
  crear: [requireUser, c.crear] as const,
  listar: [requireUser, c.listar] as const,
}
