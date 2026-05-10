/**
 * En desarrollo: definí `EXPO_PUBLIC_API_URL` (p. ej. `http://10.0.2.2:3000` en emulador Android).
 * Opcional: `EXPO_PUBLIC_DEV_USER_ID` (UUID) para no tener que cargarlo en la pantalla.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export const DEV_USER_ID = process.env.EXPO_PUBLIC_DEV_USER_ID ?? ''
