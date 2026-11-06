import { Platform } from 'react-native'

/**
 * Convenciones de navegación que cambian entre sistemas. Toda diferencia de
 * interacción entre iOS y Android se decide acá, no en cada pantalla.
 */

/** Android entra en selección con pulsación larga; iOS, con un botón "Seleccionar". */
export const SELECCION_CON_PULSACION_LARGA = Platform.OS === 'android'

/** iOS usa un chevrón para volver; Android, la flecha de Material. */
export const ICONO_VOLVER = Platform.OS === 'ios' ? ('chevron-left' as const) : ('arrow-left' as const)

/** En iOS el título de una pantalla con botón de volver va centrado; en Android, a la izquierda. */
export const TITULO_CENTRADO = Platform.OS === 'ios'
