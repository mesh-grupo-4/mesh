import { z } from 'zod'

/** RN-041: temas que el líder elige al crear la alerta. */
export const tipoAlertaSchema = z.enum([
  'parada',
  'combustible',
  'desvio',
  'peligro',
  'informacion',
  'atraso',
])

export const crearAlertaSchema = z.object({
  tipo: tipoAlertaSchema,
  /** Opcional: el tipo ya comunica lo esencial ("Combustible", "Desvío"). */
  mensaje: z.string().trim().max(280).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

/** RN-042: estados a los que el líder puede llevar una alerta a mano. */
export const estadoAlertaSchema = z.enum(['activa', 'pausada', 'cancelada', 'resuelta'])

export const cambiarEstadoAlertaSchema = z.object({
  estado: estadoAlertaSchema,
})

export const alertaIdParamSchema = z.object({
  viajeId: z.string().uuid(),
  alertaId: z.string().uuid(),
})

export type CrearAlertaInput = z.infer<typeof crearAlertaSchema>
export type CambiarEstadoAlertaInput = z.infer<typeof cambiarEstadoAlertaSchema>
export type TipoAlerta = z.infer<typeof tipoAlertaSchema>
export type EstadoAlerta = z.infer<typeof estadoAlertaSchema>
