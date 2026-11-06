/**
 * RN-070 (IRREVOCABLE): los vehículos motorizados quedan excluidos de todo ranking
 * competitivo, tabla de posiciones, fantasma y gamificación de velocidad, y nunca
 * exponen velocidades. Es una regla de seguridad vial.
 *
 * Única fuente de verdad: cualquier compuerta de RN-070 tiene que pasar por acá,
 * nunca comparar contra `'moto'` a mano.
 */
export const ACTIVIDADES_MOTORIZADAS = ['moto', 'auto'] as const

export function esMotorizado(tipoActividad: string | null | undefined): boolean {
  return tipoActividad != null && (ACTIVIDADES_MOTORIZADAS as readonly string[]).includes(tipoActividad)
}
