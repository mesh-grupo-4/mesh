import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearClimaController } from './clima.controller'
import { ClimaService } from './clima.service'

const service = new ClimaService(prisma)
const c = crearClimaController(service)

/** Se monta sobre el router de viajes (`/api/viajes/:viajeId/clima`). */
export const climaHandlers = {
  obtener: [requireUser, c.obtener] as const,
}
