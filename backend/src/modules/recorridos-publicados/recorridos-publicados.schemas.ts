import { z } from 'zod'

export const viajeIdParamSchema = z.object({
  viajeId: z.string().uuid('viajeId debe ser un UUID válido'),
})

export const recorridoIdParamSchema = z.object({
  recorridoId: z.string().uuid('recorridoId debe ser un UUID válido'),
})

/** Radio de búsqueda por defecto y máximo de la zona geográfica (SCRUM-62). */
export const RADIO_ZONA_DEFAULT_KM = 25
export const RADIO_ZONA_MAX_KM = 200

/**
 * RN-081: el listado es para toda la comunidad. SCRUM-62: se filtra por actividad y por
 * zona geográfica (`lat` + `lng` del centro, `radioKm` opcional). `lat` y `lng` van juntos.
 */
export const listarRecorridosQuery = z
  .object({
    tipoActividad: z.enum(['moto', 'bici', 'running', 'trekking', 'otro']).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radioKm: z.coerce.number().min(1).max(RADIO_ZONA_MAX_KM).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((q) => (q.lat === undefined) === (q.lng === undefined), {
    message: 'lat y lng se envían juntos',
    path: ['lat'],
  })
  .refine((q) => q.radioKm === undefined || q.lat !== undefined, {
    message: 'radioKm requiere lat y lng',
    path: ['radioKm'],
  })
  .transform(({ lat, lng, radioKm, ...resto }) => ({
    ...resto,
    zona:
      lat !== undefined && lng !== undefined
        ? { lat, lng, radioKm: radioKm ?? RADIO_ZONA_DEFAULT_KM }
        : undefined,
  }))

/**
 * RN-082: solo "Recomiendo" (`true`) o "No recomiendo" (`false`). `strict`: RN-083 no
 * permite comentarios, así que cualquier otro campo (p. ej. `comentario`) es un 400.
 */
export const valorarRecorridoBody = z
  .object({
    recomiendo: z.boolean(),
  })
  .strict()
