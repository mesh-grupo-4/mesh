import { z } from 'zod'

/**
 * Categorías de parada (RN-022) que tienen sentido buscar en Google Places.
 * `accidente`, `punto_control` y `otro` no corresponden a un tipo de lugar.
 */
export const categoriaLugarSchema = z.enum(['combustible', 'gastronomia', 'descanso', 'sanitario'])

const puntoSchema = z.object({
  lat: z.number().min(-90, 'lat debe estar entre -90 y 90').max(90, 'lat debe estar entre -90 y 90'),
  lng: z.number().min(-180, 'lng debe estar entre -180 y 180').max(180, 'lng debe estar entre -180 y 180'),
})

export const buscarEnRutaSchema = z.object({
  categoria: categoriaLugarSchema,
  /** Trazado de la ruta en orden. El backend lo simplifica antes de mandarlo a Google. */
  trazado: z
    .array(puntoSchema)
    .min(2, 'El trazado necesita al menos 2 puntos')
    .max(20000, 'El trazado no puede superar 20000 puntos'),
})

export const buscarCercanosQuerySchema = z.object({
  categoria: categoriaLugarSchema,
  lat: z.coerce.number().min(-90, 'lat debe estar entre -90 y 90').max(90, 'lat debe estar entre -90 y 90'),
  lng: z.coerce
    .number()
    .min(-180, 'lng debe estar entre -180 y 180')
    .max(180, 'lng debe estar entre -180 y 180'),
  radio_m: z.coerce
    .number()
    .int()
    .min(100, 'radio_m debe ser al menos 100')
    .max(50000, 'radio_m no puede superar 50000')
    .default(5000),
})

export type CategoriaLugar = z.infer<typeof categoriaLugarSchema>
export type BuscarEnRutaInput = z.infer<typeof buscarEnRutaSchema>
export type BuscarCercanosQuery = z.infer<typeof buscarCercanosQuerySchema>
