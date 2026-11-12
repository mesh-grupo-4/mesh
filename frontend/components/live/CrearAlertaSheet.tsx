import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Pressable } from '@/components/Pressable'

import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DragToDismiss } from '@/components/DragToDismiss'
import { useTheme } from '@/components/MeshUI'
import {
  MENSAJE_PREDETERMINADO,
  TIPOS_ALERTA,
  type TipoAlertaApi,
} from '@/lib/alertasApi'

import { AlertaMapPickModal } from './AlertaMapPickModal'

type UbicacionAlerta = { lat: number; lng: number }

/** Alerta ya armada desde un lugar elegido en "Cerca mío" o un pedido aprobado. */
export type AlertaInicial = {
  tipo: TipoAlertaApi
  mensaje: string
  ubicacion: UbicacionAlerta
  nombreUbicacion: string
}

/**
 * US1: el líder o integrante elige tipo, mensaje y opcionalmente marca parada en mapa.
 * Los lugares con nombre (estaciones, baños, comida) se eligen desde "Cerca mío",
 * que abre este sheet ya completo con `inicial`.
 */
type Props = {
  visible: boolean
  enviando: boolean
  /** Se aplica cada vez que el sheet se abre; sin él arranca vacío. */
  inicial?: AlertaInicial | null
  /** Centro inicial para el picker de mapa (posición actual o fallback). */
  centroMapaInicial: { latitude: number; longitude: number }
  onPublicar: (tipo: TipoAlertaApi, mensaje: string, ubicacion?: UbicacionAlerta) => void
  onCancelar: () => void
}

const MAX_MENSAJE = 280

export function CrearAlertaSheet({
  visible,
  enviando,
  inicial,
  centroMapaInicial,
  onPublicar,
  onCancelar,
}: Props) {
  const [tipo, setTipo] = useState<TipoAlertaApi>('informacion')
  const [mensaje, setMensaje] = useState(MENSAJE_PREDETERMINADO.informacion)
  const [mensajeEditado, setMensajeEditado] = useState(false)
  const [ubicacion, setUbicacion] = useState<UbicacionAlerta | null>(null)
  const [eligiendoMapa, setEligiendoMapa] = useState(false)
  const [nombreUbicacion, setNombreUbicacion] = useState<string | null>(null)
  const tipoAnterior = useRef(tipo)
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => crearEstilos(theme), [theme])

  const quitarUbicacion = () => {
    setUbicacion(null)
    setNombreUbicacion(null)
  }

  useEffect(() => {
    if (!visible) return
    if (inicial) {
      setTipo(inicial.tipo)
      setMensaje(inicial.mensaje.slice(0, MAX_MENSAJE))
      // Nombra el lugar: cambiar el tipo no debe pisarlo con el predeterminado.
      setMensajeEditado(true)
      setUbicacion(inicial.ubicacion)
      setNombreUbicacion(inicial.nombreUbicacion)
      tipoAnterior.current = inicial.tipo
      return
    }
    setTipo('informacion')
    setMensaje(MENSAJE_PREDETERMINADO.informacion)
    setMensajeEditado(false)
    quitarUbicacion()
    tipoAnterior.current = 'informacion'
    // Solo al abrir: `inicial` llega junto con `visible`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const cerrar = () => {
    setMensaje(MENSAJE_PREDETERMINADO.informacion)
    setMensajeEditado(false)
    setTipo('informacion')
    quitarUbicacion()
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
    quitarUbicacion()
  }

  return (
    <>
      <Modal visible={visible && !eligiendoMapa} transparent animationType="slide" onRequestClose={cerrar}>
        <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView
          style={[styles.fondo, { paddingTop: insets.top }]}
          behavior="padding"
        >
          <Pressable style={styles.fondoTap} onPress={cerrar} />
          <DragToDismiss
            onDismiss={cerrar}
            style={styles.hoja}
            cabecera={
              <>
                <View style={styles.asa} />
                <Text style={styles.titulo}>Nueva alerta para el grupo</Text>
              </>
            }
          >
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
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
                      <Text style={[styles.tipoEmoji, { color: t.color }]}>{t.emoji}</Text>
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
                placeholderTextColor={theme.textMute}
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
                  <Text style={styles.ubicacionTxt} numberOfLines={2}>
                    {nombreUbicacion ?? `${ubicacion.lat.toFixed(5)}, ${ubicacion.lng.toFixed(5)}`}
                  </Text>
                  <Pressable onPress={quitarUbicacion} hitSlop={8}>
                    <Text style={styles.quitarUbicacion}>Quitar</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={styles.ayudaUbicacion}>
                    Para estaciones, baños o comida usá el botón 📍 del mapa.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.marcarMapa, pressed && styles.presionado]}
                    onPress={() => setEligiendoMapa(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Marcar en el mapa dónde van a parar"
                  >
                    <Text style={styles.marcarMapaTxt}>📍 Marcar en el mapa</Text>
                  </Pressable>
                </>
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
                    <ActivityIndicator color={theme.onAccent} />
                  ) : (
                    <Text style={styles.enviarTxt}>Enviar a todos</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </DragToDismiss>
        </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Modal>

      <AlertaMapPickModal
        visible={eligiendoMapa}
        initialCenter={centroMapaInicial}
        onConfirm={(punto) => {
          setUbicacion(punto)
          setNombreUbicacion(null)
          setEligiendoMapa(false)
        }}
        onCancel={() => setEligiendoMapa(false)}
      />
    </>
  )
}

type Tema = ReturnType<typeof useTheme>

const crearEstilos = (theme: Tema) =>
  StyleSheet.create({
  root: {
    flex: 1,
  },
  fondo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  fondoTap: {
    flex: 1,
  },
  hoja: {
    flexShrink: 1,
    backgroundColor: theme.surface,
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
    backgroundColor: theme.borderStrong,
    marginBottom: 14,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.textDim,
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
    borderColor: theme.border,
    backgroundColor: theme.surface2,
  },
  tipoEmoji: {
    fontSize: 16,
  },
  tipoTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textDim,
  },
  input: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface2,
    padding: 12,
    fontSize: 16,
    color: theme.text,
    textAlignVertical: 'top',
  },
  contador: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontSize: 12,
    color: theme.textMute,
  },
  ayudaUbicacion: {
    fontSize: 14,
    color: theme.textDim,
  },
  marcarMapa: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.accentLine,
    backgroundColor: theme.accentWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcarMapaTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.accent,
  },
  ubicacionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.accentLine,
    backgroundColor: theme.accentWeak,
  },
  ubicacionTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  quitarUbicacion: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.danger,
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
    backgroundColor: theme.surface,
    borderColor: theme.border,
  },
  cancelarTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textDim,
  },
  enviar: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  enviarTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.onAccent,
  },
  presionado: {
    opacity: 0.75,
  },
  deshabilitado: {
    opacity: 0.5,
  },
})
