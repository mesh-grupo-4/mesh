import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Btn, useTheme } from '@/components/MeshUI'

export type CandidatoSucesor = { id: string; nombre: string }

type Props = {
  visible: boolean
  titulo: string
  descripcion: string
  /** Ordenados por antigüedad: el primero queda preseleccionado (como RN-013 en grupos). */
  candidatos: CandidatoSucesor[]
  confirmLabel: string
  loading?: boolean
  onConfirm: (nuevoLiderId: string) => void
  onCancel: () => void
}

/**
 * RN-029d: elegir a quién cederle el liderazgo del viaje. Lo usan "Ceder liderazgo"
 * y "Salir del viaje" del líder (para irse tiene que dejar a alguien a cargo).
 */
export function SelectorSucesorModal({
  visible,
  titulo,
  descripcion,
  candidatos,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const theme = useTheme()
  const [elegido, setElegido] = useState<string | null>(candidatos[0]?.id ?? null)

  // Al abrir, preselecciona al más antiguo de la lista vigente.
  useEffect(() => {
    if (visible) setElegido(candidatos[0]?.id ?? null)
  }, [visible, candidatos])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.fondo, { backgroundColor: theme.scrim }]}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.titulo, { color: theme.text }]}>{titulo}</Text>
          <Text style={[styles.descripcion, { color: theme.textDim }]}>{descripcion}</Text>

          <ScrollView style={styles.lista} contentContainerStyle={{ gap: 8 }}>
            {candidatos.map((c) => {
              const activo = c.id === elegido
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setElegido(c.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  style={[
                    styles.opcion,
                    {
                      borderColor: activo ? theme.accent : theme.border,
                      backgroundColor: activo ? theme.accentWeak : theme.surface,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      { borderColor: activo ? theme.accent : theme.textMute },
                    ]}
                  >
                    {activo && <View style={[styles.radioPunto, { backgroundColor: theme.accent }]} />}
                  </View>
                  <Text style={[styles.nombre, { color: theme.text }]}>{c.nombre}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <Btn
            variant="primary"
            block
            onPress={() => elegido && onConfirm(elegido)}
            disabled={!elegido || loading}
            loading={loading}
          >
            {confirmLabel}
          </Btn>
          <Btn variant="ghost" block onPress={onCancel} disabled={loading}>
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
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1.2,
    padding: 20,
    gap: 12,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '800',
  },
  descripcion: {
    fontSize: 15,
    lineHeight: 22,
  },
  lista: {
    maxHeight: 280,
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioPunto: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '600',
  },
})
