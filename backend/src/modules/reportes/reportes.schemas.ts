import { z } from 'zod'
import { DIAS_MAXIMOS } from './reportes.periodo'

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha esperado: AAAA-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Fecha inválida')

const actividad = z.enum(['moto', 'bici', 'running', 'trekking', 'otro'])

/** Fechas calendario en hora argentina (RN-105), ambas inclusive. */
export const periodoQuery = z
  .object({
    desde: fecha.optional(),
    hasta: fecha.optional(),
    granularidad: z.enum(['dia', 'semana', 'mes']).optional(),
  })
  .refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, {
    message: '`desde` no puede ser posterior a `hasta`',
    path: ['desde'],
  })
  .refine(
    (q) =>
      !q.desde ||
      !q.hasta ||
      (Date.parse(q.hasta) - Date.parse(q.desde)) / 86_400_000 < DIAS_MAXIMOS,
    { message: 'El período no puede superar los 2 años', path: ['hasta'] }
  )

export const periodoConActividadQuery = z.intersection(
  periodoQuery,
  z.object({ actividad: actividad.optional() })
)

export const retencionQuery = z.object({
  meses: z.coerce.number().int().min(2).max(12).default(6),
})

export type PeriodoQuery = z.infer<typeof periodoQuery>
export type PeriodoConActividadQuery = z.infer<typeof periodoConActividadQuery>
