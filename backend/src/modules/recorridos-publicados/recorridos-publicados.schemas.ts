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
export const BUSQUEDA_MAX = 60
export const COMENTARIO_MAX = 280

/**
 * RN-081: el listado es para toda la comunidad. SCRUM-62: se filtra por actividad y por
 * zona geográfica (`lat` + `lng` del centro, `radioKm` opcional). `lat` y `lng` van juntos.
 */
export const listarRecorridosQuery = z
  .object({
    tipoActividad: z.enum(['moto', 'auto', 'bici', 'running', 'trekking', 'otro']).optional(),
    /** Texto libre: busca en nombre, comentario y autor. Vacío equivale a no enviarlo. */
    q: z
      .string()
      .trim()
      .max(BUSQUEDA_MAX)
      .optional()
      .transform((v) => v || undefined),
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

/**
 * RN-081: al publicar, el autor puede sumar una nota, elegir si comparte su checklist y
 * adjuntar una foto ya subida (`fotoPath`, el `path` de `POST .../recorrido/foto/subida`).
 * Todo es opcional: publicar sin cuerpo sigue siendo válido.
 */
export const publicarRecorridoBody = z
  .object({
    comentario: z
      .string()
      .trim()
      .max(COMENTARIO_MAX, `El comentario admite hasta ${COMENTARIO_MAX} caracteres`)
      .optional()
      .transform((v) => v || null),
    compartirChecklist: z.boolean().default(false),
    fotoPath: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

/** RN-084: quien guarda el recorrido elige si se lleva también el checklist compartido. */
export const importarRecorridoBody = z
  .object({
    guardarChecklist: z.boolean().default(false),
  })
  .strict()
