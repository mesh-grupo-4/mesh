import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { API_BASE_URL, DEV_USER_ID } from '@/constants/Config'
import { connectMeshSocket } from '@/lib/meshSocket'
import { iniciarTrackingViaje, solicitarPermisosUbicacion } from '@/lib/tracking/trackingControl'
import { iniciarViajeEnBackend, obtenerViaje, type ViajeDetalleApi } from '@/lib/viajesApi'

export default function ViajeDetalleScreen() {
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
  const [viaje, setViaje] = useState<ViajeDetalleApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [accion, setAccion] = useState(false)
  const [modalPermisos, setModalPermisos] = useState(false)
  const [ubicacionBloqueada, setUbicacionBloqueada] = useState(false)

  const esLider = viaje != null && userId.trim() === viaje.creador_id

  const cargar = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    setLoading(true)
    try {
      const v = await obtenerViaje(viajeId, userId.trim())
      setViaje(v)
    } catch (e) {
      setViaje(null)
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo cargar el viaje')
    } finally {
      setLoading(false)
    }
  }, [viajeId, userId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (userId.trim()) {
      void AsyncStorage.setItem('mesh:activeUserId', userId.trim())
    }
  }, [userId])

  const abrirAjustes = () => {
    void Linking.openSettings()
  }

  const confirmarIniciar = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Solo móvil', 'El tracking GPS está disponible en Android / iOS.')
      return
    }
    setModalPermisos(true)
  }

  const ejecutarIniciar = async () => {
    if (!viajeId || !userId.trim()) return
    setModalPermisos(false)
    setAccion(true)
    try {
      const perm = await solicitarPermisosUbicacion()
      setUbicacionBloqueada(!perm.foreground)

      await iniciarViajeEnBackend(viajeId, userId.trim())
      await cargar()

      const sock = connectMeshSocket(userId.trim())
      sock.emit('join_viaje', { viajeId })

      if (perm.foreground) {
        await iniciarTrackingViaje(viajeId, userId.trim())
      }

      router.push(`/viaje/${viajeId}/live` as never)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo iniciar')
    } finally {
      setAccion(false)
    }
  }

  const irLive = () => {
    if (!viajeId) return
    router.push(`/viaje/${viajeId}/live` as never)
  }

  if (!viajeId) {
    return (
      <View style={styles.center}>
        <Text>Falta el identificador del viaje.</Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Detalle del viaje</Text>
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

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : viaje ? (
        <>
          <View style={styles.card}>
            <Text style={styles.row}>
              <Text style={styles.k}>Estado: </Text>
              <Text style={styles.v}>{viaje.estado}</Text>
            </Text>
            <Text style={styles.row}>
              <Text style={styles.k}>Tipo: </Text>
              <Text style={styles.v}>{viaje.tipo_actividad}</Text>
            </Text>
            <Text style={styles.row}>
              <Text style={styles.k}>Líder: </Text>
              <Text style={styles.v}>{viaje.creador.nombre}</Text>
            </Text>
            <Text style={styles.row}>
              <Text style={styles.k}>Salida programada: </Text>
              <Text style={styles.v}>{new Date(viaje.fecha_programada).toLocaleString()}</Text>
            </Text>
          </View>

          {ubicacionBloqueada ? (
            <Text style={styles.warn}>
              Ubicación desconocida: no se compartirá tu posición hasta otorgar permisos. El resto del grupo puede
              continuar.
            </Text>
          ) : null}

          {viaje.estado === 'planificado' && esLider ? (
            <Pressable style={styles.btnPrimary} onPress={confirmarIniciar} disabled={accion}>
              {accion ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryTxt}>Iniciar viaje</Text>
              )}
            </Pressable>
          ) : null}

          {viaje.estado === 'planificado' && !esLider ? (
            <Text style={styles.muted}>Solo el creador del viaje puede iniciarlo.</Text>
          ) : null}

          {viaje.estado === 'en_curso' ? (
            <Pressable style={styles.btnSecondary} onPress={irLive}>
              <Text style={styles.btnSecondaryTxt}>Abrir mapa en vivo</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      <Modal visible={modalPermisos} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ubicación necesaria</Text>
            <Text style={styles.modalBody}>
              Para iniciar el viaje, Mesh necesita ubicación precisa y, en Android, permiso en segundo plano para el
              servicio en primer plano (notificación fija) y envíos cada 5 segundos.
            </Text>
            <Pressable style={styles.btnPrimary} onPress={() => void ejecutarIniciar()} disabled={accion}>
              <Text style={styles.btnPrimaryTxt}>Solicitar permisos e iniciar</Text>
            </Pressable>
            <Pressable style={styles.btnLink} onPress={abrirAjustes}>
              <Text style={styles.btnLinkTxt}>Abrir ajustes del sistema</Text>
            </Pressable>
            <Pressable style={styles.btnLink} onPress={() => setModalPermisos(false)}>
              <Text style={styles.btnLinkTxt}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  h1: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  mono: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  label: { fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    fontSize: 16,
  },
  card: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  k: { fontWeight: '700', color: '#374151' },
  v: { flex: 1, color: '#111827' },
  warn: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: 10,
    fontSize: 14,
  },
  muted: { marginTop: 12, color: '#6b7280' },
  btnPrimary: {
    marginTop: 20,
    backgroundColor: '#15803d',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnSecondary: {
    marginTop: 12,
    backgroundColor: '#1d4ed8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondaryTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalBody: { fontSize: 15, color: '#374151', lineHeight: 22 },
  btnLink: { paddingVertical: 10, alignItems: 'center' },
  btnLinkTxt: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
})
