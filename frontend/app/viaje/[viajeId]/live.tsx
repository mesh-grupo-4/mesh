import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { API_BASE_URL, DEV_USER_ID } from '@/constants/Config'
import { connectMeshSocket, getMeshSocket } from '@/lib/meshSocket'
import {
  detenerTrackingViaje,
  iniciarTrackingViaje,
  solicitarPermisosUbicacion,
} from '@/lib/tracking/trackingControl'

type UbicacionPeer = {
  usuarioId: string
  lat: number
  lng: number
  precision: number | null
  recordedAt: string
}

export default function ViajeLiveScreen() {
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

  const [userId, setUserId] = useState(userFromQuery)
  const [peers, setPeers] = useState<Record<string, UbicacionPeer>>({})
  const [fg, setFg] = useState<boolean | null>(null)

  useEffect(() => {
    if (userId.trim()) void AsyncStorage.setItem('mesh:activeUserId', userId.trim())
  }, [userId])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return

    let cleanup: (() => void) | undefined

    void (async () => {
      const sock = await connectMeshSocket()
      sock.emit('join_viaje', { viajeId })

      const onUbi = (payload: {
        viajeId: string
        usuarioId: string
        lat: number
        lng: number
        precision: number | null
        recordedAt: string
      }) => {
        if (payload.viajeId !== viajeId) return
        setPeers((prev) => ({
          ...prev,
          [payload.usuarioId]: {
            usuarioId: payload.usuarioId,
            lat: payload.lat,
            lng: payload.lng,
            precision: payload.precision,
            recordedAt: payload.recordedAt,
          },
        }))
      }

      const onFin = (payload: { viajeId: string }) => {
        if (payload.viajeId !== viajeId) return
        void detenerTrackingViaje()
        Alert.alert('Viaje finalizado', 'Se detuvo el seguimiento GPS.', [
          { text: 'OK', onPress: () => router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId } }) },
        ])
      }

      sock.on('viaje:ubicacion', onUbi)
      sock.on('viaje:finalizado', onFin)

      cleanup = () => {
        sock.off('viaje:ubicacion', onUbi)
        sock.off('viaje:finalizado', onFin)
      }
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
    })()
    return () => {
      cancelled = true
    }
  }, [viajeId, userId])

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((r) => setFg(r.status === 'granted'))
  }, [])

  useEffect(() => {
    const sock = getMeshSocket()
    if (!sock || !viajeId) return
    const onInicio = () => {
      void (async () => {
        if (Platform.OS === 'web' || !userId.trim()) return
        const p = await Location.getForegroundPermissionsAsync()
        if (p.status === 'granted') {
          await iniciarTrackingViaje(viajeId, userId.trim())
        }
      })()
    }
    sock.on('viaje:iniciado', onInicio)
    return () => {
      sock.off('viaje:iniciado', onInicio)
    }
  }, [viajeId, userId])

  const lista = Object.values(peers)

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Mapa en vivo</Text>
      <Text style={styles.mono}>Viaje: {viajeId}</Text>
      <Text style={styles.mono}>API: {API_BASE_URL}</Text>

      <Text style={styles.label}>Usuario (x-user-id)</Text>
      <TextInput
        value={userId}
        onChangeText={setUserId}
        style={styles.input}
        autoCapitalize="none"
        placeholder="UUID"
        placeholderTextColor="#888"
      />

      {fg === false ? (
        <Text style={styles.warn}>
          Ubicación desconocida: tu posición no se compartirá en el mapa del grupo hasta que otorgues permisos. El
          resto del equipo no se bloquea.
        </Text>
      ) : null}

      <Text style={styles.sub}>Últimas posiciones recibidas (tiempo real)</Text>
      {lista.length === 0 ? (
        <Text style={styles.muted}>Aún no hay ubicaciones por WebSocket.</Text>
      ) : (
        lista.map((p) => (
          <View key={p.usuarioId} style={styles.card}>
            <Text style={styles.peerId}>Usuario: {p.usuarioId.slice(0, 8)}…</Text>
            <Text style={styles.peerTxt}>
              {p.lat.toFixed(5)}, {p.lng.toFixed(5)} · precisión: {p.precision ?? '—'} m
            </Text>
            <Text style={styles.peerTs}>{p.recordedAt}</Text>
          </View>
        ))
      )}

      <Text style={styles.muted}>
        El trazado completo en mapa OSM y métricas se pueden integrar en la siguiente iteración; aquí se cumple el
        canal en tiempo real y el tracking cada 5 s en móvil.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '800' },
  mono: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  label: { fontWeight: '600', marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    fontSize: 16,
  },
  warn: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: 10,
    fontSize: 14,
  },
  sub: { marginTop: 20, fontSize: 16, fontWeight: '700' },
  muted: { marginTop: 8, color: '#6b7280', fontSize: 14 },
  card: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  peerId: { fontWeight: '700', color: '#111827' },
  peerTxt: { marginTop: 4, color: '#374151' },
  peerTs: { marginTop: 4, fontSize: 12, color: '#6b7280' },
})
