import { CANAL_POR_GRAVEDAD, type GravedadAviso } from './gravedadAlerta'

type ExpoPushMessage = {
  to: string
  title: string
  body?: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  /**
   * Avisos del viaje: elige el canal de Android (vibración e importancia) y la
   * prioridad de entrega. Sin gravedad la push sale por el canal por defecto.
   */
  gravedad?: GravedadAviso
}

/** Traduce `gravedad` a los campos que entiende Expo Push Service. */
function aMensajeExpo({ gravedad, ...mensaje }: ExpoPushMessage) {
  if (!gravedad) return mensaje
  return {
    ...mensaje,
    channelId: CANAL_POR_GRAVEDAD[gravedad],
    // `high` despierta al dispositivo en Doze; un aviso informativo puede esperar.
    priority: gravedad === 'informativa' ? ('normal' as const) : ('high' as const),
    data: { ...mensaje.data, gravedad },
  }
}

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  const valid = messages.filter((m) => m.to.startsWith('ExponentPushToken'))
  if (valid.length === 0) return

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(valid.map(aMensajeExpo)),
    })
    if (!res.ok) {
      console.warn('[ExpoPush] Error HTTP:', res.status, await res.text())
    }
  } catch (e) {
    console.warn('[ExpoPush] Fetch falló:', e)
  }
}
