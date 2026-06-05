import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'

import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { parseViajeIdFromInviteData } from '@/lib/inviteLinks'
import { ejecutarUnionPorQr } from '@/lib/joinViajeQr'

export default function EscanearQrScreen() {
  const { backendUserId } = useAuth()
  const [permission, requestPermission] = useCameraPermissions()
  const [procesando, setProcesando] = useState(false)

  const onBarcode = useCallback(
    async (data: string) => {
      if (procesando) return
      const viajeId = parseViajeIdFromInviteData(data)
      if (!viajeId) return

      setProcesando(true)
      try {
        const userId = resolveBackendUserId(backendUserId)
        await ejecutarUnionPorQr(viajeId, userId)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo procesar el código.'
        Alert.alert('Error', msg)
        setProcesando(false)
      }
    },
    [backendUserId, procesando]
  )

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicatorPlaceholder />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <>
        <Stack.Screen options={{ title: 'Escanear QR' }} />
        <View style={styles.container}>
          <Text style={styles.titulo}>Permiso de cámara</Text>
          <Text style={styles.subtitulo}>
            Necesitamos acceso a la cámara para escanear el código QR de invitación.
          </Text>
          <TouchableOpacity style={styles.botonPrimario} onPress={() => void requestPermission()}>
            <Text style={styles.botonTexto}>Permitir cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonSecundario} onPress={() => void Linking.openSettings()}>
            <Text style={styles.botonSecundarioTexto}>Abrir ajustes</Text>
          </TouchableOpacity>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Escanear QR' }} />
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={procesando ? undefined : ({ data }) => void onBarcode(data)}
        />
        <View style={styles.overlay}>
          <Text style={styles.hint}>
            {procesando ? 'Uniéndote al grupo…' : 'Apuntá al código QR del viaje'}
          </Text>
          <TouchableOpacity style={styles.botonSecundario} onPress={() => router.back()}>
            <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  )
}

function ActivityIndicatorPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.subtitulo}>Cargando cámara…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    gap: 12,
    backgroundColor: 'rgba(15,15,15,0.85)',
  },
  titulo: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitulo: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 22, padding: 24 },
  hint: { color: '#fff', fontSize: 15, textAlign: 'center' },
  botonPrimario: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 24,
    alignItems: 'center',
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botonSecundario: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  botonSecundarioTexto: { color: '#ccc', fontSize: 15 },
})
