import { z } from 'zod'

export const buscarLugaresQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'La búsqueda no puede estar vacía')
    .max(200, 'La búsqueda no puede superar 200 caracteres'),
})

export const reverseGeocodingQuerySchema = z.object({
  lat: z.coerce.number().min(-90, 'lat debe estar entre -90 y 90').max(90, 'lat debe estar entre -90 y 90'),
  lng: z.coerce.number().min(-180, 'lng debe estar entre -180 y 180').max(180, 'lng debe estar entre -180 y 180'),
})

// Token de sesión de Google (lo genera el cliente; un UUID entra justo en 36).
const sesionSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,36}$/, 'sesion debe tener hasta 36 caracteres alfanuméricos, guiones o guiones bajos')
  .optional()

export const autocompletarQuerySchema = z
  .object({
    q: buscarLugaresQuerySchema.shape.q,
    lat: reverseGeocodingQuerySchema.shape.lat.optional(),
    lng: reverseGeocodingQuerySchema.shape.lng.optional(),
    sesion: sesionSchema,
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: 'lat y lng van juntos',
    path: ['lat'],
  })

export const detalleLugarParamsSchema = z.object({
  placeId: z.string().regex(/^[A-Za-z0-9_-]{1,300}$/, 'placeId inválido'),
})

export const detalleLugarQuerySchema = z.object({ sesion: sesionSchema })

export type BuscarLugaresQuery = z.infer<typeof buscarLugaresQuerySchema>
export type ReverseGeocodingQuery = z.infer<typeof reverseGeocodingQuerySchema>
