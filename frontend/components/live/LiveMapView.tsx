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
import { GHOST_MARKER_BOX, GHOST_TRAIL_COLOR, ghostMarkerHtml } from './ghostMarker'
import { memberMarkerHtml, MEMBER_MARKER_BOX } from './memberMarker'
import { paradaMarkerHtml, paradaMarkerPopup } from './paradaMarker'
import type { CategoriaParadaApi } from '@/lib/paradasApi'
import { motivoParadaLegible } from '@/lib/paradasApi'

export type LiveMapViewHandle = {
  focusOnCoordinate: (lat: number, lng: number) => void
  fitBoundsToCoords: (coords: [number, number][]) => void
  /** Recentra sin tocar el zoom — para el modo "seguirme". */
  panTo: (lat: number, lng: number) => void
}

type GuiaDestino = {
  coords: [number, number][]
  destino: { lat: number; lng: number; nombre: string; categoria?: CategoriaParadaApi | null }
  color?: string
}

type Props = {
  routeRemaining: [number, number][] | null
  /** Traza propia recorrida, cortada en tramos cuando hubo un salto/hueco de señal. */
  breadcrumb: [number, number][][] | null
  members: MemberLocation[]
  /** Alertas activas con ubicación — p. ej. desvíos detectados por el motor (RN-034). */
  alertasEnMapa?: AlertaApi[]
  guiaParada?: GuiaDestino | null
  guiaAlerta?: GuiaDestino | null
  /** RN-073: fantasma animado y su recorrido completo. */
  fantasma?: { lat: number; lng: number; nombre: string; pausado: boolean; traza: [number, number][] } | null
  currentUserId: string
  initialCenter: { latitude: number; longitude: number } | null
  mapStyle: MapStyleId
  /** El usuario arrastró el mapa a mano — señal para pausar el modo "seguirme". */
  onUserDrag?: () => void
}

export const LiveMapView = forwardRef<LiveMapViewHandle, Props>(function LiveMapView(
  {
    routeRemaining,
    breadcrumb,
    members,
    alertasEnMapa = [],
    guiaParada = null,
    guiaAlerta = null,
    fantasma = null,
    currentUserId,
    initialCenter,
    mapStyle,
    onUserDrag,
  },
  ref
) {
  const mapRef = useRef<WebMapViewHandle>(null)
  const capa = getMapStyle(mapStyle)
  const centeredOnce = useRef(false)

  useImperativeHandle(ref, () => ({
    focusOnCoordinate(lat, lng) {
      mapRef.current?.animateTo({ latitude: lat, longitude: lng }, 15)
    },
    fitBoundsToCoords(coords) {
      if (coords.length < 2) return
      mapRef.current?.fitBounds(
        coords.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
      )
    },
    panTo(lat, lng) {
      mapRef.current?.panTo({ latitude: lat, longitude: lng })
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
      size: [MEMBER_MARKER_BOX, MEMBER_MARKER_BOX],
      anchor: [MEMBER_MARKER_BOX / 2, MEMBER_MARKER_BOX / 2],
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

    const paradaGuia: MarkerSpec[] = guiaParada
      ? [
          {
            id: `parada-guia-${guiaParada.destino.lat}-${guiaParada.destino.lng}`,
            lat: guiaParada.destino.lat,
            lng: guiaParada.destino.lng,
            html: paradaMarkerHtml(),
            size: [36, 36],
            anchor: [18, 18],
            zIndexOffset: 600,
            popup: paradaMarkerPopup(
              guiaParada.destino.nombre,
              motivoParadaLegible(guiaParada.destino.categoria ?? null)
            ),
          },
        ]
      : []

    const alertaGuia: MarkerSpec[] = guiaAlerta
      ? [
          {
            id: `alerta-guia-${guiaAlerta.destino.lat}-${guiaAlerta.destino.lng}`,
            lat: guiaAlerta.destino.lat,
            lng: guiaAlerta.destino.lng,
            html: paradaMarkerHtml(),
            size: [36, 36],
            anchor: [18, 18],
            zIndexOffset: 650,
            popup: paradaMarkerPopup(guiaAlerta.destino.nombre, 'Punto de parada'),
          },
        ]
      : []

    const ghost: MarkerSpec[] = fantasma
      ? [
          {
            id: 'fantasma',
            lat: fantasma.lat,
            lng: fantasma.lng,
            html: ghostMarkerHtml(fantasma.nombre, fantasma.pausado),
            size: [GHOST_MARKER_BOX, GHOST_MARKER_BOX],
            anchor: [GHOST_MARKER_BOX / 2, GHOST_MARKER_BOX / 2],
            zIndexOffset: 900,
            popup: `Fantasma: ${fantasma.nombre}`,
          },
        ]
      : []

    return [...alertaGuia, ...paradaGuia, ...alertas, ...ghost, ...integrantes]
  }, [members, alertasEnMapa, guiaParada, guiaAlerta, fantasma, currentUserId])

  const polylines = useMemo((): PolylineSpec[] => {
    const list: PolylineSpec[] = []
    if (breadcrumb) {
      for (const segmento of breadcrumb) {
        if (segmento.length < 2) continue
        list.push({
          coords: segmento,
          color: capa.routeStrokeColor,
          width: 4,
          opacity: 0.55,
        })
      }
    }
    if (routeRemaining && routeRemaining.length > 1) {
      list.push({
        coords: routeRemaining,
        color: capa.routeStrokeColor,
        width: 5,
        opacity: 0.95,
      })
    }
    if (guiaParada && guiaParada.coords.length > 1) {
      list.push({
        coords: guiaParada.coords,
        color: guiaParada.color ?? '#f59e0b',
        width: 6,
        opacity: 0.95,
      })
    }
    if (guiaAlerta && guiaAlerta.coords.length > 1) {
      list.push({
        coords: guiaAlerta.coords,
        color: guiaAlerta.color ?? '#4338ca',
        width: 6,
        opacity: 0.95,
      })
    }
    if (fantasma && fantasma.traza.length > 1) {
      list.push({ coords: fantasma.traza, color: GHOST_TRAIL_COLOR, width: 3, opacity: 0.35 })
    }
    return list
  }, [breadcrumb, routeRemaining, guiaParada, guiaAlerta, fantasma, capa.routeStrokeColor])

  return (
    <View style={styles.container}>
      <WebMapView
        ref={mapRef}
        initialCenter={fallbackCenter}
        initialZoom={fallbackZoom}
        tile={capa}
        markers={markers}
        polylines={polylines}
        onUserDrag={onUserDrag}
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
