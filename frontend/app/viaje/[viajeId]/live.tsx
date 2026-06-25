import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, 
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { meshAlert } from '@/lib/meshAlert';

import { CenterLocationButton } from '@/components/live/CenterLocationButton'
import { LiveMapView, type LiveMapViewHandle } from '@/components/live/LiveMapView'
import type { LiveMember } from '@/components/live/LiveMembersBar'
import { LiveTripHeader } from '@/components/live/LiveTripHeader'
import { TripMetricsPanel } from '@/components/live/TripMetricsPanel'
import { MapStylePicker } from '@/components/route-config/MapStylePicker'
import type { MapStyleId } from '@/components/route-config/mapStyles'
import { DEV_USER_ID, API_BASE_URL } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import { useLiveLocations } from '@/hooks/useLiveLocations'
import { useNextStopEta } from '@/hooks/useNextStopEta'
import { useTripMetrics } from '@/hooks/useTripMetrics'
import type { RouteStop } from '@/lib/geo/nextStop'
import { linestringToLatLng, waypointsFromRutaDetalle } from '@/lib/routePayload'
import { connectMeshSocket } from '@/lib/meshSocket'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  detenerTrackingViaje,
  iniciarTrackingViaje,
  solicitarPermisosUbicacion,
} from '@/lib/tracking/trackingControl'
import {
  listarParticipantesViaje,
  obtenerRuta,
  obtenerViaje,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
} from '@/lib/viajesApi'

export default function ViajeLiveScreen() {
  const router = useRouter()
  const { backendUserId } = useAuth()
  const params = useLocalSearchParams<{ viajeId: string | string[]; userId?: string | string[] }>()
  const mapRef = useRef<LiveMapViewHandle>(null)

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userFromQuery = useMemo(() => {
    const u = params.userId
    const raw = Array.isArray(u) ? u[0] : u
    return raw?.trim() || backendUserId || DEV_USER_ID || ''
  }, [params.userId, backendUserId])

  const userId = userFromQuery
  const [viaje, setViaje] = useState<ViajeDetalleApi | null>(null)
  const [participantes, setParticipantes] = useState<ViajeParticipanteApi[]>([])
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null)
  const [routeStops, setRouteStops] = useState<RouteStop[]>([])
  const [initialCenter, setInitialCenter] = useState<{ latitude: number; longitude: number } | null>(
    null
  )
  const [fg, setFg] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapStyle, setMapStyle] = useState<MapStyleId>('standard')

  const nameByUserId = useMemo(() => {
    const map: Record<string, string> = {}
    if (viaje?.creador) {
      map[viaje.creador.id] = viaje.creador.nombre
    }
    for (const p of participantes) {
      if (p.estado === 'confirmado') {
        map[p.usuario.id] = p.usuario.nombre
      }
    }
    return map
  }, [viaje, participantes])

  const { memberList, realtimeOk } = useLiveLocations({ viajeId: viajeId ?? '', userId, nameByUserId })

  const myPosition = useMemo(() => {
    const me = memberList.find((m) => m.usuarioId === userId)
    if (me) return { lat: me.lat, lng: me.lng }
    if (initialCenter) return { lat: initialCenter.latitude, lng: initialCenter.longitude }
    return null
  }, [memberList, userId, initialCenter])

  const nextStop = useNextStopEta({
    currentPos: myPosition,
    stops: routeStops,
    speedKmh: viaje?.velocidad_esperada ?? 30,
  })

  const liveMembers = useMemo((): LiveMember[] => {
    const seen = new Set<string>()
    const list: LiveMember[] = []
    const onMap = new Set(memberList.map((m) => m.usuarioId))

    const add = (id: string, nombre: string) => {
      if (seen.has(id)) return
      seen.add(id)
      list.push({ id, nombre, enMapa: onMap.has(id) })
    }

    if (viaje?.creador) add(viaje.creador.id, viaje.creador.nombre)
    for (const p of participantes) {
      if (p.estado === 'confirmado') add(p.usuario.id, p.usuario.nombre)
    }
    for (const m of memberList) {
      add(m.usuarioId, m.nombre)
    }

    return list
  }, [viaje, participantes, memberList])

  const tripDisplayName = useMemo(() => {
    if (viaje?.nombre?.trim()) return viaje.nombre.trim()
    return viaje?.es_grupal ? 'Salida grupal' : 'Salida individual'
  }, [viaje])

  const { elapsedLabel, distanceLabel } = useTripMetrics({
    userId,
    fechaInicioReal: viaje?.fecha_inicio_real ?? null,
  })

  useEffect(() => {
    if (userId.trim()) void AsyncStorage.setItem('mesh:activeUserId', userId.trim())
  }, [userId])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return
    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const [v, parts, ruta] = await Promise.all([
          obtenerViaje(viajeId, userId),
          listarParticipantesViaje(viajeId, userId),
          obtenerRuta(viajeId, userId),
        ])
        if (cancelled) return
        setViaje(v)
        setParticipantes(parts)
        if (ruta?.linestring) {
          setRouteLine(linestringToLatLng(ruta.linestring))
          const h = waypointsFromRutaDetalle(ruta)
          const stops: RouteStop[] = [
            { lat: h.origen.lat, lng: h.origen.lon, name: h.origen.name || 'Origen', type: 'ORIGIN' },
            ...h.paradas.map((p) => ({
              lat: p.lat,
              lng: p.lon,
              name: p.name || 'Parada',
              type: 'STOP' as const,
            })),
            {
              lat: h.destino.lat,
              lng: h.destino.lon,
              name: h.destino.name || 'Destino',
              type: 'DESTINATION',
            },
          ]
          setRouteStops(stops)
        } else {
          setRouteStops([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [viajeId, userId])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return

    let cleanup: (() => void) | undefined

    void (async () => {
      const sock = await connectMeshSocket()
      sock.emit('join_viaje', { viajeId })

      const onFin = (payload: { viajeId: string }) => {
        if (payload.viajeId !== viajeId) return
        void detenerTrackingViaje()
        meshAlert('Viaje finalizado', 'Se detuvo el seguimiento GPS.', [
          { text: 'OK', onPress: () => router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId } }) },
        ])
      }

      sock.on('viaje:finalizado', onFin)
      cleanup = () => sock.off('viaje:finalizado', onFin)
    })()

    return () => cleanup?.()
  }, [viajeId, userId, router])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!viajeId || !userId.trim() || Platform.OS === 'web') return
      const perm = await solicitarPermisosUbicacion()
      if (cancelled) return
      setFg(perm.foreground)
      if (perm.foreground) {
        await iniciarTrackingViaje(viajeId, userId.trim())
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        if (!cancelled) {
          setInitialCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        }
      } catch {
        if (routeLine?.[0] && !cancelled) {
          const [lat, lng] = routeLine[0]
          setInitialCenter({ latitude: lat, longitude: lng })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [viajeId, userId, routeLine])

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((r) => setFg(r.status === 'granted'))
  }, [])

  const handleCenterOnMe = () => {
    void (async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        mapRef.current?.focusOnCoordinate(pos.coords.latitude, pos.coords.longitude)
      } catch {
        const me = memberList.find((m) => m.usuarioId === userId)
        if (me) mapRef.current?.focusOnCoordinate(me.lat, me.lng)
      }
    })()
  }

  if (!viajeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Viaje no especificado.</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <LiveMapView
        ref={mapRef}
        routeLineLatLng={routeLine}
        members={memberList}
        currentUserId={userId}
        initialCenter={initialCenter}
        mapStyle={mapStyle}
      />

      <LiveTripHeader
        tripName={tripDisplayName}
        nextStop={nextStop}
        hasRoute={routeStops.length > 0}
        members={liveMembers}
        currentUserId={userId}
        onBack={() => router.back()}
      />

      <MapStylePicker value={mapStyle} onChange={setMapStyle} topOffset={128} />

      <CenterLocationButton onPress={handleCenterOnMe} bottomOffset={140} />

      {fg === false ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnTxt}>
            Ubicación desconocida: tu posición no se compartirá hasta que otorgues permisos.
          </Text>
        </View>
      ) : null}

      {!realtimeOk && isSupabaseConfigured() ? (
        <View style={[styles.infoBanner, fg === false && styles.infoBannerBelowWarn]}>
          <Text style={styles.infoTxt}>
            Realtime Supabase desconectado; usamos WebSocket y refresco cada 15 s.
          </Text>
        </View>
      ) : null}

      {__DEV__ && Platform.OS === 'ios' && API_BASE_URL.includes('localhost') ? (
        <View style={[styles.infoBanner, { top: Platform.OS === 'ios' ? 96 : 56 }]}>
          <Text style={styles.infoTxt}>
            iOS no puede usar localhost. Agregá EXPO_PUBLIC_API_URL=http://IP_PC:3000 en .env
          </Text>
        </View>
      ) : null}

      <TripMetricsPanel elapsedLabel={elapsedLabel} distanceLabel={distanceLabel} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    color: '#6b7280',
    fontSize: 15,
  },
  warnBanner: {
    position: 'absolute',
    top: 130,
    left: 12,
    right: 12,
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 10,
    zIndex: 15,
  },
  warnTxt: {
    color: '#92400e',
    fontSize: 13,
  },
  infoBanner: {
    position: 'absolute',
    top: 130,
    left: 12,
    right: 12,
    backgroundColor: '#dbeafe',
    padding: 8,
    borderRadius: 8,
    zIndex: 15,
  },
  infoBannerBelowWarn: {
    top: 190,
  },
  infoTxt: {
    color: '#1e40af',
    fontSize: 12,
  },
})
