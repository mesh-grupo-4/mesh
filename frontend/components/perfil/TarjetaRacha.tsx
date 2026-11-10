import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { nivelRacha, type RachaApi } from '@/lib/rachasApi'

/** El ícono de la racha crece con cada hito (3, 5 y 10 semanas). */
const TAMANO_EMOJI_RACHA = [28, 32, 36, 42]
/** Título por nivel cuando se mira la racha de otra persona. */
const TITULO_NIVEL_AJENO = [
  'Sale todas las semanas',
  'Racha encendida',
  'Racha ardiente',
  'Racha legendaria',
]

type Props = {
  racha: RachaApi | null
  /** `true` en el perfil propio (textos en segunda persona, con consejo para mantenerla). */
  propia: boolean
}

/** RN-075: tarjeta de racha. Fondo, borde e ícono suben de intensidad con cada hito. */
export function TarjetaRacha({ racha, propia }: Props) {
  const theme = useTheme()
  const semanas = racha?.semanas_consecutivas ?? 0
  const nivel = nivelRacha(semanas)
  const enRiesgo = racha?.en_riesgo ?? false

  const valor =
    semanas > 0 ? `${semanas} semana${semanas === 1 ? '' : 's'} seguidas` : 'Sin racha activa'

  const hint = propia
    ? enRiesgo
      ? 'Salí esta semana para no perderla'
      : semanas > 0
        ? 'Completá un viaje cada semana para mantenerla'
        : 'Completá un viaje para arrancar una racha'
    : enRiesgo
      ? 'En riesgo esta semana'
      : semanas > 0
        ? TITULO_NIVEL_AJENO[nivel]
        : 'Todavía no arrancó una racha'

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: nivel >= 2 ? theme.fireWeak : theme.surface,
          borderColor: nivel >= 1 ? theme.fire : theme.border,
          borderWidth: nivel >= 3 ? 2 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: TAMANO_EMOJI_RACHA[nivel] }}>🔥</Text>
      <View style={styles.texto}>
        <Text style={[styles.valor, { color: theme.text }]}>{valor}</Text>
        <Text
          style={[
            styles.hint,
            {
              color: enRiesgo ? theme.danger : !propia && nivel >= 1 ? theme.fire : theme.textDim,
              fontWeight: !propia && nivel >= 1 ? '700' : '400',
            },
          ]}
        >
          {hint}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  texto: { flex: 1, gap: 2 },
  valor: { fontSize: 15.5, fontWeight: '800' },
  hint: { fontSize: 12.5 },
})
