import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearFantasmaController } from './fantasma.controller'
import { FantasmaService } from './fantasma.service'

const service = new FantasmaService(prisma)
const c = crearFantasmaController(service)

/** Se monta sobre el router de viajes (`/api/viajes/:viajeId/fantasma`). */
export const fantasmaHandlers = {
  candidatos: [requireUser, c.candidatos] as const,
  obtener: [requireUser, c.obtener] as const,
}
