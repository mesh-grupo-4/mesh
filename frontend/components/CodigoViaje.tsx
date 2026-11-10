import * as Clipboard from 'expo-clipboard'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { formatearCodigoViaje } from '@/lib/inviteLinks'

const MS_AVISO_COPIADO = 2000

/** RN-015: código del viaje, para dictarlo o copiarlo (con un toque) a quien no pueda escanear el QR. */
export function CodigoViaje({ codigo }: { codigo?: string | null }) {
  const theme = useTheme()
  const [copiado, setCopiado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  if (!codigo) return null
  const formateado = formatearCodigoViaje(codigo)

  const copiar = async () => {
    try {
      await Clipboard.setStringAsync(formateado)
    } catch {
      return
    }
    setCopiado(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiado(false), MS_AVISO_COPIADO)
  }

  return (
    <Pressable
      onPress={copiar}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Código del viaje ${formateado}`}
      accessibilityHint="Tocá para copiarlo"
      style={({ pressed }) => [styles.contenedor, pressed && styles.presionado]}
    >
      <Text style={[styles.etiqueta, { color: theme.textDim }]}>
        {copiado ? '¡Código copiado!' : 'Código del viaje · tocá para copiar'}
      </Text>
      <Text style={[styles.codigo, { color: theme.text }]}>{formateado}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  contenedor: { alignItems: 'center', gap: 2 },
  presionado: { opacity: 0.6 },
  etiqueta: { fontSize: 14, fontWeight: '600' },
  codigo: { fontSize: 26, fontWeight: '800', letterSpacing: 2, fontFamily: 'SpaceMono' },
})
