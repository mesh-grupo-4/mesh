import { Feather } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useAuth } from '@/context/AuthContext'
import { meshAlert } from '@/lib/meshAlert'
import {
  actualizarPrivacidadViaje,
  listarAccesosUbicacionViaje,
  obtenerPrivacidadViaje,
  registrarConsentimientoUbicacion,
  type AccesoUbicacionApi,
  type PrivacidadViajeApi,
} from '@/lib/privacidadApi'
import { formatearEnArg } from '@/lib/tiempoArg'

/** RN-105: los accesos se muestran en hora argentina, como toda fecha del sistema. */
function fechaAccesible(iso: string): string {
  return formatearEnArg(iso, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * RN-111/112: interruptor de compartir ubicación en este viaje y registro de
 * quiénes accedieron a la posición propia.
 */
export default function PrivacidadViajeScreen() {
  const router = useRouter()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { backendUserId } = useAuth()
  const params = useLocalSearchParams<{ viajeId: string | string[] }>()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const [privacidad, setPrivacidad] = useState<PrivacidadViajeApi | null>(null)
  const [accesos, setAccesos] = useState<AccesoUbicacionApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!viajeId || !backendUserId) return
    setCargando(true)
    try {
      const [p, lista] = await Promise.all([
        obtenerPrivacidadViaje(viajeId),
        listarAccesosUbicacionViaje(viajeId),
      ])
      setPrivacidad(p)
      setAccesos(lista)
    } catch (e) {
      meshAlert(
        'No se pudo cargar la privacidad',
        e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
      )
    } finally {
      setCargando(false)
    }
  }, [viajeId, backendUserId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const alternar = useCallback(
    (valor: boolean) => {
      if (!viajeId || guardando) return
      setGuardando(true)
      // Optimista: el interruptor tiene que responder al toque, sobre todo en
      // moto, donde la interacción es de un solo gesto (RN-052).
      setPrivacidad((prev) =>
        prev ? { ...prev, comparte_ubicacion: valor, comparte_efectivo: valor && prev.consentimiento_otorgado } : prev
      )
      void (async () => {
        try {
          setPrivacidad(await actualizarPrivacidadViaje(viajeId, valor))
        } catch (e) {
          await cargar()
          meshAlert(
            'No se pudo cambiar el compartir ubicación',
            e instanceof Error ? e.message : 'Intentá de nuevo.'
          )
        } finally {
          setGuardando(false)
        }
      })()
    },
    [viajeId, guardando, cargar]
  )

  const otorgarConsentimiento = useCallback(() => {
    setGuardando(true)
    void (async () => {
      await registrarConsentimientoUbicacion()
      await cargar()
      setGuardando(false)
    })()
  }, [cargar])

  const comparte = privacidad?.comparte_ubicacion ?? true
  const efectivo = privacidad?.comparte_efectivo ?? false
  const faltaConsentimiento = privacidad != null && !privacidad.consentimiento_otorgado

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Privacidad"
        sub="Quién ve tu ubicación en este viaje"
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
            <View style={styles.switchRow}>
              <View style={styles.switchTexto}>
                <Text style={[styles.switchTitulo, { color: theme.text }]}>
                  Compartir mi ubicación
                </Text>
                <Text style={[styles.switchSub, { color: theme.textDim }]}>
                  {efectivo
                    ? 'El grupo ve tu posición en el mapa del viaje.'
                    : 'Nadie del grupo ve tu posición en este viaje.'}
                </Text>
              </View>
              <Switch
                value={comparte}
                onValueChange={alternar}
                disabled={guardando}
                trackColor={{ true: theme.accent, false: theme.border }}
              />
            </View>

            {!efectivo && (
              <View style={[styles.nota, { backgroundColor: theme.surface2 }]}>
                <Feather name="info" size={15} color={theme.textDim} style={styles.notaIcono} />
                <Text style={[styles.notaTexto, { color: theme.textDim }]}>
                  Tu recorrido se sigue guardando para tus métricas personales, pero el grupo no lo
                  ve. Tampoco se generarán alertas automáticas de desvío ni de posible incidente
                  sobre vos mientras esté apagado.
                </Text>
              </View>
            )}
          </View>

          {faltaConsentimiento && (
            <View
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.accent }]}
            >
              <Text style={[styles.tituloSeccion, { color: theme.text }]}>
                Falta tu consentimiento
              </Text>
              <Text style={[styles.switchSub, { color: theme.textDim, marginBottom: 12 }]}>
                Hasta que lo aceptes, tu posición no se comparte aunque el interruptor esté
                encendido.
              </Text>
              <AvisoUbicacion />
              <Btn
                variant="primary"
                block
                onPress={otorgarConsentimiento}
                disabled={guardando}
                style={{ marginTop: 12 }}
              >
                Acepto compartir mi ubicación
              </Btn>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.tituloSeccion, { color: theme.text }]}>
              Quiénes vieron tu posición
            </Text>
            {accesos.length === 0 ? (
              <Text style={[styles.vacio, { color: theme.textMute }]}>
                Todavía nadie accedió a tu posición en este viaje.
              </Text>
            ) : (
              accesos.map((a) => (
                <View
                  key={a.observador_id}
                  style={[styles.acceso, { borderTopColor: theme.border }]}
                >
                  <Feather name="eye" size={16} color={theme.accent} style={styles.accesoIcono} />
                  <View style={styles.accesoTexto}>
                    <Text style={[styles.accesoNombre, { color: theme.text }]}>
                      {a.observador_nombre}
                    </Text>
                    <Text style={[styles.accesoDetalle, { color: theme.textDim }]}>
                      Último acceso {fechaAccesible(a.ultima_vez)} · desde{' '}
                      {fechaAccesible(a.primera_vez)}
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchTexto: { flex: 1, gap: 4 },
  switchTitulo: { fontSize: 17, fontWeight: '700' },
  switchSub: { fontSize: 14, lineHeight: 20 },
  nota: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  notaIcono: { marginTop: 2 },
  notaTexto: { flex: 1, fontSize: 13, lineHeight: 19 },
  tituloSeccion: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  vacio: { fontSize: 14, lineHeight: 20 },
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
