import { z } from 'zod'

/**
 * Versión del texto de consentimiento informado de geolocalización (RN-110).
 * Al cambiarla, el consentimiento guardado queda obsoleto y la app vuelve a
 * pedirlo: por eso se guarda la versión aceptada y no solo un booleano.
 */
export const VERSION_CONSENTIMIENTO_UBICACION = '2026-09-15'

export const actualizarPrivacidadUsuarioSchema = z
  .object({
    /** RN-111: valor con el que arranca cada viaje nuevo. */
    comparte_ubicacion_default: z.boolean().optional(),
    /**
     * `true` registra el consentimiento con la versión vigente; `false` lo revoca
     * y, con él, el compartir en todos los viajes (RN-113).
     */
    consentimiento_ubicacion: z.boolean().optional(),
  })
  .refine(
    (v) => v.comparte_ubicacion_default !== undefined || v.consentimiento_ubicacion !== undefined,
    { message: 'Nada para actualizar' }
  )

export const actualizarPrivacidadViajeSchema = z.object({
  comparte_ubicacion: z.boolean(),
})

export type ActualizarPrivacidadUsuarioInput = z.infer<typeof actualizarPrivacidadUsuarioSchema>
export type ActualizarPrivacidadViajeInput = z.infer<typeof actualizarPrivacidadViajeSchema>
