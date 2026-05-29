import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = 3000;

function hostFromUri(uri: string | undefined): string | null {
  if (!uri) return null;
  const host = uri.split(':')[0]?.trim();
  return host || null;
}

/** IP/host de la PC donde corre Metro (Expo Go en celular físico). */
function resolveExpoDevHost(): string | null {
  const debuggerHost = Constants.expoGoConfig?.debuggerHost;
  if (debuggerHost) {
    return debuggerHost.split(':')[0] ?? null;
  }
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.linkingUri;
  return hostFromUri(hostUri ?? undefined);
}

/**
 * URL del backend Mesh.
 * - Expo Go en celular: misma IP que Metro (auto).
 * - Emulador Android: 10.0.2.2
 * - Override manual: EXPO_PUBLIC_API_URL en .env
 */
export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    if (__DEV__ && Constants.isDevice && fromEnv.includes('10.0.2.2')) {
      console.warn(
        '[Mesh] 10.0.2.2 solo funciona en emulador Android. En celular físico usá la IP Wi‑Fi de tu PC.'
      );
    }
    return fromEnv.replace(/\/$/, '');
  }

  if (__DEV__) {
    const devHost = resolveExpoDevHost();
    if (devHost && devHost !== 'localhost' && devHost !== '127.0.0.1') {
      return `http://${devHost}:${BACKEND_PORT}`;
    }

    if (Platform.OS === 'android' && !Constants.isDevice) {
      return `http://10.0.2.2:${BACKEND_PORT}`;
    }
  }

  return `http://localhost:${BACKEND_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log('[Mesh] API_BASE_URL =', API_BASE_URL);
}

/** Solo dev: UUID fijo si el sync falló pero querés probar otras pantallas. */
export const DEV_USER_ID = process.env.EXPO_PUBLIC_DEV_USER_ID ?? '';
