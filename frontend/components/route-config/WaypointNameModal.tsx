import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Btn, useTheme } from '@/components/MeshUI'

type Props = {
  visible: boolean
  initialName: string
  loadingName?: boolean
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function WaypointNameModal({
  visible,
  initialName,
  loadingName = false,
  onConfirm,
  onCancel,
}: Props) {
  const theme = useTheme()
  const [name, setName] = useState(initialName)

  useEffect(() => {
    if (visible) {
      setName(initialName)
    }
  }, [visible, initialName])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.title, { color: theme.text }]}>Nombre del punto</Text>
          <Text style={[styles.subtitle, { color: theme.textDim }]}>
            Podés personalizarlo (ej. Kiosquito de la esquina)
          </Text>

          {loadingName ? (
            <ActivityIndicator size="small" color={theme.accent} style={styles.loader} />
          ) : (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nombre del lugar"
              placeholderTextColor={theme.textMute}
              style={[
                styles.input,
                {
                  backgroundColor: theme.surface2,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              autoFocus
              autoCorrect={false}
            />
          )}

          <View style={styles.actions}>
            <Btn variant="ghost" onPress={onCancel}>
              Cancelar
            </Btn>
            <Btn
              disabled={!name.trim() || loadingName}
              onPress={() => onConfirm(name.trim())}
            >
              Confirmar
            </Btn>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  loader: {
    marginVertical: 20,
  },
  input: {
    marginTop: 16,
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
})
