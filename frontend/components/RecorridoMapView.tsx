import { useEffect, useRef } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps'

import { useTheme } from '@/components/MeshUI'
import { getMapStyle } from '@/components/route-config/mapStyles'

/**
 * US2: dibuja la traza GPS realmente recorrida en un viaje finalizado.
 * OpenStreetMap vía UrlTile, igual que el resto de los mapas de la app.
 */
type Props = {
  puntos: [number, number][]
  cargando?: boolean
  altura?: number
}

const PADDING_FIT = { top: 40, right: 40, bottom: 40, left: 40 }

export function RecorridoMapView({ puntos, cargando = false, altura = 220 }: Props) {
  const theme = useTheme()
  const mapRef = useRef<MapView>(null)
  const capa = getMapStyle('standard')
  const hayTraza = puntos.length > 1

  useEffect(() => {
    if (!hayTraza) return
    // Un frame de gracia: en Android el ajuste se pierde si el mapa no terminó de montar.
    const id = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        puntos.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
        { edgePadding: PADDING_FIT, animated: false }
      )
    }, 350)
    return () => clearTimeout(id)
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
  const fin = puntos[puntos.length - 1]!

  return (
    <View style={[styles.caja, { height: altura }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: inicio[0],
          longitude: inicio[1],
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        mapType={Platform.OS === 'android' ? 'none' : 'mutedStandard'}
        pointerEvents="none"
        showsUserLocation={false}
      >
        <UrlTile
          urlTemplate={capa.urlTemplate}
          maximumZ={capa.maximumZ}
          flipY={capa.flipY}
          zIndex={-1}
        />
        <Polyline
          coordinates={puntos.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))}
          strokeColor={theme.accent}
          strokeWidth={4}
        />
        <Marker
          coordinate={{ latitude: inicio[0], longitude: inicio[1] }}
          title="Inicio"
          pinColor="#15803d"
        />
        <Marker
          coordinate={{ latitude: fin[0], longitude: fin[1] }}
          title="Fin"
          pinColor="#dc2626"
        />
      </MapView>
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
