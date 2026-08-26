import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearChecklistController } from './checklist.controller'
import { ChecklistService } from './checklist.service'

const service = new ChecklistService(prisma)
const c = crearChecklistController(service)

/**
 * Se monta sobre el router de viajes (`/api/viajes/:viajeId/checklist`), igual que
 * paradas y alertas: el checklist siempre pertenece a un viaje.
 */
export const checklistHandlers = {
  listar: [requireUser, c.listar] as const,
  agregar: [requireUser, c.agregar] as const,
  actualizar: [requireUser, c.actualizar] as const,
  eliminar: [requireUser, c.eliminar] as const,
  importar: [requireUser, c.importar] as const,
}
