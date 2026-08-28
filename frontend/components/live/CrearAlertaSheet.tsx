import { useEffect, useRef, useState } from 'react'
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

import {
  MENSAJE_PREDETERMINADO,
  TIPOS_ALERTA,
  type TipoAlertaApi,
} from '@/lib/alertasApi'

import { AlertaMapPickModal } from './AlertaMapPickModal'

type UbicacionAlerta = { lat: number; lng: number }

/** US1: el líder o integrante elige tipo, mensaje y opcionalmente marca parada en mapa. */
type Props = {
  visible: boolean
  enviando: boolean
  /** Centro inicial para el picker de mapa (posición actual o fallback). */
  centroMapaInicial: { latitude: number; longitude: number }
  onPublicar: (tipo: TipoAlertaApi, mensaje: string, ubicacion?: UbicacionAlerta) => void
  onCancelar: () => void
}

const MAX_MENSAJE = 280

export function CrearAlertaSheet({
  visible,
  enviando,
  centroMapaInicial,
  onPublicar,
  onCancelar,
}: Props) {
  const [tipo, setTipo] = useState<TipoAlertaApi>('informacion')
  const [mensaje, setMensaje] = useState(MENSAJE_PREDETERMINADO.informacion)
  const [mensajeEditado, setMensajeEditado] = useState(false)
  const [ubicacion, setUbicacion] = useState<UbicacionAlerta | null>(null)
  const [eligiendoMapa, setEligiendoMapa] = useState(false)
  const tipoAnterior = useRef(tipo)

  useEffect(() => {
    if (!visible) return
    setTipo('informacion')
    setMensaje(MENSAJE_PREDETERMINADO.informacion)
    setMensajeEditado(false)
    setUbicacion(null)
    tipoAnterior.current = 'informacion'
  }, [visible])

  const cerrar = () => {
    setMensaje(MENSAJE_PREDETERMINADO.informacion)
    setMensajeEditado(false)
    setTipo('informacion')
    setUbicacion(null)
    onCancelar()
  }

  const elegirTipo = (nuevo: TipoAlertaApi) => {
    setTipo(nuevo)
    if (!mensajeEditado || mensaje === MENSAJE_PREDETERMINADO[tipoAnterior.current]) {
      setMensaje(MENSAJE_PREDETERMINADO[nuevo])
      setMensajeEditado(false)
    }
    tipoAnterior.current = nuevo
  }

  const publicar = () => {
    onPublicar(tipo, mensaje.trim(), ubicacion ?? undefined)
    setMensaje(MENSAJE_PREDETERMINADO.informacion)
    setMensajeEditado(false)
    setTipo('informacion')
    setUbicacion(null)
  }

  return (
    <>
      <Modal visible={visible && !eligiendoMapa} transparent animationType="slide" onRequestClose={cerrar}>
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
                    onPress={() => elegirTipo(t.id)}
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
              onChangeText={(t) => {
                setMensaje(t.slice(0, MAX_MENSAJE))
                setMensajeEditado(true)
              }}
              placeholder="Podés editar el mensaje predeterminado"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              maxLength={MAX_MENSAJE}
            />
            <Text style={styles.contador}>
              {mensaje.length}/{MAX_MENSAJE}
            </Text>

            <Text style={styles.label}>Dónde paran (opcional)</Text>
            {ubicacion ? (
              <View style={styles.ubicacionRow}>
                <Text style={styles.ubicacionTxt}>
                  {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
                </Text>
                <Pressable onPress={() => setUbicacion(null)} hitSlop={8}>
                  <Text style={styles.quitarUbicacion}>Quitar</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.marcarMapa, pressed && styles.presionado]}
                onPress={() => setEligiendoMapa(true)}
                accessibilityRole="button"
                accessibilityLabel="Marcar en el mapa dónde van a parar"
              >
                <Text style={styles.marcarMapaTxt}>📍 Marcar en el mapa</Text>
              </Pressable>
            )}

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
                  enviando && styles.deshabilitado,
                ]}
                onPress={publicar}
                disabled={enviando}
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

      <AlertaMapPickModal
        visible={eligiendoMapa}
        initialCenter={centroMapaInicial}
        onConfirm={(punto) => {
          setUbicacion(punto)
          setEligiendoMapa(false)
        }}
        onCancel={() => setEligiendoMapa(false)}
      />
    </>
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
  marcarMapa: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcarMapaTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4338ca',
  },
  ubicacionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
  },
  ubicacionTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3730a3',
  },
  quitarUbicacion: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
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
