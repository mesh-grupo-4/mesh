import * as Location from 'expo-location'

/** Config nativa de `expo-location` por actividad — separado de `gpsFilters.ts`
 * (que es el espejo puro de umbrales con el backend, sin tipos de expo-location). */
export type TrackingConfig = {
  accuracy: Location.Accuracy
  distanceInterval: number
}

const DEFAULT: TrackingConfig = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 4,
}

const POR_ACTIVIDAD: Record<string, TrackingConfig> = {
  // Van lento: cualquier error de GPS se nota más en el dibujo del trazado.
  trekking: { accuracy: Location.Accuracy.Highest, distanceInterval: 3 },
  running: { accuracy: Location.Accuracy.Highest, distanceInterval: 3 },
  // Van rápido: prioriza cadencia estable sobre precisión extra.
  bici: { accuracy: Location.Accuracy.High, distanceInterval: 5 },
  moto: { accuracy: Location.Accuracy.High, distanceInterval: 6 },
  otro: DEFAULT,
}

export function trackingConfigPorActividad(tipoActividad: string): TrackingConfig {
  return POR_ACTIVIDAD[tipoActividad] ?? DEFAULT
}

/**
 * Cadencia objetivo (RN-031: un ping cada 5s). `timeInterval` de expo-location es
 * Android-only — en iOS no llega ningún tick si el usuario no se desplaza al menos
 * `distanceInterval`. El timer de respaldo en `trackingControl.ts` fuerza una
 * lectura si no llegó ninguna actualización nativa en esta ventana.
 */
export const TICK_TARGET_MS = 5000
