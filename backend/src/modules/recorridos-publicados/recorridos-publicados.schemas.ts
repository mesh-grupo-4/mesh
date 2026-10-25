import { z } from 'zod'

export const viajeIdParamSchema = z.object({
  viajeId: z.string().uuid('viajeId debe ser un UUID válido'),
})

export const recorridoIdParamSchema = z.object({
  recorridoId: z.string().uuid('recorridoId debe ser un UUID válido'),
})

/** RN-081: el listado es para toda la comunidad; solo se puede filtrar por actividad. */
export const listarRecorridosQuery = z.object({
  tipoActividad: z.enum(['moto', 'bici', 'running', 'trekking', 'otro']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})
