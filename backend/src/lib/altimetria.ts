/**
 * Altimetría a partir de la altitud del GPS del celular.
 *
 * La altitud GPS tiene bastante ruido (del orden de ±10 m), así que se trabaja
 * en dos pasos para no inflar el desnivel:
 *  1. En la base: se descartan muestras con precisión vertical mala y se toma
 *     la mediana por ventana de tiempo (`VENTANA_SUAVIZADO_SEG`).
 *  2. Acá: histéresis sobre la serie suavizada. Un cambio solo cuenta como
 *     subida/bajada cuando supera `UMBRAL_DESNIVEL_M` respecto del último
 *     punto de referencia. Es conservador: prefiere quedarse corto antes que
 *     sumar ruido como si fueran metros subidos.
 */

/** Precisión vertical máxima (m) para usar una muestra de altitud. */
export const PRECISION_ALTITUD_MAX_M = 25

/** Ventana (s) en la que se toma la mediana de altitud. */
export const VENTANA_SUAVIZADO_SEG = 30

/** Cambio mínimo de altitud (m) para contarlo como subida o bajada. */
export const UMBRAL_DESNIVEL_M = 8

export type Altimetria = {
  desnivel_positivo_m: number
  desnivel_negativo_m: number
  altitud_max_m: number
  altitud_min_m: number
}

/**
 * Calcula desnivel acumulado y extremos sobre una serie de altitudes ya
 * suavizada y en orden temporal. Devuelve `null` si no hay datos.
 */
export function calcularAltimetria(
  alturas: number[],
  umbralM: number = UMBRAL_DESNIVEL_M
): Altimetria | null {
  const serie = alturas.filter((a) => Number.isFinite(a))
  if (serie.length === 0) return null

  let max = serie[0]!
  let min = serie[0]!
  for (const a of serie) {
    if (a > max) max = a
    if (a < min) min = a
  }

  // Histéresis con seguimiento de extremos: `base` es el último valle/cima
  // confirmado y `extremo` el punto más alto (subiendo) o más bajo (bajando) del
  // tramo actual. Un tramo se cierra recién cuando la serie se aleja del extremo
  // más que el umbral, así se cuenta la subida completa hasta la cima real.
  let sube = 0
  let baja = 0
  let direccion: 'sube' | 'baja' | null = null
  let base = serie[0]!
  let extremo = serie[0]!
  // Mientras no hay dirección, el valle y la cima vistos hasta ahora.
  let valle = serie[0]!
  let cima = serie[0]!

  for (let i = 1; i < serie.length; i++) {
    const a = serie[i]!
    if (direccion === null) {
      if (a < valle) valle = a
      if (a > cima) cima = a
      if (a - valle >= umbralM) {
        direccion = 'sube'
        base = valle
        extremo = a
      } else if (cima - a >= umbralM) {
        direccion = 'baja'
        base = cima
        extremo = a
      }
    } else if (direccion === 'sube') {
      if (a > extremo) {
        extremo = a
      } else if (extremo - a >= umbralM) {
        sube += extremo - base
        base = extremo
        extremo = a
        direccion = 'baja'
      }
    } else if (a < extremo) {
      extremo = a
    } else if (a - extremo >= umbralM) {
      baja += base - extremo
      base = extremo
      extremo = a
      direccion = 'sube'
    }
  }
  // El último tramo quedó abierto: ya superó el umbral, cuenta entero.
  if (direccion === 'sube') sube += extremo - base
  if (direccion === 'baja') baja += base - extremo

  return {
    desnivel_positivo_m: sube,
    desnivel_negativo_m: baja,
    altitud_max_m: max,
    altitud_min_m: min,
  }
}
