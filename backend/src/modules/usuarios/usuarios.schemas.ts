import { z } from 'zod'

export const syncUsuarioSchema = z.object({
  email: z.string().email(),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
})

export type SyncUsuarioInput = z.infer<typeof syncUsuarioSchema>
