import { Stack } from 'expo-router'

export default function ConfigurarRutaLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[viajeId]"
        options={{
          title: 'Ruta y paradas',
          headerBackTitle: 'Volver',
        }}
      />
    </Stack>
  )
}
