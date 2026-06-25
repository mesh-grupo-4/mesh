import { useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Share,
  Platform, 
  ScrollView,
} from 'react-native'
import { meshAlert } from '@/lib/meshAlert';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import ViewShot from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { Feather } from '@expo/vector-icons'

import { buildInviteUrl } from '@/lib/inviteLinks'
import { TopBar, Btn, Badge, useTheme } from '@/components/MeshUI'

export default function ViajeQrScreen() {
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>()
  const router = useRouter()
  const theme = useTheme()
  const shotRef = useRef<ViewShot>(null)

  if (!viajeId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.danger }}>Viaje no especificado.</Text>
      </View>
    )
  }

  const inviteUrl = buildInviteUrl(viajeId)

  // Generate a code representation, e.g. MESH-VIAJE-XXXX where XXXX is last 4 characters of viajeId uppercase
  const shortCode = `MESH·VIAJE·${viajeId.substring(viajeId.length - 4).toUpperCase()}`

  const compartirLink = async () => {
    try {
      await Share.share({
        message: `Unite al viaje en Mesh:\n${inviteUrl}`,
        url: Platform.OS === 'ios' ? inviteUrl : undefined,
        title: 'Invitación Mesh',
      })
    } catch {
      meshAlert('Error', 'No se pudo abrir el menú de compartir.')
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Invitar al viaje" onBack={() => router.back()} bordered={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success Icon */}
        <View style={[styles.iconContainer, { backgroundColor: theme.accentWeak }]}>
          <Feather name="check" size={30} color={theme.accent} />
        </View>

        <Text style={[styles.titulo, { color: theme.text }]}>¡Viaje listo!</Text>
        <Text style={[styles.subtitulo, { color: theme.textDim }]}>
          Que escaneen este QR con la cámara o desde la app de Mesh para sumarse a la salida.
        </Text>

        {/* QR Box */}
        <View style={styles.qrWrapperOuter}>
          <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={[styles.qrWrap, { shadowColor: theme.shadow }]}>
            <View style={[styles.qrInner, { backgroundColor: '#ffffff' }]}>
              <QRCode value={inviteUrl} size={190} backgroundColor="#ffffff" color="#0f0f0f" />
            </View>
          </ViewShot>
        </View>

        {/* Short Code Badge */}
        <View style={styles.badgeWrapper}>
          <Badge tone="mute">{shortCode}</Badge>
        </View>

        <Text style={[styles.link, { color: theme.accent }]} selectable>
          {inviteUrl}
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          <Btn variant="primary" block icon="share-2" onPress={() => void compartirLink()}>
            Compartir enlace
          </Btn>
          <Btn variant="secondary" block icon="image" onPress={() => void compartirImagen()}>
            Compartir imagen QR
          </Btn>
          <Btn variant="ghost" block onPress={() => router.back()}>
            Volver al viaje
          </Btn>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 48,
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  titulo: { 
    fontSize: 22, 
    fontWeight: '800', 
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitulo: { 
    fontSize: 14, 
    textAlign: 'center', 
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 280,
  },
  qrWrapperOuter: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrap: {
    borderRadius: 16,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  qrInner: {
    padding: 16,
    borderRadius: 16,
  },
  badgeWrapper: {
    marginTop: 18,
  },
  link: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 14,
    fontFamily: 'SpaceMono',
    paddingHorizontal: 12,
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 24,
  },
})
