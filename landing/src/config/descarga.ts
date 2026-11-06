export type EstadoPlataforma =
  | { estado: 'tienda'; url: string }
  | { estado: 'apk'; url: string } // APK directo para Android
  | { estado: 'proximamente' }

export const DESCARGA: { android: EstadoPlataforma; ios: EstadoPlataforma; listaEspera?: string } = {
  android: import.meta.env.PUBLIC_ANDROID_URL
    ? { estado: 'tienda', url: import.meta.env.PUBLIC_ANDROID_URL }
    : import.meta.env.PUBLIC_APK_URL
      ? { estado: 'apk', url: import.meta.env.PUBLIC_APK_URL }
      : { estado: 'proximamente' },
  ios: import.meta.env.PUBLIC_IOS_URL
    ? { estado: 'tienda', url: import.meta.env.PUBLIC_IOS_URL }
    : { estado: 'proximamente' },
  listaEspera: import.meta.env.PUBLIC_LISTA_ESPERA_URL || undefined,
}

const urlDe = (p: EstadoPlataforma) => (p.estado === 'proximamente' ? undefined : p.url)

export const URL_ANDROID = urlDe(DESCARGA.android)
export const URL_IOS = urlDe(DESCARGA.ios)
export const HAY_DESCARGA = Boolean(URL_ANDROID || URL_IOS)
/** Destino del QR de escritorio y del CTA principal por defecto. */
export const DESTINO_DESCARGA = URL_ANDROID ?? URL_IOS

/** Respuesta de la FAQ "¿En qué teléfonos funciona?", generada desde la configuración. */
export function textoTelefonos(): string {
  const { android, ios } = DESCARGA
  if (android.estado === 'proximamente' && ios.estado === 'proximamente') {
    return 'Todavía no hay una versión publicada para bajar. Próximamente en Android y iPhone.'
  }
  const partes = [
    android.estado === 'tienda' && 'Android, desde Google Play',
    android.estado === 'apk' && 'Android, con descarga directa del APK',
    ios.estado === 'tienda' && 'iPhone, desde la App Store',
  ].filter(Boolean)
  const pendiente = android.estado === 'proximamente' ? ' Próximamente en Android.' : ios.estado === 'proximamente' ? ' Próximamente en iPhone.' : ''
  return `Ya está disponible para ${partes.join(' y ')}.${pendiente}`
}
