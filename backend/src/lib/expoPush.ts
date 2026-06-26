type ExpoPushMessage = {
  to: string
  title: string
  body?: string
  data?: Record<string, unknown>
  sound?: 'default' | null
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
      body: JSON.stringify(valid),
    })
    if (!res.ok) {
      console.warn('[ExpoPush] Error HTTP:', res.status, await res.text())
    }
  } catch (e) {
    console.warn('[ExpoPush] Fetch falló:', e)
  }
}
