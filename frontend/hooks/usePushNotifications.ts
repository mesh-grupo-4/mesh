import Constants from 'expo-constants'
import { isRunningInExpoGo } from 'expo'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { refrescarPendientes } from '@/lib/pendientesStore'
import { registrarPushToken } from '@/lib/usuariosApi'

/** Push remoto no está disponible en Expo Go (SDK 53+). Requiere development build. */
const pushDisponible = Platform.OS !== 'web' && !isRunningInExpoGo()

let handlerListo = false

type PushData = { viajeId?: string; tipo?: 'invitacion_grupo' | 'solicitud_amistad' } | undefined

async function ensureNotifications() {
  if (!pushDisponible) return null
  const Notifications = await import('expo-notifications')
  if (!handlerListo) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })
    handlerListo = true
  }
  return Notifications
}

export function usePushNotifications(backendUserId: string | null) {
  const router = useRouter()

  useEffect(() => {
    if (!backendUserId || !pushDisponible) return
    void registerForPushNotificationsAsync()
  }, [backendUserId])

  useEffect(() => {
    if (!pushDisponible) return

    let cancelado = false
    let sub: { remove: () => void } | undefined
    let subRecibida: { remove: () => void } | undefined

    void (async () => {
      const Notifications = await ensureNotifications()
      if (!Notifications || cancelado) return
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as PushData
        if (data?.viajeId) {
          router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId: data.viajeId } })
        } else if (data?.tipo === 'invitacion_grupo' || data?.tipo === 'solicitud_amistad') {
          router.navigate({
            pathname: '/(tabs)/grupos',
            params: { tab: data.tipo === 'solicitud_amistad' ? 'amigos' : 'grupos' },
          })
        }
      })
      // Con la app abierta: actualizar el badge de la pestaña Grupos al instante.
      subRecibida = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as PushData
        if (backendUserId && (data?.tipo === 'invitacion_grupo' || data?.tipo === 'solicitud_amistad')) {
          void refrescarPendientes(backendUserId)
        }
      })
    })()

    return () => {
      cancelado = true
      sub?.remove()
      subRecibida?.remove()
    }
  }, [router, backendUserId])
}

async function registerForPushNotificationsAsync(): Promise<void> {
  const Notifications = await ensureNotifications()
  if (!Notifications) return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('viajes', {
      name: 'Viajes',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    })
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (existing !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync()
    status = requested
  }
  if (status !== 'granted') return

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) {
    console.warn('[Push] projectId no configurado en app.json/eas.json')
    return
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  await registrarPushToken(token)
}
