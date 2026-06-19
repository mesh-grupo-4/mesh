import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

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
  const [name, setName] = useState(initialName)

  useEffect(() => {
    if (visible) {
      setName(initialName)
    }
  }, [visible, initialName])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Nombre del punto</Text>
          <Text style={styles.subtitle}>Podés personalizarlo (ej. Kiosquito de la esquina)</Text>

          {loadingName ? (
            <ActivityIndicator size="small" color="#374151" style={styles.loader} />
          ) : (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nombre del lugar"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              autoFocus
              autoCorrect={false}
            />
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelTxt}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, !name.trim() && styles.confirmBtnOff]}
              disabled={!name.trim() || loadingName}
              onPress={() => onConfirm(name.trim())}
            >
              <Text style={styles.confirmTxt}>Confirmar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
  },
  loader: {
    marginVertical: 20,
  },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelTxt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmBtn: {
    backgroundColor: '#15803d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  confirmBtnOff: {
    opacity: 0.45,
  },
  confirmTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
})
