import { Pressable, Text, View, StyleSheet } from 'react-native'
import { useCopilot, type TooltipProps } from 'react-native-copilot'
import { useTheme } from '@/components/MeshUI'
import { tamanoOutdoor } from '@/constants/Typography'

/** Tooltip de los tours de ayuda, tematizado con `useTheme()` en vez del estilo
 * por defecto de react-native-copilot (que no tiene acceso a los colores de Mesh). */
export function TooltipAyuda({ labels }: TooltipProps) {
  const theme = useTheme()
  const { goToNext, goToPrev, stop, currentStep, isFirstStep, isLastStep } = useCopilot()

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.texto, { color: theme.text, fontSize: tamanoOutdoor(14) }]}>
        {currentStep?.text}
      </Text>
      <View style={styles.acciones}>
        {!isLastStep ? (
          <Pressable onPress={() => void stop()} hitSlop={8}>
            <Text style={[styles.btnTexto, { color: theme.textDim }]}>{labels.skip}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={styles.accionesDerecha}>
          {!isFirstStep ? (
            <Pressable onPress={() => void goToPrev()} hitSlop={8} style={styles.btnSecundario}>
              <Text style={[styles.btnTexto, { color: theme.text }]}>{labels.previous}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void (isLastStep ? stop() : goToNext())}
            style={[styles.btnPrimario, { backgroundColor: theme.accent }]}
            hitSlop={8}
          >
            <Text style={[styles.btnTexto, { color: theme.onAccent }]}>
              {isLastStep ? labels.finish : labels.next}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    maxWidth: 300,
  },
  texto: {
    lineHeight: 20,
    fontWeight: '500',
  },
  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accionesDerecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  btnSecundario: {
    paddingVertical: 4,
  },
  btnPrimario: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnTexto: {
    fontSize: 13.5,
    fontWeight: '700',
  },
})
