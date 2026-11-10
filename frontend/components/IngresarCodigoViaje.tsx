import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Btn, Field } from '@/components/MeshUI'
import { formatearCodigoViaje, LARGO_CODIGO_VIAJE } from '@/lib/inviteLinks'
import { ejecutarUnionPorCodigo } from '@/lib/joinViajeQr'

type Props = {
  /** Bloquea el campo mientras se procesa un QR escaneado. */
  deshabilitado?: boolean
}

/** RN-015: sumarse a un viaje escribiendo su código. Si sale bien, abre el viaje. */
export function IngresarCodigoViaje({ deshabilitado = false }: Props) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string>()
  const [enviando, setEnviando] = useState(false)

  const completo = codigo.replace('-', '').length === LARGO_CODIGO_VIAJE

  const enviar = async () => {
    if (!completo || enviando || deshabilitado) return
    setEnviando(true)
    setError(undefined)
    const problema = await ejecutarUnionPorCodigo(codigo)
    if (problema) {
      setError(problema)
      setEnviando(false)
    }
  }

  return (
    <View style={styles.contenedor}>
      <Field
        label="O ingresá el código del viaje"
        leading="hash"
        placeholder="ABCD-2345"
        value={codigo}
        onChangeText={(v) => {
          setCodigo(formatearCodigoViaje(v))
          setError(undefined)
        }}
        error={error}
        editable={!deshabilitado && !enviando}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={LARGO_CODIGO_VIAJE + 1}
        returnKeyType="go"
        textAlign="center"
        onSubmitEditing={() => void enviar()}
      />
      <Btn block onPress={() => void enviar()} disabled={!completo || deshabilitado} loading={enviando}>
        Unirme al viaje
      </Btn>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    gap: 12,
  },
})
