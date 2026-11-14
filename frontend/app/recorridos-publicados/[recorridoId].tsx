import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Switch, Text, View } from 'react-native'
import { useCopilot } from 'react-native-copilot'
import { Feather } from '@expo/vector-icons'

import { CorazonGuardar } from '@/components/CorazonGuardar'
import { coloresValoracion, nivelValoracion } from '@/components/tabs/coloresValoracion'
import { RecorridoMapView } from '@/components/RecorridoMapView'
import { StatCard, StatCardRow } from '@/components/StatCard'
import { ActivityTile, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda'
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
import { confirmarQuitarGuardada } from '@/lib/rutasGuardadas'
import { formatearEnArg } from '@/lib/tiempoArg'
import { abrirNuevoViaje } from '@/lib/nuevoViaje'

const NOMBRE_ACTIVIDAD = {
  moto: 'Moto',
  auto: 'Auto',
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
  const [importando, setImportando] = useState<'usar' | 'guardar' | null>(null)
  const [guardarChecklist, setGuardarChecklist] = useState(true)
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
  const colorValoracion = recorrido
    ? coloresValoracion(nivelValoracion(recorrido.valoracion), theme).color
    : theme.textMute

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

  // RN-084 / SCRUM-62: se guarda como plantilla en "Mis rutas" (queda con el corazón
  // marcado). "Usar" además arranca a crear el viaje con el trazado precargado.
  const importar = async (accion: 'usar' | 'guardar') => {
    if (!recorrido) return
    setImportando(accion)
    try {
      const { plantilla } = await importarRecorridoPublicado(recorrido.id, {
        guardarChecklist: recorrido.checklist.length > 0 && guardarChecklist,
      })
      setRecorrido((prev) => (prev ? { ...prev, mi_plantilla_id: plantilla.id } : prev))
      if (accion === 'usar') {
        abrirNuevoViaje({ plantillaId: plantilla.id, tipoActividad: plantilla.tipo_actividad })
      }
    } catch (e) {
      meshError(
        accion === 'usar' ? 'No se pudo usar el recorrido' : 'No se pudo guardar la ruta',
        e instanceof Error ? e.message : undefined
      )
    } finally {
      setImportando(null)
    }
  }

  // Corazón: guarda la ruta o, si ya estaba guardada, la quita previa confirmación.
  const alternarGuardado = () => {
    if (!recorrido) return
    if (!recorrido.mi_plantilla_id) {
      void importar('guardar')
      return
    }
    confirmarQuitarGuardada({
      nombre: recorrido.nombre?.trim() || 'Recorrido sin nombre',
      plantillaId: recorrido.mi_plantilla_id,
      onInicio: () => setImportando('guardar'),
      onFin: () => setImportando(null),
      onQuitada: () =>
        setRecorrido((prev) => (prev ? { ...prev, mi_plantilla_id: null } : prev)),
    })
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
        <ScrollViewAyuda contentContainerStyle={styles.inner}>
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
            <CorazonGuardar
              guardada={recorrido.mi_plantilla_id !== null}
              cargando={importando === 'guardar'}
              onPress={alternarGuardado}
            />
          </View>

          {recorrido.comentario ? (
            <View
              style={[
                styles.comentarioCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Feather name="message-circle" size={16} color={theme.textDim} />
              <Text style={[styles.comentario, { color: theme.text }]}>{recorrido.comentario}</Text>
            </View>
          ) : null}

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
                <Text style={[styles.porcentaje, { color: colorValoracion }]}>
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
            <View style={styles.acciones}>
              {recorrido.checklist.length > 0 ? (
                <View
                  style={[
                    styles.valoracionCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.valoracionTitulo, { color: theme.text }]}>
                    Checklist del recorrido
                  </Text>
                  {recorrido.checklist.map((item) => (
                    <View key={item} style={styles.checklistFila}>
                      <Feather name="check" size={14} color={theme.textDim} />
                      <Text style={[styles.sub, styles.flex1, { color: theme.textDim }]}>{item}</Text>
                    </View>
                  ))}
                  <View style={styles.checklistSwitch}>
                    <Text style={[styles.guardarChecklist, { color: theme.text }]}>
                      Guardar también el checklist
                    </Text>
                    <Switch
                      value={guardarChecklist}
                      onValueChange={setGuardarChecklist}
                      trackColor={{ true: theme.accent, false: theme.border }}
                      accessibilityLabel="Guardar también el checklist"
                    />
                  </View>
                </View>
              ) : null}
              <Btn
                variant="primary"
                block
                icon="plus"
                loading={importando === 'usar'}
                disabled={importando !== null}
                onPress={() => void importar('usar')}
              >
                Usar como base de un viaje
              </Btn>
            </View>
          </PasoAyuda>

          {recorrido.foto ? (
            <Image
              source={{ uri: recorrido.foto }}
              style={[styles.foto, { backgroundColor: theme.surface2 }]}
              resizeMode="cover"
              accessibilityLabel="Foto del recorrido"
            />
          ) : null}

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
        </ScrollViewAyuda>
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
  comentarioCard: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 14,
  },
  comentario: { flex: 1, fontSize: 15, lineHeight: 21 },
  foto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  acciones: { gap: 10 },
  flex1: { flex: 1 },
  checklistFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checklistSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  guardarChecklist: { flex: 1, fontSize: 14, fontWeight: '600' },
})
