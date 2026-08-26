import { useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { WebMapView, zoomFromLatDelta, type WebMapViewHandle, type MarkerSpec } from '@/components/maps/WebMapView'
import { pinMarkerHtml, PIN_SIZE, PIN_ANCHOR } from '@/components/maps/pinMarker'
import { getMapStyle } from '@/components/route-config/mapStyles'

/**
 * US2: dibuja la traza GPS realmente recorrida en un viaje finalizado.
 * OpenStreetMap vía Leaflet embebido, igual que el resto de los mapas de la app.
 */
type Props = {
  puntos: [number, number][]
  cargando?: boolean
  altura?: number
}

const PADDING_FIT = { top: 40, right: 40, bottom: 40, left: 40 }

export function RecorridoMapView({ puntos, cargando = false, altura = 220 }: Props) {
  const theme = useTheme()
  const mapRef = useRef<WebMapViewHandle>(null)
  const capa = getMapStyle('standard')
  const hayTraza = puntos.length > 1

  useEffect(() => {
    if (!hayTraza) return
    // Un frame de gracia: el WebView todavía puede no estar listo si el fit se pide de inmediato.
    const id = setTimeout(() => {
      mapRef.current?.fitBounds(
        puntos.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
        PADDING_FIT,
        false
      )
    }, 350)
    return () => clearTimeout(id)
  }, [puntos, hayTraza])

  const markers = useMemo<MarkerSpec[]>(() => {
    if (!hayTraza) return []
    const inicio = puntos[0]!
    const fin = puntos[puntos.length - 1]!
    return [
      {
        id: 'inicio',
        lat: inicio[0],
        lng: inicio[1],
        html: pinMarkerHtml('#15803d'),
        size: PIN_SIZE,
        anchor: PIN_ANCHOR,
        popup: 'Inicio',
      },
      {
        id: 'fin',
        lat: fin[0],
        lng: fin[1],
        html: pinMarkerHtml('#dc2626'),
        size: PIN_SIZE,
        anchor: PIN_ANCHOR,
        popup: 'Fin',
      },
    ]
  }, [puntos, hayTraza])

  if (cargando) {
    return (
      <View style={[styles.caja, styles.centro, { height: altura, backgroundColor: theme.surface2 }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  if (!hayTraza) {
    return (
      <View style={[styles.caja, styles.centro, { height: altura, backgroundColor: theme.surface2 }]}>
        <Text style={[styles.vacio, { color: theme.textMute }]}>
          Este viaje no tiene traza GPS registrada.
        </Text>
      </View>
    )
  }

  const inicio = puntos[0]!

  return (
    <View style={[styles.caja, { height: altura }]} pointerEvents="none">
      <WebMapView
        ref={mapRef}
        initialCenter={{ latitude: inicio[0], longitude: inicio[1] }}
        initialZoom={zoomFromLatDelta(0.08)}
        tile={capa}
        interactive={false}
        markers={markers}
        polyline={{
          coords: puntos,
          color: theme.accent,
          width: 4,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  caja: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacio: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
})
