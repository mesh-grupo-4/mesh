import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'

import { Btn, useTheme } from '@/components/MeshUI'
import { RouteMapView } from '@/components/route-config/RouteMapView'
import type { RouteWaypoint } from '@/components/route-config/routeTypes'
import { waypointTieneCoords } from '@/components/route-config/routeTypes'
import { useAuth } from '@/context/AuthContext'
import { MeshApiError, resolveBackendUserId } from '@/lib/apiClient'
import { formatDurationHm, formatKm } from '@/lib/format'
import { meshAlert } from '@/lib/meshAlert'
import {
  importarRutaCompartida,
  previewRutaCompartida,
  type RutaSnapshotPreviewApi,
} from '@/lib/rutasCompartidasApi'
import { linestringToLatLng } from '@/lib/routePayload'

function snapshotToMap(preview: RutaSnapshotPreviewApi): {
  waypoints: RouteWaypoint[]
  routeLine: [number, number][]
} {
  const waypoints: RouteWaypoint[] = [
    {
      id: 'origen',
      type: 'ORIGIN',
      lat: preview.origen.lat,
      lon: preview.origen.lng,
      name: preview.origen.nombre ?? '',
      order: 0,
    },
    ...preview.paradas.map((p, i) => ({
      id: `parada-${i}`,
      type: 'STOP' as const,
      lat: p.lat,
      lon: p.lng,
      name: p.nombre ?? '',
      order: i + 1,
    })),
    {
      id: 'destino',
      type: 'DESTINATION',
      lat: preview.destino.lat,
      lon: preview.destino.lng,
      name: preview.destino.nombre ?? '',
      order: preview.paradas.length + 1,
    },
  ]
  return {
    waypoints,
    routeLine: linestringToLatLng(preview.linestring_geojson),
  }
}

export default function RutaCompartidaPreviewScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { backendUserId, backendSyncing } = useAuth()
  const params = useLocalSearchParams<{ token?: string | string[] }>()
  const token = useMemo(() => {
    const t = params.token
    return (Array.isArray(t) ? t[0] : t)?.trim() || ''
  }, [params.token])

  const [preview, setPreview] = useState<RutaSnapshotPreviewApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!token) {
      setErrorMsg('Link de ruta inválido.')
      setLoading(false)
      return
    }
    if (backendSyncing) return

    setLoading(true)
    setErrorMsg(null)
    try {
      const userId = resolveBackendUserId(backendUserId)
      const data = await previewRutaCompartida(token, userId)
      setPreview(data)
    } catch (e) {
      if (e instanceof MeshApiError) {
        if (e.code === 'SHARE_REVOKED') {
          setErrorMsg('Este link de ruta fue revocado.')
        } else if (e.code === 'SHARE_NOT_FOUND') {
          setErrorMsg('No encontramos esta ruta compartida.')
        } else {
          setErrorMsg(e.message)
        }
      } else {
        setErrorMsg(e instanceof Error ? e.message : 'No se pudo cargar la ruta.')
      }
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [token, backendUserId, backendSyncing])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const mapa = useMemo(() => (preview ? snapshotToMap(preview) : null), [preview])

  const initialRegion = useMemo(() => {
    const primero = mapa?.waypoints.find(waypointTieneCoords)
    return {
      latitude: primero?.lat ?? -31.42,
      longitude: primero?.lon ?? -64.18,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }
  }, [mapa])

  const fitCoords = useMemo(() => {
    if (!mapa) return null
    if (mapa.routeLine.length > 1) {
      return mapa.routeLine.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
    }
    return mapa.waypoints
      .filter(waypointTieneCoords)
      .map((w) => ({ latitude: w.lat, longitude: w.lon }))
  }, [mapa])

  const onGuardar = async () => {
    if (!token) return
    setGuardando(true)
    try {
      const userId = resolveBackendUserId(backendUserId)
      const out = await importarRutaCompartida(token, userId)
      meshAlert(
        'Listo',
        out.ya_existia
          ? 'Esta ruta ya estaba en tus plantillas.'
          : 'Ruta guardada en Mis rutas.'
      )
      router.replace('/mis-rutas')
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo guardar la ruta.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Ruta compartida', headerShown: true }} />

      {loading || backendSyncing ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : errorMsg ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={theme.danger} />
          <Text style={[styles.errorTxt, { color: theme.text }]}>{errorMsg}</Text>
          <Btn variant="secondary" onPress={() => router.replace('/(tabs)')}>
            Volver al inicio
          </Btn>
        </View>
      ) : preview && mapa ? (
        <>
          <View style={styles.mapBox}>
            <RouteMapView
              waypoints={mapa.waypoints}
              routeLineLatLng={mapa.routeLine.length > 1 ? mapa.routeLine : null}
              mapStyle="standard"
              initialRegion={initialRegion}
              cameraTarget={null}
              fitRouteCoords={fitCoords}
              mapPickMode={false}
              calculando={false}
              showsUserLocation={false}
              fitBottomPadding={80}
            />
          </View>
          <ScrollView contentContainerStyle={styles.info}>
            <Text style={[styles.title, { color: theme.text }]}>
              {preview.origen.nombre || 'Origen'} → {preview.destino.nombre || 'Destino'}
            </Text>
            <Text style={[styles.meta, { color: theme.textDim }]}>
              {preview.tipo_actividad}
              {preview.distancia_planeada_m != null
                ? ` · ${formatKm(preview.distancia_planeada_m)}`
                : ''}
              {preview.tiempo_estimado_seg != null
                ? ` · ${formatDurationHm(preview.tiempo_estimado_seg)}`
                : ''}
            </Text>
            {preview.paradas.length > 0 ? (
              <Text style={[styles.meta, { color: theme.textMute }]}>
                {preview.paradas.length} parada{preview.paradas.length === 1 ? '' : 's'}
              </Text>
            ) : null}
            <Btn
              variant="primary"
              block
              icon="download"
              loading={guardando}
              disabled={guardando}
              onPress={() => void onGuardar()}
              style={{ marginTop: 16 }}
            >
              Guardar en mis rutas
            </Btn>
          </ScrollView>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorTxt: { fontSize: 16, textAlign: 'center', fontWeight: '600' },
  mapBox: { height: 280, margin: 16, borderRadius: 12, overflow: 'hidden' },
  info: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '700' },
  meta: { marginTop: 6, fontSize: 14, fontWeight: '600' },
})
