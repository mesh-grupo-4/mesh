import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Extiende `app.json` con la API key de Google Maps (Maps SDK for Android/iOS)
 * leída del entorno, para no commitearla. La key va embebida en el binario: se
 * aplica al hacer un build nativo (`expo run:*` / EAS), no en Expo Go.
 *
 *   GOOGLE_MAPS_ANDROID_API_KEY  → restringida a Android (package + SHA-1)
 *   GOOGLE_MAPS_IOS_API_KEY      → restringida a iOS (bundle id)
 *
 * Sin key de iOS el mapa cae a Apple Maps en iPhone (ver `MeshMapView`).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || undefined
  const iosKey = process.env.GOOGLE_MAPS_IOS_API_KEY?.trim() || undefined

  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      ['react-native-maps', { androidGoogleMapsApiKey: androidKey, iosGoogleMapsApiKey: iosKey }],
    ],
    extra: {
      ...config.extra,
      googleMapsIos: Boolean(iosKey),
    },
  }
}
