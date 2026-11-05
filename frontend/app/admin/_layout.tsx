import { Stack } from 'expo-router'

/** Backoffice superadmin (RN-120 a RN-126). Cada pantalla dibuja su propia TopBar. */
export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
