import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearGastosController } from './gastos.controller'
import { GastosService } from './gastos.service'

const service = new GastosService(prisma)
const c = crearGastosController(service)

/**
 * Se monta sobre el router de viajes (`/api/viajes/:viajeId/...`), así que
 * necesita `mergeParams` para ver `viajeId`.
 */
export const gastosHandlers = {
  listar: [requireUser, c.listar] as const,
  registrar: [requireUser, c.registrar] as const,
  actualizar: [requireUser, c.actualizar] as const,
  eliminar: [requireUser, c.eliminar] as const,
  balance: [requireUser, c.balance] as const,
}
