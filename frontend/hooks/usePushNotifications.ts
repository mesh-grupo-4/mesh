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

type PushData =
  | { viajeId?: string; tipo?: 'invitacion_grupo' | 'solicitud_amistad'; gravedad?: string }
  | undefined

let viajeEnPantalla: string | null = null

/**
 * La pantalla del viaje en vivo avisa qué viaje está mostrando. Sus avisos
 * (los que traen `gravedad`) ya se ven y vibran ahí: la push no suena ni
 * muestra banner, solo queda en la bandeja.
 */
export function marcarViajeEnPantalla(viajeId: string | null): void {
  viajeEnPantalla = viajeId
}

async function ensureNotifications() {
  if (!pushDisponible) return null
  const Notifications = await import('expo-notifications')
  if (!handlerListo) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data as PushData
        const yaEnPantalla =
          Boolean(data?.gravedad) && data?.viajeId != null && data.viajeId === viajeEnPantalla
        return {
          shouldShowAlert: !yaEnPantalla,
          shouldPlaySound: !yaEnPantalla,
          shouldSetBadge: false,
          shouldShowBanner: !yaEnPantalla,
          shouldShowList: true,
        }
      },
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
    // Un canal por gravedad (ids espejo de `backend/src/lib/gravedadAlerta.ts`).
    // Los patrones copian los de `lib/haptics.ts`: la misma gravedad se siente
    // igual con la app abierta o cerrada.
    await Notifications.setNotificationChannelAsync('alertas-criticas', {
      name: 'Alertas críticas',
      description: 'Peligro, posible incidente y pedidos de ayuda.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 700, 200, 700, 200, 700],
      lightColor: '#dc2626',
    })
    await Notifications.setNotificationChannelAsync('viajes', {
      name: 'Viajes',
      description: 'Paradas, desvíos y atrasos del grupo.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 350, 150, 350],
      lightColor: '#6366f1',
    })
    await Notifications.setNotificationChannelAsync('avisos', {
      name: 'Avisos',
      description: 'Avisos informativos del viaje.',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
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
