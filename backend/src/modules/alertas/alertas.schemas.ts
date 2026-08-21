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
  mensaje: z.string().trim().min(1, 'El mensaje no puede estar vacío').max(280),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

export type CrearAlertaInput = z.infer<typeof crearAlertaSchema>
export type TipoAlerta = z.infer<typeof tipoAlertaSchema>
