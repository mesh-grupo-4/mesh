import { z } from 'zod'

export const createGrupoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del grupo es obligatorio')
    .max(80, 'El nombre no puede superar 80 caracteres'),
})

export type CreateGrupoInput = z.infer<typeof createGrupoSchema>
