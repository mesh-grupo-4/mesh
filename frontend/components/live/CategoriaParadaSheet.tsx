import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { CATEGORIAS_PARADA, type CategoriaParadaApi } from '@/lib/paradasApi'

/** Selector de categoría al registrar una parada voluntaria (RN-022). */
type Props = {
  visible: boolean
  onSeleccionar: (categoria: CategoriaParadaApi) => void
  onCancelar: () => void
}

export function CategoriaParadaSheet({ visible, onSeleccionar, onCancelar }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <Pressable style={styles.fondo} onPress={onCancelar}>
        <Pressable style={styles.hoja} onPress={(e) => e.stopPropagation()}>
          <View style={styles.asa} />
          <Text style={styles.titulo}>¿Por qué parás?</Text>

          <View style={styles.grilla}>
            {CATEGORIAS_PARADA.map((c) => (
              <Pressable
                key={c.id}
                style={({ pressed }) => [styles.opcion, pressed && styles.opcionPresionada]}
                onPress={() => onSeleccionar(c.id)}
                accessibilityRole="button"
                accessibilityLabel={`Parada por ${c.label}`}
              >
                <Text style={styles.emoji}>{c.emoji}</Text>
                <Text style={styles.opcionTxt}>{c.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.cancelar, pressed && styles.opcionPresionada]}
            onPress={onCancelar}
          >
            <Text style={styles.cancelarTxt}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  asa: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 14,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
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
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  opcionPresionada: {
    opacity: 0.7,
  },
  emoji: {
    fontSize: 22,
  },
  opcionTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  cancelar: {
    marginTop: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelarTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6b7280',
  },
})
