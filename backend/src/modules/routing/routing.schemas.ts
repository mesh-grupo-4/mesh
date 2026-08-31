import { z } from 'zod'

export const perfilRutaSchema = z.enum(['walking', 'cycling', 'driving'])

export const calcularRutaSchema = z.object({
  perfil: perfilRutaSchema,
  puntos: z
    .array(
      z.object({
        lat: z.number().min(-90, 'lat debe estar entre -90 y 90').max(90, 'lat debe estar entre -90 y 90'),
        lng: z
          .number()
          .min(-180, 'lng debe estar entre -180 y 180')
          .max(180, 'lng debe estar entre -180 y 180'),
      })
    )
    .min(2, 'Se necesitan al menos origen y destino')
    .max(30, 'Máximo 30 puntos por ruta'),
})

export type PerfilRuta = z.infer<typeof perfilRutaSchema>
export type CalcularRutaInput = z.infer<typeof calcularRutaSchema>
