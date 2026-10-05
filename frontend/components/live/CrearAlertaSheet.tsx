import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { DragToDismiss } from '@/components/DragToDismiss'
import { useTheme } from '@/components/MeshUI'
import { mensajeErrorBusqueda } from '@/components/route-config/RouteWaypointRow'
import {
  MENSAJE_PREDETERMINADO,
  TIPOS_ALERTA,
  type TipoAlertaApi,
} from '@/lib/alertasApi'
import { buscarLugares, type LugarHit } from '@/lib/nominatim'

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
  const [nombreUbicacion, setNombreUbicacion] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [hits, setHits] = useState<LugarHit[]>([])
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const tipoAnterior = useRef(tipo)
  const theme = useTheme()
  const styles = useMemo(() => crearEstilos(theme), [theme])

  const limpiarBusqueda = () => {
    setBusqueda('')
    setBusquedaDebounced('')
    setHits([])
    setErrorBusqueda(null)
  }

  const quitarUbicacion = () => {
    setUbicacion(null)
    setNombreUbicacion(null)
  }

  useEffect(() => {
    if (!visible) return
    setTipo('informacion')
    setMensaje(MENSAJE_PREDETERMINADO.informacion)
    setMensajeEditado(false)
    quitarUbicacion()
    limpiarBusqueda()
    tipoAnterior.current = 'informacion'
  }, [visible])

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda.trim()), 500)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    let cancel = false
    async function run() {
      if (busquedaDebounced.length < 3) {
        setHits([])
        setErrorBusqueda(null)
        return
      }
      setBuscando(true)
      setErrorBusqueda(null)
      try {
        const r = await buscarLugares(busquedaDebounced)
        if (!cancel) setHits(r)
      } catch (e) {
        if (!cancel) {
          setHits([])
          setErrorBusqueda(mensajeErrorBusqueda(e))
        }
      } finally {
        if (!cancel) setBuscando(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [busquedaDebounced])

  const elegirHit = (hit: LugarHit) => {
    if (Number.isNaN(hit.lat) || Number.isNaN(hit.lng)) return
    setUbicacion({ lat: hit.lat, lng: hit.lng })
    setNombreUbicacion(hit.nombre)
    limpiarBusqueda()
    Keyboard.dismiss()
  }

  const cerrar = () => {
    setMensaje(MENSAJE_PREDETERMINADO.informacion)
    setMensajeEditado(false)
    setTipo('informacion')
    quitarUbicacion()
    limpiarBusqueda()
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
    limpiarBusqueda()
  }

  return (
    <>
      <Modal visible={visible && !eligiendoMapa} transparent animationType="slide" onRequestClose={cerrar}>
        <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.fondo}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.fondoTap} onPress={cerrar} />
          <DragToDismiss onDismiss={cerrar} style={styles.hoja}>
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
                <TextInput
                  style={styles.inputBusqueda}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Buscar lugar (ej. YPF Ruta 20)"
                  placeholderTextColor={theme.textMute}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  accessibilityLabel="Buscar el lugar donde van a parar"
                />
                {busquedaDebounced.length >= 3 ? (
                  <View style={styles.sugerencias}>
                    {buscando ? (
                      <ActivityIndicator size="small" color={theme.accent} style={styles.sugerenciaInfo} />
                    ) : errorBusqueda ? (
                      <Text style={[styles.sugerenciaInfo, styles.sugerenciaError]}>{errorBusqueda}</Text>
                    ) : hits.length === 0 ? (
                      <Text style={styles.sugerenciaInfo}>Sin resultados. Probá otro texto o el mapa.</Text>
                    ) : (
                      hits.map((hit, i) => (
                        <Pressable
                          key={`${hit.lat},${hit.lng}-${i}`}
                          style={({ pressed }) => [styles.sugerencia, pressed && styles.presionado]}
                          onPress={() => elegirHit(hit)}
                        >
                          <Text style={styles.sugerenciaTxt} numberOfLines={2}>
                            {hit.nombre}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                ) : null}
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
          limpiarBusqueda()
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
  inputBusqueda: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface2,
    paddingHorizontal: 12,
    fontSize: 16,
    color: theme.text,
  },
  sugerencias: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  sugerencia: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  sugerenciaTxt: {
    fontSize: 15,
    color: theme.text,
  },
  sugerenciaInfo: {
    padding: 12,
    fontSize: 14,
    color: theme.textDim,
  },
  sugerenciaError: {
    color: theme.danger,
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
