import { Feather } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvisoUbicacion } from '@/components/AvisoUbicacion'
import { Btn, TopBar, useTheme } from '@/components/MeshUI'
import { meshAlert, meshConfirmDestructive } from '@/lib/meshAlert'
import {
  actualizarMiPrivacidad,
  listarMisAccesosUbicacion,
  obtenerMiPrivacidad,
  type AccesoUbicacionGlobalApi,
  type PrivacidadUsuarioApi,
} from '@/lib/privacidadApi'
import { formatearEnArg } from '@/lib/tiempoArg'

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
 */
export default function PrivacidadScreen() {
  const router = useRouter()
  const theme = useTheme()
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
    (cambio: { comparte_ubicacion_default?: boolean; consentimiento_ubicacion?: boolean }) => {
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
        title="Privacidad y ubicación"
        sub="Quién puede ver dónde estás"
        onBack={() => router.back()}
      />

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void cargar()} tintColor={theme.accent} />
          }
        >
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.tituloSeccion, { color: theme.text }]}>
              Cómo usa Mesh tu ubicación
            </Text>
            <AvisoUbicacion />
          </View>

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
        </ScrollView>
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
})
