import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { getMapStyle, type MapStyleId } from '@/components/route-config/mapStyles'
import {
  WebMapView,
  zoomFromLatDelta,
  type PolylineSpec,
  type WebMapViewHandle,
  type MarkerSpec,
} from '@/components/maps/WebMapView'
import type { MemberLocation } from '@/hooks/useLiveLocations'
import type { AlertaApi } from '@/lib/alertasApi'

import { alertMarkerHtml, alertMarkerPopup } from './alertMarker'
import { memberMarkerHtml } from './memberMarker'

export type LiveMapViewHandle = {
  focusOnCoordinate: (lat: number, lng: number) => void
}

type Props = {
  routeRemaining: [number, number][] | null
  breadcrumb: [number, number][] | null
  members: MemberLocation[]
  /** Alertas activas con ubicación — p. ej. desvíos detectados por el motor (RN-034). */
  alertasEnMapa?: AlertaApi[]
  currentUserId: string
  initialCenter: { latitude: number; longitude: number } | null
  mapStyle: MapStyleId
}

export const LiveMapView = forwardRef<LiveMapViewHandle, Props>(function LiveMapView(
  { routeRemaining, breadcrumb, members, alertasEnMapa = [], currentUserId, initialCenter, mapStyle },
  ref
) {
  const mapRef = useRef<WebMapViewHandle>(null)
  const capa = getMapStyle(mapStyle)
  const centeredOnce = useRef(false)

  useImperativeHandle(ref, () => ({
    focusOnCoordinate(lat, lng) {
      mapRef.current?.animateTo({ latitude: lat, longitude: lng }, 15)
    },
  }))

  useEffect(() => {
    if (!initialCenter || centeredOnce.current) return
    centeredOnce.current = true
    mapRef.current?.animateTo(initialCenter, 15)
  }, [initialCenter])

  const fallbackCenter = initialCenter ?? { latitude: -31.4167, longitude: -64.1833 }
  const fallbackZoom = zoomFromLatDelta(initialCenter ? 0.04 : 0.08)

  const markers = useMemo<MarkerSpec[]>(() => {
    const integrantes: MarkerSpec[] = members.map((m) => ({
      id: m.usuarioId,
      lat: m.lat,
      lng: m.lng,
      html: memberMarkerHtml(m, m.usuarioId === currentUserId),
      size: [48, 48],
      anchor: [24, 24],
      zIndexOffset: m.usuarioId === currentUserId ? 1000 : 0,
    }))

    const alertas: MarkerSpec[] = alertasEnMapa
      .filter((a) => a.lat != null && a.lng != null)
      .map((a) => ({
        id: `alerta-${a.id}`,
        lat: a.lat!,
        lng: a.lng!,
        html: alertMarkerHtml(a),
        size: [36, 36],
        anchor: [18, 18],
        zIndexOffset: 500,
        popup: alertMarkerPopup(a),
      }))

    return [...alertas, ...integrantes]
  }, [members, alertasEnMapa, currentUserId])

  const polylines = useMemo((): PolylineSpec[] => {
    const list: PolylineSpec[] = []
    if (breadcrumb && breadcrumb.length > 1) {
      list.push({
        coords: breadcrumb,
        color: capa.routeStrokeColor,
        width: 4,
        opacity: 0.55,
      })
    }
    if (routeRemaining && routeRemaining.length > 1) {
      list.push({
        coords: routeRemaining,
        color: capa.routeStrokeColor,
        width: 5,
        opacity: 0.95,
      })
    }
    return list
  }, [breadcrumb, routeRemaining, capa.routeStrokeColor])

  return (
    <View style={styles.container}>
      <WebMapView
        ref={mapRef}
        initialCenter={fallbackCenter}
        initialZoom={fallbackZoom}
        tile={capa}
        markers={markers}
        polylines={polylines}
      />
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
