import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

import { MAP_STYLES, type MapStyleId } from '@/components/route-config/mapStyles'

const CLAVE = 'mesh:capaMapaInicio'

function esCapaValida(valor: string | null): valor is MapStyleId {
  return MAP_STYLES.some((estilo) => estilo.id === valor)
}

/** Vista del mapa de Inicio, recordada en el dispositivo entre aperturas de la app. */
export function useCapaMapa(): [MapStyleId, (id: MapStyleId) => void] {
  const [capa, setCapa] = useState<MapStyleId>('standard')

  useEffect(() => {
    let vigente = true
    AsyncStorage.getItem(CLAVE)
      .then((guardada) => {
        if (vigente && esCapaValida(guardada)) setCapa(guardada)
      })
      .catch(() => {
        // Si no se puede leer, queda la vista predeterminada.
      })
    return () => {
      vigente = false
    }
  }, [])

  const elegir = useCallback((id: MapStyleId) => {
    setCapa(id)
    void AsyncStorage.setItem(CLAVE, id).catch(() => {
      // Sin almacenamiento, la elección vale hasta cerrar la app.
    })
  }, [])

  return [capa, elegir]
}
