import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearParadasController } from './paradas.controller'
import { ParadasService } from './paradas.service'

const service = new ParadasService(prisma)
const c = crearParadasController(service)

/**
 * Se monta sobre el router de viajes (`/api/viajes/:viajeId/...`), así que
 * necesita `mergeParams` para ver `viajeId`.
 */
export const paradasHandlers = {
  iniciar: [requireUser, c.iniciar] as const,
  finalizar: [requireUser, c.finalizar] as const,
  activa: [requireUser, c.activa] as const,
  solicitar: [requireUser, c.solicitar] as const,
  listarSolicitudes: [requireUser, c.listarSolicitudes] as const,
  responderSolicitud: [requireUser, c.responderSolicitud] as const,
  cancelarSolicitud: [requireUser, c.cancelarSolicitud] as const,
}
