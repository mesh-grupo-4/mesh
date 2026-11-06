import type { DatosGpsExtra } from '../modules/viajes/viajes.schemas'

/**
 * Pasa los datos extra del GPS del dispositivo (ya validados con Zod) a las
 * columnas de `registro_gps`. Lo que no vino queda en `null`: las versiones
 * viejas de la app solo mandan lat/lng/precisión.
 */
export function columnasGpsExtra(d: DatosGpsExtra) {
  return {
    altitud_m: d.altitud ?? null,
    precision_altitud_m: d.precisionAltitud ?? null,
    velocidad_kmh: d.velocidadKmh ?? null,
    rumbo_grados: d.rumbo ?? null,
  }
}
