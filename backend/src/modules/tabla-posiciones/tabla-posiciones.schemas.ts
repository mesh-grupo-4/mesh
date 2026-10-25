import { z } from 'zod'

/**
 * RN-070 / RN-021: la tabla de posiciones global nunca incluye moto (único
 * excluido); bici, running, trekking y otro sí tienen tabla.
 */
export const tipoActividadRankingSchema = z.enum(['bici', 'running', 'trekking', 'otro'])

/** RN-076: período vigente (semana/mes/año calendario en curso, hora Argentina). */
export const periodoRankingSchema = z.enum(['semanal', 'mensual', 'anual'])

export const ordenRankingSchema = z.enum(['distancia', 'tiempo'])

export const obtenerTablaPosicionesQuery = z.object({
  tipoActividad: tipoActividadRankingSchema,
  periodo: periodoRankingSchema.default('semanal'),
  orden: ordenRankingSchema.default('distancia'),
})

export type TipoActividadRanking = z.infer<typeof tipoActividadRankingSchema>
export type PeriodoRanking = z.infer<typeof periodoRankingSchema>
export type OrdenRanking = z.infer<typeof ordenRankingSchema>
export type ObtenerTablaPosicionesQuery = z.infer<typeof obtenerTablaPosicionesQuery>
