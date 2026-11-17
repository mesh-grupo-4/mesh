import { Feather } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native'

import { AvisoUbicacion } from '@/components/AvisoUbicacion'
import { Btn, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_VIAJE_PRIVACIDAD } from '@/components/ayuda/contenidoAyuda'
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

type Props = {
  viajeId: string
  /** Pasos del tour de ayuda: solo en la pantalla de privacidad, que tiene su propio "?". */
  conAyuda?: boolean
  /** Cambiarlo vuelve a pedir los datos (pull-to-refresh de la pantalla que lo contiene). */
  claveRecarga?: number
}

/**
 * RN-111/112: interruptor de compartir ubicación en este viaje y registro de
 * quiénes accedieron a la posición propia. Lo usan la pantalla de privacidad y
 * la pestaña Configuración del viaje y de la sala de espera.
 */
export function PrivacidadViajePanel({ viajeId, conAyuda = false, claveRecarga = 0 }: Props) {
  const theme = useTheme()
  const [privacidad, setPrivacidad] = useState<PrivacidadViajeApi | null>(null)
  const [accesos, setAccesos] = useState<AccesoUbicacionApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!viajeId) return
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
  }, [viajeId])

  useEffect(() => {
    void cargar()
  }, [cargar, claveRecarga])

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

  if (cargando && !privacidad) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  const comparte = privacidad?.comparte_ubicacion ?? true
  const efectivo = privacidad?.comparte_efectivo ?? false
  const faltaConsentimiento = privacidad != null && !privacidad.consentimiento_otorgado

  const paso = (i: number, hijo: React.ReactElement) =>
    conAyuda ? <PasoAyuda {...AYUDA_VIAJE_PRIVACIDAD[i]!}>{hijo}</PasoAyuda> : hijo

  return (
    <View style={styles.grupo}>
      {paso(
        0,
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchTexto}>
              <Text style={[styles.switchTitulo, { color: theme.text }]}>Compartir mi ubicación</Text>
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
      )}

      {faltaConsentimiento &&
        paso(
          1,
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
            <Text style={[styles.tituloSeccion, { color: theme.text }]}>Falta tu consentimiento</Text>
            <Text style={[styles.switchSub, { color: theme.textDim, marginBottom: 12 }]}>
              Hasta que lo aceptes, tu posición no se comparte aunque el interruptor esté encendido.
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

      {paso(
        2,
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.tituloSeccion, { color: theme.text }]}>Quiénes vieron tu posición</Text>
          {accesos.length === 0 ? (
            <Text style={[styles.vacio, { color: theme.textMute }]}>
              Todavía nadie accedió a tu posición en este viaje.
            </Text>
          ) : (
            accesos.map((a) => (
              <View key={a.observador_id} style={[styles.acceso, { borderTopColor: theme.border }]}>
                <Feather name="eye" size={16} color={theme.accent} style={styles.accesoIcono} />
                <View style={styles.accesoTexto}>
                  <Text style={[styles.accesoNombre, { color: theme.text }]}>{a.observador_nombre}</Text>
                  <Text style={[styles.accesoDetalle, { color: theme.textDim }]}>
                    Último acceso {fechaAccesible(a.ultima_vez)} · desde {fechaAccesible(a.primera_vez)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  grupo: { gap: 12 },
  cargando: { paddingVertical: 24, alignItems: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTexto: { flex: 1, gap: 4 },
  switchTitulo: { fontSize: 17, fontWeight: '700' },
  switchSub: { fontSize: 14, lineHeight: 20 },
  nota: { flexDirection: 'row', gap: 8, borderRadius: 10, padding: 12, marginTop: 14 },
  notaIcono: { marginTop: 2 },
  notaTexto: { flex: 1, fontSize: 13, lineHeight: 19 },
  tituloSeccion: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  vacio: { fontSize: 14, lineHeight: 20 },
  acceso: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1 },
  accesoIcono: { marginTop: 3 },
  accesoTexto: { flex: 1, gap: 3 },
  accesoNombre: { fontSize: 15, fontWeight: '600' },
  accesoDetalle: { fontSize: 13, lineHeight: 18 },
})
