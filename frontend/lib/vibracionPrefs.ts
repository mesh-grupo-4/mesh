import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

/**
 * Preferencia del dispositivo: vibrar con los avisos del viaje (mismo patrón que
 * `temaApp.ts`). Apagarla silencia lo informativo y lo importante; lo crítico
 * —una persona en riesgo— vibra siempre (ver `haptics.ts`).
 */
const CLAVE = 'mesh:vibracionAvisos'

let activa = true
const oyentes = new Set<() => void>()

export function vibracionAvisosActiva(): boolean {
  return activa
}

export function elegirVibracionAvisos(valor: boolean) {
  activa = valor
  oyentes.forEach((oyente) => oyente())
  void AsyncStorage.setItem(CLAVE, valor ? '1' : '0').catch(() => {
    // Sin almacenamiento, el cambio vale hasta cerrar la app.
  })
}

/** Restaura la elección guardada. Sin elección, vibra. */
export async function cargarVibracionAvisos(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(CLAVE)) === '0') {
      activa = false
      oyentes.forEach((oyente) => oyente())
    }
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

export function useVibracionAvisos(): boolean {
  return useSyncExternalStore(suscribir, () => activa)
}
