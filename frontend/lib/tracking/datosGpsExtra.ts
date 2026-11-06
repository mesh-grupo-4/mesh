import type * as Location from 'expo-location'

/**
 * Datos que el GPS del celular entrega además de lat/lng y que antes se
 * descartaban. Viajan con cada muestra y se guardan en la cola offline igual
 * que la posición (RN-038).
 */
export type DatosGpsExtra = {
  altitud: number | null
  precisionAltitud: number | null
  velocidadKmh: number | null
  rumbo: number | null
}

/** Por debajo de esta velocidad (m/s) el rumbo del GPS es ruido: estás quieto. */
const VELOCIDAD_MIN_RUMBO_MS = 0.5

const finito = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v)

/**
 * Normaliza lo que entrega `expo-location`, que no usa `null` para "sin dato":
 * - Android manda `altitude`, `speed` y `heading` en 0 cuando no los tiene, y
 *   `altitudeAccuracy` en 0 (o null en Android < 8).
 * - iOS manda -1 en `speed`, `heading` y `altitudeAccuracy` cuando son inválidos.
 *
 * La altitud solo se acepta si viene con precisión vertical: es la única forma
 * de distinguir un 0 real de un "no sé". Los rangos coinciden con los del
 * backend; lo que queda afuera se manda como `null`.
 */
export function extraerDatosGpsExtra(coords: Location.LocationObjectCoords): DatosGpsExtra {
  const { altitude, altitudeAccuracy, speed, heading } = coords

  const altitudValida =
    finito(altitude) &&
    finito(altitudeAccuracy) &&
    altitudeAccuracy > 0 &&
    altitude >= -500 &&
    altitude <= 9000

  const velocidadValida = finito(speed) && speed >= 0 && speed * 3.6 <= 400

  const rumboValido =
    velocidadValida &&
    speed >= VELOCIDAD_MIN_RUMBO_MS &&
    finito(heading) &&
    heading >= 0 &&
    heading <= 360

  return {
    altitud: altitudValida ? altitude : null,
    precisionAltitud: altitudValida ? altitudeAccuracy : null,
    velocidadKmh: velocidadValida ? speed * 3.6 : null,
    rumbo: rumboValido ? heading : null,
  }
}
