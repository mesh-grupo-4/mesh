import { z } from 'zod'

export const createGrupoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del grupo es obligatorio')
    .max(80, 'El nombre no puede superar 80 caracteres'),
})

export const grupoIdParamSchema = z.object({
  grupoId: z.string().uuid('grupoId debe ser un UUID válido'),
})

export const miembroParamsSchema = z.object({
  grupoId: z.string().uuid('grupoId debe ser un UUID válido'),
  usuarioId: z.string().uuid('usuarioId debe ser un UUID válido'),
})

export const cambiarRolMiembroSchema = z.object({
  rol: z.enum(['lider', 'participante'], {
    errorMap: () => ({ message: 'El rol debe ser lider o participante' }),
  }),
})

export const abandonarGrupoSchema = z.object({
  nuevo_lider_id: z.string().uuid('nuevo_lider_id debe ser un UUID válido').optional(),
})

export type CreateGrupoInput = z.infer<typeof createGrupoSchema>
export type CambiarRolMiembroInput = z.infer<typeof cambiarRolMiembroSchema>
export type AbandonarGrupoInput = z.infer<typeof abandonarGrupoSchema>
