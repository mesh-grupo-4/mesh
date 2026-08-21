import { useState } from 'react'
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

import { TIPOS_ALERTA, type TipoAlertaApi } from '@/lib/alertasApi'

/** US1: el líder elige tipo y escribe el mensaje (RN-041). */
type Props = {
  visible: boolean
  enviando: boolean
  onPublicar: (tipo: TipoAlertaApi, mensaje: string) => void
  onCancelar: () => void
}

const MAX_MENSAJE = 280

export function CrearAlertaSheet({ visible, enviando, onPublicar, onCancelar }: Props) {
  const [tipo, setTipo] = useState<TipoAlertaApi>('informacion')
  const [mensaje, setMensaje] = useState('')

  const cerrar = () => {
    setMensaje('')
    setTipo('informacion')
    onCancelar()
  }

  const publicar = () => {
    const texto = mensaje.trim()
    if (!texto) return
    onPublicar(tipo, texto)
    setMensaje('')
    setTipo('informacion')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      <KeyboardAvoidingView
        style={styles.fondo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.fondoTap} onPress={cerrar} />
        <View style={styles.hoja}>
          <View style={styles.asa} />
          <Text style={styles.titulo}>Nueva alerta para el grupo</Text>

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.tipos}>
            {TIPOS_ALERTA.map((t) => {
              const activo = t.id === tipo
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.tipo,
                    activo && { borderColor: t.color, backgroundColor: `${t.color}1a` },
                  ]}
                  onPress={() => setTipo(t.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                  accessibilityLabel={`Tipo ${t.label}`}
                >
                  <Text style={styles.tipoEmoji}>{t.emoji}</Text>
                  <Text style={[styles.tipoTxt, activo && { color: t.color }]}>{t.label}</Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={styles.label}>Mensaje</Text>
          <TextInput
            style={styles.input}
            value={mensaje}
            onChangeText={(t) => setMensaje(t.slice(0, MAX_MENSAJE))}
            placeholder="Ej: Paramos a cargar nafta en la YPF de Ruta 9 km 40"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            maxLength={MAX_MENSAJE}
          />
          <Text style={styles.contador}>
            {mensaje.length}/{MAX_MENSAJE}
          </Text>

          <View style={styles.acciones}>
            <Pressable
              style={({ pressed }) => [styles.boton, styles.cancelar, pressed && styles.presionado]}
              onPress={cerrar}
              disabled={enviando}
            >
              <Text style={styles.cancelarTxt}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.boton,
                styles.enviar,
                pressed && styles.presionado,
                (!mensaje.trim() || enviando) && styles.deshabilitado,
              ]}
              onPress={publicar}
              disabled={!mensaje.trim() || enviando}
              accessibilityRole="button"
              accessibilityLabel="Enviar alerta a todos los integrantes"
            >
              {enviando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.enviarTxt}>Enviar a todos</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  fondoTap: {
    flex: 1,
  },
  hoja: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
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
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tipoEmoji: {
    fontSize: 16,
  },
  tipoTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4b5563',
  },
  input: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 12,
    fontSize: 16,
    color: '#111827',
    textAlignVertical: 'top',
  },
  contador: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
  },
  acciones: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  boton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  cancelar: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  cancelarTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6b7280',
  },
  enviar: {
    backgroundColor: '#4338ca',
    borderColor: '#4338ca',
  },
  enviarTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  presionado: {
    opacity: 0.75,
  },
  deshabilitado: {
    opacity: 0.5,
  },
})
