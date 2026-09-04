import { z } from 'zod'

export const crearGastoSchema = z.object({
  monto: z.number().positive().finite(),
  descripcion: z.string().trim().min(1).max(140),
  participantesIds: z.array(z.string().uuid()).min(1),
})

export const actualizarGastoSchema = z
  .object({
    monto: z.number().positive().finite().optional(),
    descripcion: z.string().trim().min(1).max(140).optional(),
    participantesIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine((v) => v.monto !== undefined || v.descripcion !== undefined || v.participantesIds !== undefined, {
    message: 'Nada para actualizar',
  })

export type CrearGastoInput = z.infer<typeof crearGastoSchema>
export type ActualizarGastoInput = z.infer<typeof actualizarGastoSchema>
