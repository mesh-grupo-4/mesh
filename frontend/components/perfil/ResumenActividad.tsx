import { StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { Pressable } from '@/components/Pressable'
import { useTheme } from '@/components/MeshUI'
import { formatHorasTotal, formatKmTotal } from '@/lib/format'

type Props = {
  /** `null` = todavía cargando o no se pudo cargar (no es lo mismo que cero). */
  viajes: number | null
  metros: number | null
  segundos: number | null
  /** Si viene, la tarjeta lleva a Estadísticas. */
  onPress?: () => void
}

/** Los tres números del perfil, cada uno con su unidad y qué significa. */
export function ResumenActividad({ viajes, metros, segundos, onPress }: Props) {
  const theme = useTheme()

  const datos = [
    { key: 'km', valor: metros == null ? '–' : formatKmTotal(metros), etiqueta: 'recorridos' },
    {
      key: 'viajes',
      valor: viajes == null ? '–' : String(viajes),
      etiqueta: viajes === 1 ? 'viaje terminado' : 'viajes terminados',
    },
    {
      key: 'tiempo',
      valor: segundos == null ? '–' : formatHorasTotal(segundos),
      etiqueta: 'en movimiento',
    },
  ]

  const contenido = (
    <>
      <View style={styles.fila}>
        {datos.map((d, i) => (
          <View
            key={d.key}
            style={[styles.dato, i > 0 && { borderLeftWidth: 1, borderLeftColor: theme.border }]}
          >
            <Text style={[styles.valor, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {d.valor}
            </Text>
            <Text style={[styles.etiqueta, { color: theme.textDim }]} numberOfLines={2}>
              {d.etiqueta}
            </Text>
          </View>
        ))}
      </View>
      {onPress ? (
        <View style={[styles.pie, { borderTopColor: theme.border }]}>
          <Text style={[styles.pieTexto, { color: theme.textDim }]}>Ver por actividad y por mes</Text>
          <Feather name="chevron-right" size={16} color={theme.textDim} />
        </View>
      ) : null}
    </>
  )

  const estiloCard = { backgroundColor: theme.surface, borderColor: theme.border }

  if (!onPress) return <View style={[styles.card, estiloCard]}>{contenido}</View>

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${datos.map((d) => `${d.valor} ${d.etiqueta}`).join(', ')}. Ver estadísticas`}
      style={({ pressed }) => [styles.card, estiloCard, pressed && { backgroundColor: theme.surface2 }]}
    >
      {contenido}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1 },
  fila: { flexDirection: 'row', paddingVertical: 16 },
  dato: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  valor: { fontSize: 19, fontWeight: '800' },
  etiqueta: { fontSize: 12.5, textAlign: 'center' },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  pieTexto: { fontSize: 13, fontWeight: '600' },
})
