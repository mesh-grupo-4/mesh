import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Btn, Field, useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import { formatearCodigoViaje, LARGO_CODIGO_VIAJE } from '@/lib/inviteLinks'
import { ejecutarUnionPorCodigo } from '@/lib/joinViajeQr'

type Props = {
  visible: boolean
  onCerrar: () => void
}

/** RN-015: sumarse a un viaje escribiendo su código. Si sale bien, abre el viaje. */
export function IngresarCodigoViajeModal({ visible, onCerrar }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string>()
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (visible) {
      setCodigo('')
      setError(undefined)
      setEnviando(false)
    }
  }, [visible])

  const completo = codigo.replace('-', '').length === LARGO_CODIGO_VIAJE

  const enviar = async () => {
    if (!completo || enviando) return
    setEnviando(true)
    setError(undefined)
    const problema = await ejecutarUnionPorCodigo(codigo)
    if (problema) {
      setError(problema)
      setEnviando(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      {/* Tarjeta arriba para que el teclado nunca tape el campo. */}
      <View style={[styles.fondo, { paddingTop: insets.top + 72 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityLabel="Cerrar" />
        <View style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.titulo, { color: theme.text }]}>Ingresar código</Text>
          <Text style={[styles.subtitulo, { color: theme.textDim }]}>
            Pedile el código del viaje a quien lo organiza.
          </Text>
          <Field
            label="Código del viaje"
            leading="hash"
            placeholder="ABCD-2345"
            value={codigo}
            onChangeText={(v) => {
              setCodigo(formatearCodigoViaje(v))
              setError(undefined)
            }}
            error={error}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={LARGO_CODIGO_VIAJE + 1}
            returnKeyType="go"
            onSubmitEditing={() => void enviar()}
          />
          <Btn block onPress={() => void enviar()} disabled={!completo} loading={enviando}>
            Unirme al viaje
          </Btn>
          <Btn variant="ghost" block onPress={onCerrar}>
            Cancelar
          </Btn>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 10, 10, 0.65)',
  },
  tarjeta: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  titulo: { fontSize: 20, fontWeight: '800' },
  subtitulo: { fontSize: 15, lineHeight: 21 },
})
