import { z } from 'zod'

export const syncUsuarioSchema = z.object({
  email: z.string().email(),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  apellido: z.string().trim().max(100).nullish(),
  telefono: z.string().trim().max(30).nullish(),
  actividad_preferida: z.enum(['moto', 'bici', 'running', 'trekking', 'otro']).nullish(),
})

/** Token de Expo Push para notificaciones (`ExponentPushToken[...]`). */
export const pushTokenSchema = z.object({
  token: z.string().trim().min(1, 'token requerido'),
})

export type SyncUsuarioInput = z.infer<typeof syncUsuarioSchema>
export type PushTokenInput = z.infer<typeof pushTokenSchema>
