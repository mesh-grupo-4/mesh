import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useCopilot } from 'react-native-copilot'
import { Feather } from '@expo/vector-icons'

import { RecorridoMapView } from '@/components/RecorridoMapView'
import { StatCard, StatCardRow } from '@/components/StatCard'
import { ActivityTile, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_RECORRIDO_PUBLICADO } from '@/components/ayuda/contenidoAyuda'
import { useAuth } from '@/context/AuthContext'
import { formatDurationHm, formatKm } from '@/lib/format'
import { meshAlert, meshConfirmDestructive, meshError } from '@/lib/meshAlert'
import {
  despublicarRecorrido,
  importarRecorridoPublicado,
  obtenerRecorridoPublicado,
  valorarRecorrido,
  type RecorridoPublicadoDetalleApi,
} from '@/lib/recorridosPublicadosApi'
import { formatearEnArg } from '@/lib/tiempoArg'

const NOMBRE_ACTIVIDAD = {
  moto: 'Moto',
  bici: 'Bici',
  running: 'Running',
  trekking: 'Trekking',
  otro: 'Otro',
} as const

export default function RecorridoPublicadoScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { start } = useCopilot()
  const { backendUserId } = useAuth()
  const params = useLocalSearchParams<{ recorridoId: string | string[] }>()
  const recorridoId = Array.isArray(params.recorridoId) ? params.recorridoId[0] : params.recorridoId

  const [recorrido, setRecorrido] = useState<RecorridoPublicadoDetalleApi | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [despublicando, setDespublicando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [valorando, setValorando] = useState(false)

  useEffect(() => {
    if (!recorridoId) return
    let cancelado = false
    setCargando(true)
    obtenerRecorridoPublicado(recorridoId)
      .then((r) => {
        if (!cancelado) setRecorrido(r)
      })
      .catch((e: unknown) => {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el recorrido.')
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [recorridoId])

  const esMio = recorrido != null && recorrido.autor.id === backendUserId

  // RN-081: el autor despublica en cualquier momento; el recorrido deja de verse para todos.
  const confirmarDespublicar = () => {
    if (!recorrido) return
    meshConfirmDestructive({
      title: 'Despublicar recorrido',
      message: 'Deja de verse en la comunidad. Podés volver a publicarlo desde el resumen del viaje.',
      confirmLabel: 'Despublicar',
      onConfirm: async () => {
        setDespublicando(true)
        try {
          await despublicarRecorrido(recorrido.viaje_id)
          router.back()
        } catch (e) {
          meshError('No se pudo despublicar', e instanceof Error ? e.message : undefined)
        } finally {
          setDespublicando(false)
        }
      },
    })
  }

  // RN-082 / SCRUM-63: se vota una sola vez y no se puede cambiar, así que se confirma
  // antes de enviar (un toque accidental quedaría para siempre).
  const confirmarValoracion = (recomiendo: boolean) => {
    meshAlert(
      recomiendo ? '¿Recomendás este recorrido?' : '¿No recomendás este recorrido?',
      'Tu valoración es definitiva: no se puede cambiar después.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: recomiendo ? 'Recomiendo' : 'No recomiendo',
          onPress: () => void valorar(recomiendo),
        },
      ]
    )
  }

  const valorar = async (recomiendo: boolean) => {
    if (!recorrido) return
    setValorando(true)
    try {
      const valoracion = await valorarRecorrido(recorrido.id, recomiendo)
      setRecorrido((prev) => (prev ? { ...prev, valoracion } : prev))
    } catch (e) {
      meshError('No se pudo valorar', e instanceof Error ? e.message : undefined)
    } finally {
      setValorando(false)
    }
  }

  // RN-084 / SCRUM-62: se guarda como plantilla en "Mis rutas" y se arranca a crear el viaje
  // con el trazado precargado (mismo flujo que una ruta guardada).
  const usarComoBase = async () => {
    if (!recorrido) return
    setImportando(true)
    try {
      const { plantilla } = await importarRecorridoPublicado(recorrido.id)
      router.push({
        pathname: '/viaje/crear',
        params: { plantillaId: plantilla.id, tipoActividad: plantilla.tipo_actividad },
      })
    } catch (e) {
      meshError('No se pudo usar el recorrido', e instanceof Error ? e.message : undefined)
    } finally {
      setImportando(false)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Recorrido"
        onBack={() => router.back()}
        bordered={false}
        onAyuda={() => start()}
      />

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : error || !recorrido ? (
        <View style={styles.center}>
          <Text style={[styles.mensaje, { color: theme.danger }]}>
            {error ?? 'Este recorrido ya no está disponible.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.inner}>
          <View style={styles.hero}>
            <ActivityTile activity={recorrido.tipo_actividad} size={46} />
            <View style={styles.heroText}>
              <Text style={[styles.titulo, { color: theme.text }]} numberOfLines={2}>
                {recorrido.nombre?.trim() || 'Recorrido sin nombre'}
              </Text>
              <Text style={[styles.sub, { color: theme.textDim }]}>
                {recorrido.autor.nombre} ·{' '}
                {formatearEnArg(recorrido.publicado_at, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          <PasoAyuda {...AYUDA_RECORRIDO_PUBLICADO[0]!}>
            <RecorridoMapView segmentos={recorrido.segmentos} altura={300} />
          </PasoAyuda>

          <PasoAyuda {...AYUDA_RECORRIDO_PUBLICADO[1]!}>
            <StatCardRow>
              <StatCard
                icon="activity"
                value={NOMBRE_ACTIVIDAD[recorrido.tipo_actividad]}
                label="Actividad"
              />
              <StatCard icon="map-pin" value={formatKm(recorrido.distancia_m)} label="Distancia" />
              <StatCard icon="clock" value={formatDurationHm(recorrido.tiempo_seg)} label="Tiempo" />
            </StatCardRow>
          </PasoAyuda>

          <PasoAyuda {...AYUDA_RECORRIDO_PUBLICADO[2]!}>
            <View
              style={[
                styles.valoracionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.valoracionTitulo, { color: theme.text }]}>
                Valoración de la comunidad
              </Text>
              <View style={styles.valoracionResumen}>
                <Text style={[styles.porcentaje, { color: theme.accent }]}>
                  {recorrido.valoracion.porcentaje_recomienda !== null
                    ? `${recorrido.valoracion.porcentaje_recomienda} %`
                    : '—'}
                </Text>
                <Text style={[styles.sub, styles.valoracionDetalle, { color: theme.textDim }]}>
                  {recorrido.valoracion.total === 0
                    ? 'Todavía nadie lo valoró.'
                    : `lo recomienda (${recorrido.valoracion.recomiendan} de ${recorrido.valoracion.total})`}
                </Text>
              </View>

              {esMio ? (
                <Text style={[styles.sub, { color: theme.textMute }]}>
                  No podés valorar tu propio recorrido.
                </Text>
              ) : recorrido.valoracion.mi_valoracion !== null ? (
                <View style={styles.miValoracion}>
                  <Feather
                    name={recorrido.valoracion.mi_valoracion ? 'thumbs-up' : 'thumbs-down'}
                    size={16}
                    color={theme.textDim}
                  />
                  <Text style={[styles.sub, { color: theme.textDim }]}>
                    Ya lo valoraste:{' '}
                    {recorrido.valoracion.mi_valoracion ? 'lo recomendás' : 'no lo recomendás'}.
                  </Text>
                </View>
              ) : (
                <View style={styles.botonesValorar}>
                  <Btn
                    variant="secondary"
                    icon="thumbs-up"
                    loading={valorando}
                    disabled={valorando}
                    onPress={() => confirmarValoracion(true)}
                    style={styles.botonValorar}
                  >
                    Recomiendo
                  </Btn>
                  <Btn
                    variant="outline"
                    icon="thumbs-down"
                    disabled={valorando}
                    onPress={() => confirmarValoracion(false)}
                    style={styles.botonValorar}
                  >
                    No recomiendo
                  </Btn>
                </View>
              )}
            </View>
          </PasoAyuda>

          <PasoAyuda {...AYUDA_RECORRIDO_PUBLICADO[3]!}>
            <Btn
              variant="primary"
              block
              icon="plus"
              loading={importando}
              disabled={importando}
              onPress={() => void usarComoBase()}
            >
              Usar como base de un viaje
            </Btn>
          </PasoAyuda>

          {esMio ? (
            <PasoAyuda {...AYUDA_RECORRIDO_PUBLICADO[4]!}>
              <Btn
                variant="danger-outline"
                block
                icon="eye-off"
                loading={despublicando}
                disabled={despublicando}
                onPress={confirmarDespublicar}
              >
                Despublicar
              </Btn>
            </PasoAyuda>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mensaje: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  inner: { padding: 20, paddingBottom: 40, gap: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroText: { flex: 1, gap: 4 },
  titulo: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13 },
  valoracionCard: { borderWidth: 1.2, borderRadius: 12, padding: 14, gap: 10 },
  valoracionTitulo: { fontSize: 15, fontWeight: '700' },
  valoracionResumen: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  porcentaje: { fontSize: 28, fontWeight: '800' },
  valoracionDetalle: { flex: 1 },
  miValoracion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botonesValorar: { flexDirection: 'row', gap: 10 },
  botonValorar: { flex: 1 },
})
