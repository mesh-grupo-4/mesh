import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import { Appearance } from 'react-native'

import { MAP_STYLES, type MapStyleId } from '@/components/route-config/mapStyles'

const CLAVE = 'mesh:capaMapaInicio'

function esCapaValida(valor: string | null): valor is MapStyleId {
  return MAP_STYLES.some((estilo) => estilo.id === valor)
}

// Una sola elección para toda la app: lo que se elige en un mapa vale en todos.
// Hasta que el usuario elige, arranca según el tema del dispositivo.
let capaActual: MapStyleId = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
let cargaPedida = false
let elegidaEnSesion = false
const suscriptores = new Set<() => void>()

function publicar(id: MapStyleId) {
  capaActual = id
  suscriptores.forEach((avisar) => avisar())
}

function suscribir(avisar: () => void) {
  suscriptores.add(avisar)
  if (!cargaPedida) {
    cargaPedida = true
    AsyncStorage.getItem(CLAVE)
      .then((guardada) => {
        if (!elegidaEnSesion && esCapaValida(guardada)) publicar(guardada)
      })
      .catch(() => {
        // Si no se puede leer, queda la vista predeterminada.
      })
  }
  return () => {
    suscriptores.delete(avisar)
  }
}

function leer() {
  return capaActual
}

function elegir(id: MapStyleId) {
  elegidaEnSesion = true
  publicar(id)
  void AsyncStorage.setItem(CLAVE, id).catch(() => {
    // Sin almacenamiento, la elección vale hasta cerrar la app.
  })
}

/** Vista del mapa elegida por el usuario: compartida por todos los mapas y recordada en el dispositivo. */
export function useCapaMapa(): [MapStyleId, (id: MapStyleId) => void] {
  return [useSyncExternalStore(suscribir, leer, leer), elegir]
}
