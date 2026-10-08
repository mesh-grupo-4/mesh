import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { getMapStyle, type MapStyleId } from '@/components/route-config/mapStyles'
import { PinMarker, PIN_ANCHOR } from '@/components/maps/PinMarker'
import {
  MeshMapView,
  zoomFromLatDelta,
  type PolylineSpec,
  type MeshMapViewHandle,
  type MarkerSpec,
} from '@/components/maps/MeshMapView'
import type { MemberLocation } from '@/hooks/useLiveLocations'
import type { AlertaApi } from '@/lib/alertasApi'

import { AlertMarker, alertMarkerKey, alertMarkerPopup } from './AlertMarker'
import { GHOST_TRAIL_COLOR, GhostMarker } from './GhostMarker'
import { MemberMarker, memberMarkerKey } from './MemberMarker'
import { ParadaMarker, paradaMarkerPopup } from './ParadaMarker'
import type { CategoriaParadaApi } from '@/lib/paradasApi'
import { motivoParadaLegible } from '@/lib/paradasApi'

const COLOR_GUIA_LUGAR = '#0e7490'

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
  /** Guía hacia un lugar elegido en "Cerca mío" (Google Places). */
  guiaLugar?: GuiaDestino | null
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
    guiaLugar = null,
    fantasma = null,
    currentUserId,
    initialCenter,
    mapStyle,
    onUserDrag,
  },
  ref
) {
  const mapRef = useRef<MeshMapViewHandle>(null)
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
      content: <MemberMarker member={m} isMe={m.usuarioId === currentUserId} />,
      contentKey: memberMarkerKey({ member: m, isMe: m.usuarioId === currentUserId }),
      zIndex: m.usuarioId === currentUserId ? 1000 : 0,
    }))

    const alertas: MarkerSpec[] = alertasEnMapa
      .filter((a) => a.lat != null && a.lng != null)
      .map((a) => ({
        id: `alerta-${a.id}`,
        lat: a.lat!,
        lng: a.lng!,
        content: <AlertMarker alerta={a} />,
        contentKey: alertMarkerKey(a),
        zIndex: 500,
        popup: alertMarkerPopup(a),
      }))

    const paradaGuia: MarkerSpec[] = guiaParada
      ? [
          {
            id: `parada-guia-${guiaParada.destino.lat}-${guiaParada.destino.lng}`,
            lat: guiaParada.destino.lat,
            lng: guiaParada.destino.lng,
            content: <ParadaMarker />,
            contentKey: 'parada',
            zIndex: 600,
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
            content: <ParadaMarker />,
            contentKey: 'parada',
            zIndex: 650,
            popup: paradaMarkerPopup(guiaAlerta.destino.nombre, 'Punto de parada'),
          },
        ]
      : []

    const lugarGuia: MarkerSpec[] = guiaLugar
      ? [
          {
            id: `lugar-guia-${guiaLugar.destino.lat}-${guiaLugar.destino.lng}`,
            lat: guiaLugar.destino.lat,
            lng: guiaLugar.destino.lng,
            content: <PinMarker color={guiaLugar.color ?? COLOR_GUIA_LUGAR} />,
            contentKey: guiaLugar.color ?? COLOR_GUIA_LUGAR,
            anchor: PIN_ANCHOR,
            zIndex: 640,
            popup: { title: guiaLugar.destino.nombre },
          },
        ]
      : []

    const ghost: MarkerSpec[] = fantasma
      ? [
          {
            id: 'fantasma',
            lat: fantasma.lat,
            lng: fantasma.lng,
            content: <GhostMarker pausado={fantasma.pausado} />,
            contentKey: fantasma.pausado ? 'pausado' : 'activo',
            zIndex: 900,
            popup: { title: `Fantasma: ${fantasma.nombre}` },
          },
        ]
      : []

    return [...alertaGuia, ...paradaGuia, ...lugarGuia, ...alertas, ...ghost, ...integrantes]
  }, [members, alertasEnMapa, guiaParada, guiaAlerta, guiaLugar, fantasma, currentUserId])

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
    if (guiaLugar && guiaLugar.coords.length > 1) {
      list.push({
        coords: guiaLugar.coords,
        color: guiaLugar.color ?? COLOR_GUIA_LUGAR,
        width: 6,
        opacity: 0.95,
      })
    }
    if (fantasma && fantasma.traza.length > 1) {
      list.push({ coords: fantasma.traza, color: GHOST_TRAIL_COLOR, width: 3, opacity: 0.35 })
    }
    return list
  }, [breadcrumb, routeRemaining, guiaParada, guiaAlerta, guiaLugar, fantasma, capa.routeStrokeColor])

  return (
    <View style={styles.container}>
      <MeshMapView
        ref={mapRef}
        initialCenter={fallbackCenter}
        initialZoom={fallbackZoom}
        mapStyle={capa}
        markers={markers}
        polylines={polylines}
        onUserDrag={onUserDrag}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
