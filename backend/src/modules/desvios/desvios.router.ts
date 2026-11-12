import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearDesviosController } from './desvios.controller'
import { DesviosService } from './desvios.service'

const service = new DesviosService(prisma)
const c = crearDesviosController(service)

/** Se monta sobre el router de viajes (`/api/viajes/:viajeId/...`). RN-034b. */
export const desviosHandlers = {
  estado: [requireUser, c.estado] as const,
  confirmar: [requireUser, c.confirmar] as const,
  rechazar: [requireUser, c.rechazar] as const,
  voluntario: [requireUser, c.voluntario] as const,
}
