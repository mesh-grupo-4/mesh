import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'mesh:pendingReturn'

/** Guarda un path interno (p. ej. `/ruta?token=...`) para volver tras login. */
export async function setPendingReturn(path: string): Promise<void> {
  const trimmed = path.trim()
  if (!trimmed.startsWith('/')) return
  await AsyncStorage.setItem(KEY, trimmed)
}

export async function consumePendingReturn(): Promise<string | null> {
  const value = await AsyncStorage.getItem(KEY)
  if (value) await AsyncStorage.removeItem(KEY)
  return value
}
