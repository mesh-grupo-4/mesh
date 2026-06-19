import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const BACKEND_PORT = 3000;

/** Extrae hostname de exp://192.168.x.x:8081, http://host:port o host:port */
function hostFromUri(uri: string | undefined): string | null {
  if (!uri) return null;
  try {
    const normalized = uri.includes('://') ? uri.replace(/^exp:\/\//i, 'http://') : `http://${uri}`;
    const hostname = new URL(normalized).hostname?.trim();
    return hostname || null;
  } catch {
    const withoutScheme = uri.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    const host = withoutScheme.split(':')[0]?.trim();
    return host || null;
  }
}

function hostFromApiUrl(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return hostFromUri(url);
  }
}

function isTunnelApiUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return url.startsWith('https://');
  }
}

function isValidLanHost(host: string | null): host is string {
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  if (host.includes('.exp.direct') || host === 'exp') return false;
  return true;
}

/**
 * Host de Metro desde la URL del bundle JS (más fiable en iOS Expo Go que debuggerHost).
 * Ej: http://192.168.0.124:8081/index.bundle?platform=ios
 */
function hostFromMetroBundle(): string | null {
  if (!__DEV__) return null;
  try {
    const source = NativeModules.SourceCode as { scriptURL?: string } | undefined;
    const scriptURL = source?.scriptURL;
    if (!scriptURL) return null;
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/i);
    const host = match?.[1]?.trim() ?? null;
    return isValidLanHost(host) ? host : null;
  } catch {
    return null;
  }
}

/** IP/host de la PC donde corre Metro (Expo Go en celular físico). */
function resolveExpoDevHost(): string | null {
  const fromBundle = hostFromMetroBundle();
  if (fromBundle) return fromBundle;

  const candidates: (string | undefined)[] = [
    Constants.expoGoConfig?.debuggerHost,
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
  ];

  for (const raw of candidates) {
    const host = hostFromUri(raw);
    if (isValidLanHost(host)) return host;
  }

  return null;
}

/**
 * URL del backend Mesh.
 * - Expo Go en celular (LAN): misma IP que Metro (auto).
 * - Emulador Android: 10.0.2.2
 * - Expo túnel / otra red: EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app
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
    if (devHost) {
      return `http://${devHost}:${BACKEND_PORT}`;
    }

    if (Platform.OS === 'android' && !Constants.isDevice) {
      return `http://10.0.2.2:${BACKEND_PORT}`;
    }

    if (Constants.isDevice) {
      console.error(
        '[Mesh] No se detectó la IP del backend. ' +
          'Agregá EXPO_PUBLIC_API_URL=http://IP_DE_TU_PC:3000 en frontend/.env'
      );
    }
  }

  return `http://localhost:${BACKEND_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log('[Mesh] API_BASE_URL =', API_BASE_URL, Platform.OS);
}

/** Solo dev: UUID fijo si el sync falló pero querés probar otras pantallas. */
export const DEV_USER_ID = process.env.EXPO_PUBLIC_DEV_USER_ID ?? '';
