import { Feather } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useCopilot } from 'react-native-copilot'
import { AvisoUbicacion } from '@/components/AvisoUbicacion'
import { Btn, TopBar, useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda'
import { AYUDA_PRIVACIDAD_GLOBAL } from '@/components/ayuda/contenidoAyuda'
import { meshAlert, meshConfirmDestructive } from '@/lib/meshAlert'
import {
  actualizarMiPrivacidad,
  listarMisAccesosUbicacion,
  obtenerMiPrivacidad,
  type AccesoUbicacionGlobalApi,
  type PrivacidadUsuarioApi,
  type VisibilidadLogrosApi,
} from '@/lib/privacidadApi'
import { formatearEnArg } from '@/lib/tiempoArg'

/** RN-077: opciones de quién ve estadísticas, racha e insignias en el perfil. */
const OPCIONES_LOGROS: {
  valor: VisibilidadLogrosApi
  titulo: string
  detalle: string
  icono: keyof typeof Feather.glyphMap
}[] = [
  { valor: 'todos', titulo: 'Todos', detalle: 'Cualquier persona de Mesh', icono: 'globe' },
  { valor: 'amigos', titulo: 'Solo amigos', detalle: 'Tus amistades aceptadas', icono: 'users' },
  { valor: 'solo_yo', titulo: 'Solo yo', detalle: 'Nadie más los ve', icono: 'lock' },
]

/** RN-105: toda fecha visible va en hora argentina. */
function fechaCorta(iso: string): string {
  return formatearEnArg(iso, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * RN-110/112/113: consentimiento informado de geolocalización, valor por defecto
 * del compartir y registro de quiénes accedieron a la posición propia.
 * RN-077: quién ve los logros (estadísticas, racha e insignias) del perfil.
 */
export default function PrivacidadScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const insets = useSafeAreaInsets()

  const [privacidad, setPrivacidad] = useState<PrivacidadUsuarioApi | null>(null)
  const [accesos, setAccesos] = useState<AccesoUbicacionGlobalApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [p, lista] = await Promise.all([obtenerMiPrivacidad(), listarMisAccesosUbicacion()])
      setPrivacidad(p)
      setAccesos(lista)
    } catch (e) {
      meshAlert(
        'No se pudo cargar tu privacidad',
        e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardar = useCallback(
    (cambio: {
      comparte_ubicacion_default?: boolean
      consentimiento_ubicacion?: boolean
      visibilidad_logros?: VisibilidadLogrosApi
    }) => {
      if (guardando) return
      setGuardando(true)
      void (async () => {
        try {
          setPrivacidad(await actualizarMiPrivacidad(cambio))
          // Revocar borra las posiciones publicadas; el listado de accesos no
          // cambia, pero sí conviene refrescarlo tras un cambio de consentimiento.
          if (cambio.consentimiento_ubicacion !== undefined) {
            setAccesos(await listarMisAccesosUbicacion())
          }
        } catch (e) {
          meshAlert(
            'No se pudo guardar',
            e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
          )
        } finally {
          setGuardando(false)
        }
      })()
    },
    [guardando]
  )

  const revocar = useCallback(() => {
    meshConfirmDestructive({
      title: 'Revocar consentimiento',
      message:
        'Dejarás de compartir tu ubicación en todos tus viajes, y se borrará tu posición de los mapas donde estuviera visible. Tus recorridos y métricas se conservan.',
      confirmLabel: 'Revocar',
      onConfirm: () => guardar({ consentimiento_ubicacion: false }),
    })
  }, [guardar])

  const otorgado = privacidad?.consentimiento_otorgado ?? false
  const vigente = privacidad?.consentimiento_vigente ?? false

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Privacidad"
        sub="Tu ubicación y quién ve tus logros"
        onBack={() => router.back()}
        onAyuda={() => start()}
      />

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <ScrollViewAyuda
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void cargar()} tintColor={theme.accent} />
          }
        >
          <PasoAyuda {...AYUDA_PRIVACIDAD_GLOBAL[0]!}>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.tituloSeccion, { color: theme.text }]}>
                Cómo usa Mesh tu ubicación
              </Text>
              <AvisoUbicacion />
            </View>
          </PasoAyuda>

          <PasoAyuda {...AYUDA_PRIVACIDAD_GLOBAL[1]!}>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: vigente ? theme.border : theme.accent },
              ]}
            >
              <Text style={[styles.tituloSeccion, { color: theme.text }]}>Consentimiento</Text>
              {otorgado && vigente ? (
                <>
                  <View style={styles.estadoRow}>
                    <Feather name="check-circle" size={16} color={theme.accent} />
                    <Text style={[styles.estadoTexto, { color: theme.textDim }]}>
                      Otorgado el {fechaCorta(privacidad!.consentimiento_at!)}
                    </Text>
                  </View>
                  <Btn
                    variant="danger-outline"
                    block
                    onPress={revocar}
                    disabled={guardando}
                    icon="slash"
                    style={{ marginTop: 12 }}
                  >
                    Revocar consentimiento
                  </Btn>
                </>
              ) : (
                <>
                  <Text style={[styles.estadoTexto, { color: theme.textDim, marginBottom: 12 }]}>
                    {otorgado
                      ? 'Actualizamos cómo explicamos el uso de tu ubicación. Volvé a aceptarlo para seguir compartiéndola.'
                      : 'Sin tu consentimiento, tu posición no se comparte con ningún grupo.'}
                  </Text>
                  <Btn
                    variant="primary"
                    block
                    onPress={() => guardar({ consentimiento_ubicacion: true })}
                    disabled={guardando}
                  >
                    Acepto compartir mi ubicación
                  </Btn>
                </>
              )}
            </View>
          </PasoAyuda>

          <PasoAyuda {...AYUDA_PRIVACIDAD_GLOBAL[2]!}>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.switchRow}>
                <View style={styles.switchTexto}>
                  <Text style={[styles.switchTitulo, { color: theme.text }]}>
                    Compartir en viajes nuevos
                  </Text>
                  <Text style={[styles.estadoTexto, { color: theme.textDim }]}>
                    Valor con el que arranca cada viaje. Podés cambiarlo viaje por viaje desde su
                    pantalla de privacidad.
                  </Text>
                </View>
                <Switch
                  value={privacidad?.comparte_ubicacion_default ?? true}
                  onValueChange={(v) => guardar({ comparte_ubicacion_default: v })}
                  disabled={guardando}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              </View>
            </View>
          </PasoAyuda>

          <PasoAyuda {...AYUDA_PRIVACIDAD_GLOBAL[4]!}>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.tituloSeccion, { color: theme.text, marginBottom: 4 }]}>
                Quién ve tus logros
              </Text>
              <Text style={[styles.estadoTexto, { color: theme.textDim, marginBottom: 10 }]}>
                Tus estadísticas, racha e insignias en tu perfil. Tu nombre y el botón para
                mandarte una solicitud de amistad se ven siempre.
              </Text>
              {OPCIONES_LOGROS.map((op) => {
                const elegida = (privacidad?.visibilidad_logros ?? 'todos') === op.valor
                return (
                  <Pressable
                    key={op.valor}
                    onPress={() => {
                      if (!elegida) guardar({ visibilidad_logros: op.valor })
                    }}
                    disabled={guardando}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: elegida, disabled: guardando }}
                    style={[
                      styles.opcion,
                      {
                        borderColor: elegida ? theme.accent : theme.border,
                        backgroundColor: elegida ? theme.accentWeak : 'transparent',
                      },
                    ]}
                  >
                    <Feather name={op.icono} size={18} color={elegida ? theme.accent : theme.textDim} />
                    <View style={styles.opcionTexto}>
                      <Text style={[styles.opcionTitulo, { color: theme.text }]}>{op.titulo}</Text>
                      <Text style={[styles.opcionDetalle, { color: theme.textDim }]}>{op.detalle}</Text>
                    </View>
                    <Feather
                      name={elegida ? 'check-circle' : 'circle'}
                      size={20}
                      color={elegida ? theme.accent : theme.textMute}
                    />
                  </Pressable>
                )
              })}
            </View>
          </PasoAyuda>

          <PasoAyuda {...AYUDA_PRIVACIDAD_GLOBAL[3]!}>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.tituloSeccion, { color: theme.text }]}>
                Quiénes vieron tu posición
              </Text>
              {accesos.length === 0 ? (
                <Text style={[styles.estadoTexto, { color: theme.textMute }]}>
                  Todavía nadie accedió a tu posición.
                </Text>
              ) : (
                accesos.map((a) => (
                  <View
                    key={`${a.viaje_id}:${a.observador_id}`}
                    style={[styles.acceso, { borderTopColor: theme.border }]}
                  >
                    <Feather name="eye" size={16} color={theme.accent} style={styles.accesoIcono} />
                    <View style={styles.accesoTexto}>
                      <Text style={[styles.accesoNombre, { color: theme.text }]}>
                        {a.observador_nombre}
                      </Text>
                      <Text style={[styles.accesoDetalle, { color: theme.textDim }]}>
                        {a.viaje_nombre || 'Viaje sin nombre'} · último acceso{' '}
                        {fechaCorta(a.ultima_vez)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </PasoAyuda>
        </ScrollViewAyuda>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  tituloSeccion: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  estadoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  estadoTexto: { fontSize: 14, lineHeight: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTexto: { flex: 1, gap: 4 },
  switchTitulo: { fontSize: 16, fontWeight: '700' },
  acceso: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  accesoIcono: { marginTop: 3 },
  accesoTexto: { flex: 1, gap: 3 },
  accesoNombre: { fontSize: 15, fontWeight: '600' },
  accesoDetalle: { fontSize: 13, lineHeight: 18 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 8,
  },
  opcionTexto: { flex: 1, gap: 2 },
  opcionTitulo: { fontSize: 15.5, fontWeight: '700' },
  opcionDetalle: { fontSize: 13 },
})
