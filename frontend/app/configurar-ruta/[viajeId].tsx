import * as Crypto from 'expo-crypto'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist'

import { RouteMapWebView, type RouteMapWaypoint } from '@/components/route-config/RouteMapWebView'
import { API_BASE_URL, DEV_USER_ID } from '@/constants/Config'
import { buscarLugares, type NominatimHit } from '@/lib/nominatim'
import { calcularRutaOsrm, type MobilityProfile, type OsrmRouteResult } from '@/lib/osrm'
import { guardarRutaEnBackend } from '@/lib/viajesApi'
import type { PutRutaBody } from '@/lib/viajesTypes'

type Punto = {
  id: string
  lat: number
  lng: number
  label: string
}

const MOVILIDAD: { key: MobilityProfile; label: string }[] = [
  { key: 'walking', label: 'A pie' },
  { key: 'cycling', label: 'Bicicleta' },
  { key: 'driving', label: 'Vehículo' },
]

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

function formatDuration(sec: number): string {
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const r = min % 60
  return `${h} h ${r} min`
}

function promptAsignar(
  label: string,
  paradasCount: number,
  onElegir: (rol: 'origen' | 'parada' | 'destino') => void
): void {
  const limitParada = (): boolean => {
    if (paradasCount >= 10) {
      Alert.alert('Límite', 'Máximo 10 paradas intermedias.')
      return true
    }
    return false
  }

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancelar', 'Origen', 'Parada intermedia', 'Destino'],
        cancelButtonIndex: 0,
        title: 'Usar ubicación',
        message: label.slice(0, 120),
      },
      (idx) => {
        if (idx === 1) onElegir('origen')
        if (idx === 2) {
          if (limitParada()) return
          onElegir('parada')
        }
        if (idx === 3) onElegir('destino')
      }
    )
    return
  }

  Alert.alert('Usar ubicación', label.slice(0, 160), [
    { text: 'Origen', onPress: () => onElegir('origen') },
    {
      text: 'Parada intermedia',
      onPress: () => {
        if (limitParada()) return
        onElegir('parada')
      },
    },
    { text: 'Destino', onPress: () => onElegir('destino') },
    { text: 'Cancelar', style: 'cancel' },
  ])
}

export default function ConfigurarRutaScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ viajeId: string | string[]; userId?: string | string[] }>()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userFromQuery = useMemo(() => {
    const u = params.userId
    const raw = Array.isArray(u) ? u[0] : u
    return raw?.trim() || DEV_USER_ID
  }, [params.userId])

  const [userIdField, setUserIdField] = useState(userFromQuery)

  const [busqueda, setBusqueda] = useState('')
  const [busquedaDeb, setBusquedaDeb] = useState('')
  const [hits, setHits] = useState<NominatimHit[]>([])
  const [buscando, setBuscando] = useState(false)

  const [origen, setOrigen] = useState<Punto | null>(null)
  const [destino, setDestino] = useState<Punto | null>(null)
  const [paradas, setParadas] = useState<Punto[]>([])

  const [movilidad, setMovilidad] = useState<MobilityProfile>('walking')

  const [rutaOk, setRutaOk] = useState<OsrmRouteResult | null>(null)
  const [routeLineLatLng, setRouteLineLatLng] = useState<[number, number][] | null>(null)
  const [errorRuta, setErrorRuta] = useState<string | null>(null)
  const [calculando, setCalculando] = useState(false)

  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDeb(busqueda.trim()), 480)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    let cancel = false
    async function run() {
      if (busquedaDeb.length < 3) {
        setHits([])
        return
      }
      setBuscando(true)
      try {
        const r = await buscarLugares(busquedaDeb)
        if (!cancel) setHits(r)
      } catch {
        if (!cancel) setHits([])
      } finally {
        if (!cancel) setBuscando(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [busquedaDeb])

  useEffect(() => {
    let cancel = false
    async function run() {
      if (!origen || !destino) {
        setRutaOk(null)
        setRouteLineLatLng(null)
        setErrorRuta(null)
        setCalculando(false)
        return
      }

      setCalculando(true)
      setErrorRuta(null)

      const pts: [number, number][] = [
        [origen.lng, origen.lat],
        ...paradas.map((p) => [p.lng, p.lat] as [number, number]),
        [destino.lng, destino.lat],
      ]

      try {
        const res = await calcularRutaOsrm(movilidad, pts)
        if (cancel) return
        setRutaOk(res)
        setRouteLineLatLng(res.linestring.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]))
      } catch {
        if (cancel) return
        setRutaOk(null)
        setRouteLineLatLng(null)
        setErrorRuta('No se pudo calcular la ruta. Verifica la ubicación de los puntos.')
      } finally {
        if (!cancel) setCalculando(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [origen, destino, paradas, movilidad])

  const waypointsMap: RouteMapWaypoint[] = useMemo(() => {
    const w: RouteMapWaypoint[] = []
    if (origen) w.push({ ...origen, label: `Origen · ${origen.label}` })
    paradas.forEach((p, i) => w.push({ ...p, label: `Parada ${i + 1} · ${p.label}` }))
    if (destino) w.push({ ...destino, label: `Destino · ${destino.label}` })
    return w
  }, [origen, destino, paradas])

  const aplicarUbicacion = useCallback(
    (rol: 'origen' | 'parada' | 'destino', lat: number, lng: number, label: string) => {
      const punto: Punto = {
        id: Crypto.randomUUID(),
        lat,
        lng,
        label: label.slice(0, 200),
      }
      if (rol === 'origen') setOrigen(punto)
      if (rol === 'destino') setDestino(punto)
      if (rol === 'parada') setParadas((prev) => [...prev, punto])
    },
    []
  )

  const onLongPressMap = useCallback(
    (lat: number, lng: number) => {
      const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      promptAsignar(label, paradas.length, (rol) => aplicarUbicacion(rol, lat, lng, label))
    },
    [aplicarUbicacion, paradas.length]
  )

  const onElegirHit = useCallback(
    (item: NominatimHit) => {
      const lat = Number(item.lat)
      const lng = Number(item.lon)
      if (Number.isNaN(lat) || Number.isNaN(lng)) return
      const label = item.display_name
      promptAsignar(label, paradas.length, (rol) => aplicarUbicacion(rol, lat, lng, label))
      setBusqueda('')
      setHits([])
    },
    [aplicarUbicacion, paradas.length]
  )

  const eliminarParada = useCallback((id: string) => {
    setParadas((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const confirmarHabilitado =
    Boolean(viajeId) &&
    Boolean(userIdField?.trim()) &&
    Boolean(origen && destino) &&
    Boolean(rutaOk) &&
    !calculando &&
    !guardando

  const confirmar = useCallback(async () => {
    if (!viajeId || !userIdField.trim() || !origen || !destino || !rutaOk) return
    setGuardando(true)
    try {
      const body: PutRutaBody = {
        origen: { type: 'Point', coordinates: [origen.lng, origen.lat] },
        destino: { type: 'Point', coordinates: [destino.lng, destino.lat] },
        linestring: rutaOk.linestring,
        tiempoEstimadoSeg: Math.round(rutaOk.durationSec),
        paradas: paradas.map((p, i) => ({
          orden: i,
          lat: p.lat,
          lng: p.lng,
          categoria: 'otro',
        })),
      }
      await guardarRutaEnBackend(viajeId, userIdField.trim(), body)
      Alert.alert('Listo', 'La ruta se guardó correctamente.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar'
      Alert.alert('Error', msg)
    } finally {
      setGuardando(false)
    }
  }, [viajeId, userIdField, origen, destino, rutaOk, paradas, router])

  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.mapBox}>
          <RouteMapWebView
            waypoints={waypointsMap}
            routeLineLatLng={routeLineLatLng}
            onLongPressMap={onLongPressMap}
          />
        </View>

        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <Text style={styles.hint}>Mantén pulsado el mapa para fijar un punto (o buscá una dirección).</Text>

          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar dirección (Nominatim / OSM)"
            placeholderTextColor="#6b7280"
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {buscando ? <Text style={styles.muted}>Buscando…</Text> : null}

          {hits.length > 0 ? (
            <FlatList
              data={hits}
              keyExtractor={(item, i) => `${item.lat},${item.lon}-${i}`}
              style={styles.hitList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.hitRow} onPress={() => onElegirHit(item)}>
                  <Text style={styles.hitText} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </Pressable>
              )}
            />
          ) : null}

          <Text style={styles.section}>Modo de movilidad (ruteo OSRM)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {MOVILIDAD.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setMovilidad(m.key)}
                style={[styles.chip, movilidad === m.key && styles.chipOn]}
              >
                <Text style={[styles.chipTxt, movilidad === m.key && styles.chipTxtOn]}>{m.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.rowFixed}>
            <Text style={styles.k}>Origen</Text>
            <Text style={styles.v} numberOfLines={2}>
              {origen ? origen.label : '—'}
            </Text>
          </View>

          <Text style={styles.section}>Paradas intermedias (arrastrá para reordenar · máx. 10)</Text>
          <View style={styles.dragBox}>
            <DraggableFlatList
              data={paradas}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => setParadas(data)}
              containerStyle={styles.dragList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, drag, isActive }) => (
                <ScaleDecorator>
                  <Pressable
                    onLongPress={drag}
                    disabled={isActive}
                    style={[styles.paradaRow, isActive && styles.paradaRowActive]}
                  >
                    <Text style={styles.paradaGrip}>≡</Text>
                    <Text style={styles.paradaTxt} numberOfLines={2}>
                      {item.label}
                    </Text>
                    <Pressable
                      onPress={() => eliminarParada(item.id)}
                      hitSlop={12}
                      style={styles.paradaDel}
                    >
                      <Text style={styles.paradaDelTxt}>Quitar</Text>
                    </Pressable>
                  </Pressable>
                </ScaleDecorator>
              )}
            />
          </View>

          <View style={styles.rowFixed}>
            <Text style={styles.k}>Destino</Text>
            <Text style={styles.v} numberOfLines={2}>
              {destino ? destino.label : '—'}
            </Text>
          </View>

          <View style={styles.resumen}>
            {calculando ? (
              <Text style={styles.muted}>Calculando ruta…</Text>
            ) : errorRuta ? (
              <Text style={styles.errorText}>{errorRuta}</Text>
            ) : rutaOk ? (
              <>
                <Text style={styles.resumenStrong}>Distancia estimada: {formatDistance(rutaOk.distanceM)}</Text>
                <Text style={styles.resumenTxt}>Tiempo estimado: {formatDuration(rutaOk.durationSec)}</Text>
              </>
            ) : (
              <Text style={styles.muted}>Definí origen y destino para ver el resumen.</Text>
            )}
          </View>

          <Text style={styles.section}>API backend</Text>
          <Text style={styles.muted}>Base: {API_BASE_URL}</Text>
          <TextInput
            value={userIdField}
            onChangeText={setUserIdField}
            placeholder="x-user-id (UUID del usuario en la DB)"
            placeholderTextColor="#6b7280"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            style={[styles.btn, !confirmarHabilitado && styles.btnOff]}
            disabled={!confirmarHabilitado}
            onPress={() => void confirmar()}
          >
            {guardando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTxt}>Guardar / confirmar ruta</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  mapBox: { flex: 2, minHeight: 200 },
  panel: { flex: 3 },
  panelContent: { paddingHorizontal: 14, paddingBottom: 24, paddingTop: 8, gap: 8, flexGrow: 1 },
  hint: { fontSize: 13, color: '#374151', lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#111827',
  },
  muted: { fontSize: 13, color: '#6b7280' },
  hitList: { maxHeight: 140, marginTop: 4 },
  hitRow: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  hitText: { fontSize: 14, color: '#111827' },
  section: { marginTop: 6, fontSize: 14, fontWeight: '600', color: '#111827' },
  chipsRow: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
    marginVertical: 4,
  },
  chipOn: { backgroundColor: '#111827' },
  chipTxt: { fontSize: 15, fontWeight: '600', color: '#111827' },
  chipTxtOn: { color: '#f9fafb' },
  rowFixed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  k: { width: 72, fontSize: 14, fontWeight: '700', color: '#374151' },
  v: { flex: 1, fontSize: 14, color: '#111827' },
  dragBox: { height: 200, marginTop: 4 },
  dragList: { flex: 1 },
  paradaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paradaRowActive: { opacity: 0.9, borderColor: '#2563eb' },
  paradaGrip: { fontSize: 18, color: '#9ca3af', width: 28, textAlign: 'center' },
  paradaTxt: { flex: 1, fontSize: 15, color: '#111827' },
  paradaDel: { paddingVertical: 6, paddingHorizontal: 8 },
  paradaDelTxt: { fontSize: 14, fontWeight: '600', color: '#b91c1c' },
  resumen: { marginTop: 8, padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  resumenStrong: { fontSize: 17, fontWeight: '700', color: '#111827' },
  resumenTxt: { marginTop: 4, fontSize: 15, color: '#374151' },
  errorText: { fontSize: 15, color: '#b91c1c', fontWeight: '600' },
  btn: {
    marginTop: 12,
    backgroundColor: '#15803d',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnOff: { backgroundColor: '#9ca3af' },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
