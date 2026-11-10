import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { formatearCodigoViaje } from '@/lib/inviteLinks'

/** RN-015: código del viaje, para dictarlo o copiarlo a quien no pueda escanear el QR. */
export function CodigoViaje({ codigo }: { codigo?: string | null }) {
  const theme = useTheme()
  if (!codigo) return null

  return (
    <View style={styles.contenedor}>
      <Text style={[styles.etiqueta, { color: theme.textDim }]}>Código del viaje</Text>
      <Text selectable style={[styles.codigo, { color: theme.text }]}>
        {formatearCodigoViaje(codigo)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { alignItems: 'center', gap: 2 },
  etiqueta: { fontSize: 14, fontWeight: '600' },
  codigo: { fontSize: 26, fontWeight: '800', letterSpacing: 2, fontFamily: 'SpaceMono' },
})
