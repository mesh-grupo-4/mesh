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

export const invitarDesdeGruposSchema = z.object({
  grupo_origen_ids: z
    .array(z.string().uuid('Cada grupo_origen_id debe ser un UUID válido'))
    .min(1, 'Debés seleccionar al menos un grupo')
    .max(20, 'No podés invitar desde más de 20 grupos a la vez'),
})

export const invitarUsuariosSchema = z.object({
  usuario_ids: z
    .array(z.string().uuid('Cada usuario_id debe ser un UUID válido'))
    .min(1, 'Debés seleccionar al menos una persona')
    .max(100, 'No podés invitar a más de 100 personas a la vez'),
})

export const invitacionIdParamSchema = z.object({
  invitacionId: z.string().uuid('invitacionId debe ser un UUID válido'),
})

export const responderInvitacionSchema = z.object({
  accion: z.enum(['aceptar', 'rechazar'], {
    errorMap: () => ({ message: 'La acción debe ser aceptar o rechazar' }),
  }),
})

export type CreateGrupoInput = z.infer<typeof createGrupoSchema>
export type CambiarRolMiembroInput = z.infer<typeof cambiarRolMiembroSchema>
export type AbandonarGrupoInput = z.infer<typeof abandonarGrupoSchema>
export type InvitarDesdeGruposInput = z.infer<typeof invitarDesdeGruposSchema>
export type InvitarUsuariosInput = z.infer<typeof invitarUsuariosSchema>
export type ResponderInvitacionInput = z.infer<typeof responderInvitacionSchema>
