import { z } from 'zod'

/** RN-041: temas que el líder elige al crear la alerta. */
export const tipoAlertaSchema = z.enum([
  'parada',
  'combustible',
  'desvio',
  'peligro',
  'informacion',
])

export const crearAlertaSchema = z.object({
  tipo: tipoAlertaSchema,
  /** Opcional: el tipo ya comunica lo esencial ("Combustible", "Desvío"). */
  mensaje: z.string().trim().max(280).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

export type CrearAlertaInput = z.infer<typeof crearAlertaSchema>
export type TipoAlerta = z.infer<typeof tipoAlertaSchema>
