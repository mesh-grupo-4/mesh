import { z } from 'zod'

/** RN-065 / RN-070: el entrenamiento no existe en moto ni auto. */
const actividadEntrenableSchema = z.enum(['bici', 'running', 'trekking', 'otro'])

export const listarSesionesQuerySchema = z.object({
  tipoActividad: actividadEntrenableSchema.optional(),
  circuitoId: z.string().uuid('circuitoId debe ser un UUID válido').optional(),
})
export type ListarSesionesQuery = z.infer<typeof listarSesionesQuerySchema>

export const listarCircuitosQuerySchema = z.object({
  tipoActividad: actividadEntrenableSchema.optional(),
})
export type ListarCircuitosQuery = z.infer<typeof listarCircuitosQuerySchema>

export const sesionParamSchema = z.object({
  viajeId: z.string().uuid('viajeId debe ser un UUID válido'),
})

export const circuitoParamSchema = z.object({
  circuitoId: z.string().uuid('circuitoId debe ser un UUID válido'),
})

export const circuitoSesionParamSchema = circuitoParamSchema.merge(sesionParamSchema)

export const renombrarCircuitoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre del circuito es obligatorio').max(100),
})
