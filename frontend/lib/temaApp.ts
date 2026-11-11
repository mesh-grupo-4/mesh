import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import { Appearance, type ColorSchemeName } from 'react-native'

export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro'

const CLAVE = 'mesh:preferenciaTema'
const ESQUEMA: Record<PreferenciaTema, ColorSchemeName> = {
  sistema: 'unspecified',
  claro: 'light',
  oscuro: 'dark',
}

/**
 * Tema del teléfono al abrir la app, antes de aplicar la preferencia guardada. El splash
 * nativo sale con este tema: no conoce la elección hecha dentro de la app.
 */
export const esquemaDelSplash: 'light' | 'dark' =
  Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'

let actual: PreferenciaTema = 'sistema'
const oyentes = new Set<() => void>()

function aplicar(preferencia: PreferenciaTema) {
  actual = preferencia
  // `useColorScheme` sigue a `Appearance`: el cambio llega solo a toda la app.
  Appearance.setColorScheme(ESQUEMA[preferencia])
  oyentes.forEach((oyente) => oyente())
}

export function elegirPreferenciaTema(preferencia: PreferenciaTema) {
  aplicar(preferencia)
  void AsyncStorage.setItem(CLAVE, preferencia).catch(() => {
    // Sin almacenamiento, el cambio vale hasta cerrar la app.
  })
}

/** Restaura la elección guardada. Sin elección, la app sigue al teléfono. */
export async function cargarPreferenciaTema(): Promise<void> {
  try {
    const guardada = await AsyncStorage.getItem(CLAVE)
    if (guardada === 'claro' || guardada === 'oscuro') aplicar(guardada)
  } catch {
    // Si no se puede leer, se mantiene la opción predeterminada.
  }
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function usePreferenciaTema(): PreferenciaTema {
  return useSyncExternalStore(suscribir, () => actual)
}
