import { Feather } from '@expo/vector-icons'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/components/MeshUI'
import { DragToDismiss } from '@/components/DragToDismiss'
import { CATEGORIAS_PARADA, type CategoriaParadaApi } from '@/lib/paradasApi'

/** Selector de categoría al registrar una parada voluntaria (RN-022). */
type Props = {
  visible: boolean
  onSeleccionar: (categoria: CategoriaParadaApi) => void
  onCancelar: () => void
}

export function CategoriaParadaSheet({ visible, onSeleccionar, onCancelar }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const accidente = CATEGORIAS_PARADA.find((c) => c.id === 'accidente')
  const resto = CATEGORIAS_PARADA.filter((c) => c.id !== 'accidente')

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <GestureHandlerRootView style={styles.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancelar} />
        <DragToDismiss
          onDismiss={onCancelar}
          style={[
            styles.hoja,
            {
              backgroundColor: theme.surface,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={[styles.asa, { backgroundColor: theme.borderStrong }]} />

          <Text style={[styles.titulo, { color: theme.text }]}>¿Por qué parás?</Text>
          <Text style={[styles.subtitulo, { color: theme.textDim }]}>
            Se le avisa al grupo con el motivo.
          </Text>

          {accidente ? (
            <Pressable
              style={({ pressed }) => [
                styles.accidente,
                { backgroundColor: theme.danger },
                pressed && styles.presionado,
              ]}
              onPress={() => onSeleccionar(accidente.id)}
              accessibilityRole="button"
              accessibilityLabel="Reportar un accidente"
            >
              <View style={styles.accidenteIcono}>
                <Feather name="alert-triangle" size={22} color="#fff" />
              </View>
              <View style={styles.accidenteTxtWrap}>
                <Text style={styles.accidenteTitulo}>Accidente</Text>
                <Text style={styles.accidenteSub}>Avisa a todo el grupo al instante</Text>
              </View>
              <Feather name="chevron-right" size={22} color="rgba(255,255,255,0.9)" />
            </Pressable>
          ) : null}

          <View style={styles.grilla}>
            {resto.map((c) => (
              <Pressable
                key={c.id}
                style={({ pressed }) => [
                  styles.opcion,
                  { backgroundColor: theme.surface2, borderColor: theme.border },
                  pressed && [styles.presionado, { borderColor: theme.accentLine }],
                ]}
                onPress={() => onSeleccionar(c.id)}
                accessibilityRole="button"
                accessibilityLabel={`Parada por ${c.label}`}
              >
                <View style={[styles.opcionEmojiWrap, { backgroundColor: theme.surface }]}>
                  <Text style={styles.emoji}>{c.emoji}</Text>
                </View>
                <Text style={[styles.opcionTxt, { color: theme.text }]} numberOfLines={2}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.cancelar,
              { backgroundColor: theme.surface2 },
              pressed && styles.presionado,
            ]}
            onPress={onCancelar}
          >
            <Text style={[styles.cancelarTxt, { color: theme.textDim }]}>Cancelar</Text>
          </Pressable>
        </DragToDismiss>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  hoja: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  asa: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: 13.5,
    marginTop: 3,
    marginBottom: 16,
  },
  accidente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 66,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  accidenteIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accidenteTxtWrap: {
    flex: 1,
  },
  accidenteTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  accidenteSub: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  grilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  opcion: {
    // Dos por fila: objetivos grandes para tocar en movimiento (RN-052).
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
  },
  opcionEmojiWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 18,
  },
  opcionTxt: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
  },
  presionado: {
    opacity: 0.7,
  },
  cancelar: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelarTxt: {
    fontSize: 15.5,
    fontWeight: '700',
  },
})
