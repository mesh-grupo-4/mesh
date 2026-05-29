import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { AppState, DeviceEventEmitter, Platform } from 'react-native'

import { connectMeshSocket, getMeshSocket } from '@/lib/meshSocket'
import { flushGpsQueue } from '@/lib/tracking/gpsQueue'

const isExpoGo = Constants.appOwnership === 'expo'

async function initNotifications() {
  if (Platform.OS === 'web' || isExpoGo) return
  try {
    const Notifications = await import('expo-notifications')
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })
    await Notifications.requestPermissionsAsync()
  } catch {
    /* Expo Go / entorno sin push remota */
  }
}

async function notifyLocal(title: string, body: string) {
  if (Platform.OS === 'web' || isExpoGo) return
  try {
    const Notifications = await import('expo-notifications')
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    })
  } catch {
    /* ignorar */
  }
}

/**
 * Puente global: cola GPS, envío por socket en primer plano, y navegación al iniciar viaje.
 * Push remota (FCM) cuando la app está matada queda fuera del MVP.
 */
export function ViajeRealtimeBridge() {
  const router = useRouter()

  useEffect(() => {
    void initNotifications()
  }, [])

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'mesh:location_tick',
      (p: {
        viajeId: string
        userId: string
        lat: number
        lng: number
        accuracy?: number
        recordedAt: string
      }) => {
        const sock = getMeshSocket()
        if (!sock?.connected) return
        sock.emit('viaje:gps_ping', {
          viajeId: p.viajeId,
          lat: p.lat,
          lng: p.lng,
          accuracy: p.accuracy,
          recordedAt: p.recordedAt,
          source: 'live',
        })
      }
    )
    return () => sub.remove()
  }, [])

  useEffect(() => {
    const flush = () => void flushGpsQueue()
    const interval = setInterval(flush, 15000)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') flush()
    })
    flush()
    return () => {
      clearInterval(interval)
      sub.remove()
    }
  }, [])

  useEffect(() => {
    let off: (() => void) | undefined

    void (async () => {
      const uid = await AsyncStorage.getItem('mesh:activeUserId')
      if (!uid) return
      const sock = connectMeshSocket(uid)
      const onInicio = async (payload: { viajeId: string }) => {
        await notifyLocal(
          'Viaje iniciado',
          'El líder ha iniciado el viaje. Tu ubicación puede compartirse en el mapa en vivo.'
        )
        router.push(`/viaje/${payload.viajeId}/live` as never)
      }
      sock.on('viaje:iniciado', onInicio)
      off = () => {
        sock.off('viaje:iniciado', onInicio)
      }
    })()

    return () => {
      off?.()
    }
  }, [router])

  return null
}
