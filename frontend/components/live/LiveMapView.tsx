import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import MapView, { Polyline, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps'

import { MemberMapMarker } from '@/components/live/MemberMapMarker'
import { getMapStyle, type MapStyleId } from '@/components/route-config/mapStyles'
import type { MemberLocation } from '@/hooks/useLiveLocations'

export type LiveMapViewHandle = {
  focusOnCoordinate: (lat: number, lng: number) => void
}

type Props = {
  routeLineLatLng: [number, number][] | null
  members: MemberLocation[]
  currentUserId: string
  initialCenter: { latitude: number; longitude: number } | null
  mapStyle: MapStyleId
}

export const LiveMapView = forwardRef<LiveMapViewHandle, Props>(function LiveMapView(
  { routeLineLatLng, members, currentUserId, initialCenter, mapStyle },
  ref
) {
  const mapRef = useRef<MapView>(null)
  const capa = getMapStyle(mapStyle)
  const centeredOnce = useRef(false)

  useImperativeHandle(ref, () => ({
    focusOnCoordinate(lat, lng) {
      mapRef.current?.animateCamera({ center: { latitude: lat, longitude: lng }, zoom: 15 }, { duration: 400 })
    },
  }))

  useEffect(() => {
    if (!initialCenter || centeredOnce.current) return
    centeredOnce.current = true
    mapRef.current?.animateCamera({ center: initialCenter, zoom: 15 }, { duration: 400 })
  }, [initialCenter])

  const fallbackRegion = initialCenter
    ? {
        latitude: initialCenter.latitude,
        longitude: initialCenter.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }
    : {
        latitude: -31.4167,
        longitude: -64.1833,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={fallbackRegion}
        showsUserLocation
        showsMyLocationButton={false}
        mapType={Platform.OS === 'android' ? 'none' : 'mutedStandard'}
      >
        <UrlTile
          key={capa.id}
          urlTemplate={capa.urlTemplate}
          maximumZ={capa.maximumZ}
          flipY={capa.flipY}
          zIndex={-1}
        />
        {routeLineLatLng && routeLineLatLng.length > 1 ? (
          <Polyline
            coordinates={routeLineLatLng.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))}
            strokeColor={capa.routeStrokeColor}
            strokeWidth={5}
          />
        ) : null}
        {members.map((m) => (
          <MemberMapMarker key={m.usuarioId} member={m} isMe={m.usuarioId === currentUserId} />
        ))}
      </MapView>
      <View
        style={[
          styles.attribution,
          mapStyle === 'dark' && styles.attributionDark,
        ]}
        pointerEvents="none"
      >
        <Text
          style={[styles.attributionTxt, mapStyle === 'dark' && styles.attributionTxtDark]}
          numberOfLines={1}
        >
          {capa.attribution}
        </Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  attribution: {
    position: 'absolute',
    left: 8,
    top: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '55%',
  },
  attributionDark: {
    backgroundColor: 'rgba(17,24,39,0.85)',
  },
  attributionTxt: {
    fontSize: 10,
    color: '#374151',
  },
  attributionTxtDark: {
    color: '#e5e7eb',
  },
})
