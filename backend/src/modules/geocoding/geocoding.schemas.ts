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

export type BuscarLugaresQuery = z.infer<typeof buscarLugaresQuerySchema>
export type ReverseGeocodingQuery = z.infer<typeof reverseGeocodingQuerySchema>
