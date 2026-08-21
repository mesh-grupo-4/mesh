import { z } from 'zod'

// RN-022: categorías de parada. Coinciden con el enum CategoriaParada de Prisma.
export const categoriaParadaSchema = z.enum([
  'kiosco',
  'combustible',
  'descanso',
  'gastronomia',
  'punto_control',
  'sanitario',
  'otro',
])

export const iniciarParadaSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  categoria: categoriaParadaSchema,
})

export const solicitarParadaSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  motivo: z.string().trim().max(280).optional(),
})

export const responderSolicitudSchema = z.object({
  decision: z.enum(['aprobada', 'rechazada']),
})

export type IniciarParadaInput = z.infer<typeof iniciarParadaSchema>
export type SolicitarParadaInput = z.infer<typeof solicitarParadaSchema>
export type ResponderSolicitudInput = z.infer<typeof responderSolicitudSchema>
