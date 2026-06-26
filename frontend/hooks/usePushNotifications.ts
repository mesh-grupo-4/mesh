import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { registrarPushToken } from '@/lib/usuariosApi'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function usePushNotifications(backendUserId: string | null) {
  const router = useRouter()

  // Registrar token cuando el usuario tiene sesión
  useEffect(() => {
    if (!backendUserId) return
    void registerForPushNotificationsAsync()
  }, [backendUserId])

  // Manejar tap en la notificación (app en background/cerrada)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { viajeId?: string }
      if (data?.viajeId) {
        router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId: data.viajeId } })
      }
    })
    return () => sub.remove()
  }, [router])
}

async function registerForPushNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'web') return

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
