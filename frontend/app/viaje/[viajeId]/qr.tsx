import { useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
  Alert,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import ViewShot from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'

import { buildInviteUrl } from '@/lib/inviteLinks'

export default function ViajeQrScreen() {
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>()
  const shotRef = useRef<ViewShot>(null)

  if (!viajeId) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Viaje no especificado.</Text>
      </View>
    )
  }

  const inviteUrl = buildInviteUrl(viajeId)

  const compartirLink = async () => {
    try {
      await Share.share({
        message: `Unite al viaje en Mesh:\n${inviteUrl}`,
        url: Platform.OS === 'ios' ? inviteUrl : undefined,
        title: 'Invitación Mesh',
      })
    } catch {
      Alert.alert('Error', 'No se pudo abrir el menú de compartir.')
    }
  }

  const compartirImagen = async () => {
    try {
      const uri = await shotRef.current?.capture?.()
      if (!uri) {
        await compartirLink()
        return
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir código QR',
        })
      } else {
        await compartirLink()
      }
    } catch {
      await compartirLink()
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Invitar por QR' }} />
      <View style={styles.container}>
        <Text style={styles.titulo}>Escaneá para unirte al viaje</Text>
        <Text style={styles.subtitulo}>
          El QR une directamente al viaje (RN-016). Expira cuando el viaje comience (RN-015).
        </Text>

        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={styles.qrWrap}>
          <View style={styles.qrInner}>
            <QRCode value={inviteUrl} size={220} backgroundColor="#fff" color="#0f0f0f" />
          </View>
        </ViewShot>

        <Text style={styles.link} selectable>
          {inviteUrl}
        </Text>

        <TouchableOpacity style={styles.botonPrimario} onPress={() => void compartirLink()}>
          <Text style={styles.botonTexto}>Compartir enlace</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonSecundario} onPress={() => void compartirImagen()}>
          <Text style={styles.botonSecundarioTexto}>Compartir imagen del QR</Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  titulo: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitulo: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  qrWrap: { marginVertical: 8 },
  qrInner: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  link: {
    color: '#4a9eff',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  botonPrimario: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botonSecundario: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  botonSecundarioTexto: { color: '#ccc', fontSize: 15 },
  error: { color: '#ff6b6b', fontSize: 15 },
})
