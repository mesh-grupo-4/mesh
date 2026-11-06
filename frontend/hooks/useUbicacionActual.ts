import { useEffect, useState } from 'react'
import * as Location from 'expo-location'

import type { LatLng } from '@/components/maps/MeshMapView'

/**
 * Posición del dispositivo para mostrar "estoy acá" en el mapa. Es solo local:
 * no se envía ni se publica (eso pasa recién dentro de un viaje, RN-110/111).
 *
 * Con `seguir` se suscribe a los cambios mientras `activo` sea true (p. ej.
 * solo con la pantalla enfocada); sin `seguir` toma una única lectura.
 */
export function useUbicacionActual({ activo = true, seguir = false } = {}) {
  const [ubicacion, setUbicacion] = useState<LatLng | null>(null)
  const [permisoDenegado, setPermisoDenegado] = useState(false)

  useEffect(() => {
    if (!activo) return
    let cancelado = false
    let sub: Location.LocationSubscription | null = null

    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (cancelado) return
        if (status !== 'granted') {
          setPermisoDenegado(true)
          return
        }
        setPermisoDenegado(false)

        const ultima = await Location.getLastKnownPositionAsync()
        if (!cancelado && ultima) {
          setUbicacion({ latitude: ultima.coords.latitude, longitude: ultima.coords.longitude })
        }

        if (seguir) {
          const s = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
            (pos) => setUbicacion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
          )
          if (cancelado) s.remove()
          else sub = s
        } else {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          if (!cancelado) {
            setUbicacion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
          }
        }
      } catch {
        /* sin ubicación: el mapa queda en la región por defecto */
      }
    })()

    return () => {
      cancelado = true
      sub?.remove()
    }
  }, [activo, seguir])

  return { ubicacion, permisoDenegado }
}
