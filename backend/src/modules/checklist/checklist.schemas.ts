import { z } from 'zod'

const texto = z
  .string()
  .trim()
  .min(1, 'El ítem no puede estar vacío')
  .max(120, 'El ítem no puede superar los 120 caracteres')

export const agregarItemSchema = z.object({
  texto,
  /**
   * RN-026 + RN-030: solo el creador del viaje puede marcar un ítem como base para
   * todo el grupo. Para el resto el campo se rechaza con 403.
   */
  paraTodos: z.boolean().optional().default(false),
})

export const actualizarItemSchema = z
  .object({
    texto: texto.optional(),
    completado: z.boolean().optional(),
  })
  .refine((v) => v.texto !== undefined || v.completado !== undefined, {
    message: 'Indicá al menos un campo a actualizar',
  })

export const importarChecklistSchema = z.object({
  viajeOrigenId: z.string().uuid(),
})

export type AgregarItemInput = z.infer<typeof agregarItemSchema>
export type ActualizarItemInput = z.infer<typeof actualizarItemSchema>
export type ImportarChecklistInput = z.infer<typeof importarChecklistSchema>
