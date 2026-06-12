import { z } from 'zod'

export const syncUsuarioSchema = z.object({
  email: z.string().email(),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  apellido: z.string().trim().max(100).nullish(),
  telefono: z.string().trim().max(30).nullish(),
  actividad_preferida: z.enum(['moto', 'bici', 'running', 'trekking']).nullish(),
})

export type SyncUsuarioInput = z.infer<typeof syncUsuarioSchema>
