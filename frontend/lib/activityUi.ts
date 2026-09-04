import type { TipoActividadApi } from './viajesApi'

/** Config de interfaz por actividad (RN-052) — mismo patrón que `trackingConfig.ts`. */
export type UiConfigActividad = {
  /** Oculta la barra de estado para maximizar el área útil de pantalla. */
  pantallaCompleta: boolean
  /** Usa la paleta de alto contraste (`Colors.highContrast`) en vez de light/dark. */
  altoContraste: boolean
  /** Multiplicador de tamaño para botones y objetivos táctiles principales. */
  escalaBotones: number
  /** Prioriza vibración sobre feedback visual en eventos del viaje. */
  hapticaPrioritaria: boolean
}

const DEFAULT: UiConfigActividad = {
  pantallaCompleta: false,
  altoContraste: false,
  escalaBotones: 1,
  hapticaPrioritaria: false,
}

const UI_POR_ACTIVIDAD: Record<TipoActividadApi, UiConfigActividad> = {
  // Una mano, sol directo, guantes: pantalla completa + alto contraste + botones grandes.
  moto: { pantallaCompleta: true, altoContraste: true, escalaBotones: 1.3, hapticaPrioritaria: false },
  bici: DEFAULT,
  // Sin mirar la pantalla en movimiento: la vibración reemplaza al feedback visual.
  running: { ...DEFAULT, hapticaPrioritaria: true },
  trekking: { ...DEFAULT, hapticaPrioritaria: true },
  otro: DEFAULT,
}

export function uiConfigPorActividad(tipoActividad: TipoActividadApi): UiConfigActividad {
  return UI_POR_ACTIVIDAD[tipoActividad] ?? DEFAULT
}
