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
 *
 *   EXPO_PUBLIC_LINKS_BASE_URL   → dominio de la landing (https://...). Registra los
 *                                  App Links / Universal Links de /ruta y /unirse.
 */
function hostDeLinks(url: string | undefined): string | undefined {
  try {
    return url?.trim() ? new URL(url.trim()).hostname : undefined
  } catch {
    return undefined
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || undefined
  const iosKey = process.env.GOOGLE_MAPS_IOS_API_KEY?.trim() || undefined
  const linksHost = hostDeLinks(process.env.EXPO_PUBLIC_LINKS_BASE_URL)

  return {
    ...(config as ExpoConfig),
    ...(linksHost
      ? {
          ios: { ...config.ios, associatedDomains: [`applinks:${linksHost}`] },
          android: {
            ...config.android,
            intentFilters: [
              {
                action: 'VIEW',
                autoVerify: true,
                category: ['BROWSABLE', 'DEFAULT'],
                data: ['/ruta', '/unirse'].map((pathPrefix) => ({
                  scheme: 'https',
                  host: linksHost,
                  pathPrefix,
                })),
              },
            ],
          },
        }
      : {}),
    plugins: [
      ...(config.plugins ?? []),
      ['react-native-maps', { androidGoogleMapsApiKey: androidKey, iosGoogleMapsApiKey: iosKey }],
      './plugins/withIosSceneLifecycle',
    ],
    extra: {
      ...config.extra,
      googleMapsIos: Boolean(iosKey),
    },
  }
}
