import { useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { MeshMapView, zoomFromLatDelta, type MeshMapViewHandle, type MarkerSpec } from '@/components/maps/MeshMapView'
import { PinMarker, PIN_ANCHOR } from '@/components/maps/PinMarker'
import { getMapStyle } from '@/components/route-config/mapStyles'

/**
 * US2: dibuja la traza GPS realmente recorrida en un viaje finalizado.
 * Google Maps nativo (`MeshMapView`), igual que el resto de los mapas de la app.
 *
 * `segmentos` viene partido en tramos contiguos (un hueco de señal largo o un
 * salto de posición imposible entre pings corta la traza en un tramo nuevo): cada
 * tramo se dibuja como su propia polilínea, para no conectar dos tramos con una
 * línea recta que atraviese el mapa.
 */
type Props = {
  segmentos: [number, number][][]
  cargando?: boolean
  altura?: number
}

const PADDING_FIT = { top: 40, right: 40, bottom: 40, left: 40 }

export function RecorridoMapView({ segmentos, cargando = false, altura = 220 }: Props) {
  const theme = useTheme()
  const mapRef = useRef<MeshMapViewHandle>(null)
  const capa = getMapStyle('standard')
  const puntos = useMemo(() => segmentos.flat(), [segmentos])
  const hayTraza = puntos.length > 1

  useEffect(() => {
    if (!hayTraza) return
    // Si el mapa todavía no está listo, MeshMapView aplica el fit en onMapReady.
    mapRef.current?.fitBounds(
      puntos.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
      PADDING_FIT,
      false
    )
  }, [puntos, hayTraza])

  const polylines = useMemo(
    () =>
      segmentos
        .filter((tramo) => tramo.length > 1)
        .map((tramo) => ({ coords: tramo, color: theme.accent, width: 4 })),
    [segmentos, theme.accent]
  )

  const markers = useMemo<MarkerSpec[]>(() => {
    if (!hayTraza) return []
    const inicio = puntos[0]!
    const fin = puntos[puntos.length - 1]!
    return [
      {
        id: 'inicio',
        lat: inicio[0],
        lng: inicio[1],
        content: <PinMarker color="#15803d" />,
        contentKey: 'inicio',
        anchor: PIN_ANCHOR,
        popup: { title: 'Inicio' },
      },
      {
        id: 'fin',
        lat: fin[0],
        lng: fin[1],
        content: <PinMarker color="#dc2626" />,
        contentKey: 'fin',
        anchor: PIN_ANCHOR,
        popup: { title: 'Fin' },
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
      <MeshMapView
        ref={mapRef}
        initialCenter={{ latitude: inicio[0], longitude: inicio[1] }}
        initialZoom={zoomFromLatDelta(0.08)}
        mapStyle={capa}
        interactive={false}
        markers={markers}
        polylines={polylines}
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
