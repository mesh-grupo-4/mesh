import { Stack } from 'expo-router'

export default function ConfigurarRutaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[viajeId]" />
    </Stack>
  )
}
