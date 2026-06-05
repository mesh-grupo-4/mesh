import { z } from 'zod'

export const solicitarAmistadSchema = z.object({
  usuario_id: z.string().uuid('usuario_id debe ser un UUID válido'),
})

export const solicitudIdParamSchema = z.object({
  solicitudId: z.string().uuid('solicitudId debe ser un UUID válido'),
})

export const responderSolicitudAmistadSchema = z.object({
  accion: z.enum(['aceptar', 'rechazar'], {
    errorMap: () => ({ message: 'La acción debe ser aceptar o rechazar' }),
  }),
})

export const buscarUsuariosAmistadQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'La búsqueda debe tener al menos 2 caracteres')
    .max(80, 'La búsqueda no puede superar 80 caracteres'),
})

export const amigoUsuarioIdParamSchema = z.object({
  usuarioId: z.string().uuid('usuarioId debe ser un UUID válido'),
})

export type SolicitarAmistadInput = z.infer<typeof solicitarAmistadSchema>
export type ResponderSolicitudAmistadInput = z.infer<typeof responderSolicitudAmistadSchema>
