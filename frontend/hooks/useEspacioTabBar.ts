import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const TAB_BAR_ALTO = 60
export const TAB_BAR_MARGEN = 16
/** Separa la cápsula de la barra del sistema, sumado al safe area. */
const TAB_BAR_ELEVACION = 8
/** Con navegación por gestos el safe area es chico: este mínimo evita que quede pegada abajo. */
const TAB_BAR_BOTTOM_MINIMO = 40
const AIRE_SOBRE_BARRA = 12

/** Distancia entre la cápsula y el borde inferior, respetando el safe area. */
export function useTabBarBottom(): number {
  return Math.max(useSafeAreaInsets().bottom + TAB_BAR_ELEVACION, TAB_BAR_BOTTOM_MINIMO)
}

/**
 * Espacio inferior que necesita una pantalla de pestaña: la barra flota sobre el
 * contenido, así que listas y botones fijos tienen que reservarlo.
 */
export function useEspacioTabBar(): number {
  return useTabBarBottom() + TAB_BAR_ALTO + AIRE_SOBRE_BARRA
}
