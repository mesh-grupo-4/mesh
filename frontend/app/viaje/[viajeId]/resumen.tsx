import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { Pressable } from '@/components/Pressable'

import { useCopilot } from 'react-native-copilot'
import { AvatarFallback } from '@/components/AvatarFallback'
import { HojaInferior } from '@/components/HojaInferior'
import { FilaOpcion } from '@/components/perfil/FilaOpcion'
import { RecorridoMapView } from '@/components/RecorridoMapView'
import { ActivityTile, Badge, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda'
import { AYUDA_VIAJE_RESUMEN } from '@/components/ayuda/contenidoAyuda'
import { GastosCierrePanel } from '@/components/gastos/GastosCierrePanel'
import { ParametrosGrupoCard } from '@/components/ParametrosGrupoCard'
import { ParadasResumen } from '@/components/resumen/ParadasResumen'
import { SegmentTabs } from '@/components/SegmentTabs'
import { StatCard, StatCardRow } from '@/components/StatCard'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import {
  formatDurationHm,
  formatHoraCorta,
  formatKm,
  formatMetros,
  formatPace,
  formatSpeedKmh,
} from '@/lib/format'
import {
  elegirFoto,
  PermisoFotoDenegado,
  subirFotoRecorrido,
  type OrigenFoto,
} from '@/lib/fotoPerfil'
import { meshAlert, meshError } from '@/lib/meshAlert'
import { esMotorizado } from '@/lib/activityDefaults'
import { MeshApiError } from '@/lib/apiClient'
import { listarChecklist } from '@/lib/checklistApi'
import { ETIQUETA_MODO, TONO_MODO } from '@/lib/modoViaje'
import { nombreCompleto } from '@/lib/nombres'
import { abrirRepetirEntrenamiento } from '@/lib/nuevoViaje'
import { compartirRutaViaje, revocarCompartirRutaViaje } from '@/lib/rutasCompartidasApi'
import { formatearEnArg } from '@/lib/tiempoArg'
import {
  despublicarRecorrido,
  listarMisViajesPublicados,
  FOTOS_RECORRIDO_MAX,
  publicarRecorrido,
} from '@/lib/recorridosPublicadosApi'
import { clearTripMetrics, loadTripMetrics } from '@/lib/tripMetricsStore'
import {
  listarParticipantesViaje,
  obtenerMetricasGrupales,
  obtenerRecorrido,
  obtenerResumenViaje,
  obtenerViaje,
  type MetricaIntegranteApi,
  type MetricasGrupalesApi,
  type ResumenViajeApi,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
} from '@/lib/viajesApi'

type Pestania = 'resumen' | 'gastos' | 'configuracion'

/** Una fila de "El grupo": métricas (si las hay) + estado de participación. */
type FilaGrupo = {
  usuarioId: string
  nombre: string
  metrica: MetricaIntegranteApi | null
  estado: ViajeParticipanteApi['estado'] | null
  esLider: boolean
}

/** Con el viaje terminado, "Confirmó" no aporta: solo se marca lo que se sale de lo normal. */
function badgeFila(fila: FilaGrupo): { texto: string; tone: 'mute' | 'live' | 'accent' } | null {
  switch (fila.estado) {
    case 'salido':
      return { texto: 'Salió', tone: 'mute' }
    // RN-029c: confirmó pero no fue.
    case 'ausente':
      return { texto: 'No fue', tone: 'mute' }
    case 'rechazado':
      return { texto: 'Rechazó', tone: 'live' }
    case 'pendiente':
      return { texto: 'Pendiente', tone: 'mute' }
  }
  return fila.esLider ? { texto: 'Líder', tone: 'accent' } : null
}

/** No participaron del viaje: van al final de la lista y atenuados. */
function noParticipo(estado: FilaGrupo['estado']): boolean {
  return estado === 'ausente' || estado === 'rechazado' || estado === 'pendiente'
}

/** Mismo tope que valida el backend para la nota del autor. */
const COMENTARIO_MAX = 280
/** La hoja inferior tiene que terminar de cerrarse antes de abrir la galería o la cámara. */
const CIERRE_HOJA_MS = 400

export default function ViajeResumenScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const insets = useSafeAreaInsets()
  const { backendUserId } = useAuth()
  const params = useLocalSearchParams<{
    viajeId: string | string[]
    userId?: string | string[]
    /** '1' = se llegó justo al finalizar el viaje: "atrás" lleva al inicio. */
    desdeCierre?: string | string[]
  }>()
  const desdeCierre = (Array.isArray(params.desdeCierre) ? params.desdeCierre[0] : params.desdeCierre) === '1'

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userId = useMemo(() => {
    const u = params.userId
    const raw = Array.isArray(u) ? u[0] : u
    return raw?.trim() || backendUserId || DEV_USER_ID || ''
  }, [params.userId, backendUserId])

  const [resumen, setResumen] = useState<ResumenViajeApi | null>(null)
  const [grupales, setGrupales] = useState<MetricasGrupalesApi | null>(null)
  const [distanciaLocalM, setDistanciaLocalM] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // US2: traza GPS realmente recorrida. Se carga aparte del resumen para que un
  // viaje sin GPS no demore ni rompa el resto de la pantalla.
  const [recorrido, setRecorrido] = useState<[number, number][][]>([])
  const [cargandoRecorrido, setCargandoRecorrido] = useState(true)
  // E10 / RN-081: estado de publicación del recorrido propio en la comunidad.
  // `null` mientras se consulta.
  const [publicado, setPublicado] = useState<boolean | null>(null)
  const [publicando, setPublicando] = useState(false)
  const [comentario, setComentario] = useState('')
  const [compartirChecklist, setCompartirChecklist] = useState(false)
  const [itemsChecklist, setItemsChecklist] = useState(0)
  // Fotos opcionales del recorrido (RN-081), en el orden del carrusel: la primera es la
  // portada. Quedan locales hasta que se toca "Publicar".
  const [fotosUri, setFotosUri] = useState<string[]>([])
  const [hojaFoto, setHojaFoto] = useState(false)
  const [pestania, setPestania] = useState<Pestania>('resumen')
  // Detalle del viaje (modo, parámetros, ruta, líder) y participantes con su estado.
  const [viaje, setViaje] = useState<ViajeDetalleApi | null>(null)
  const [participantes, setParticipantes] = useState<ViajeParticipanteApi[]>([])
  const [accionRuta, setAccionRuta] = useState(false)
  /** Gastos cargados según el panel: decide si el botón de la barra edita o agrega. */
  const [cantidadGastos, setCantidadGastos] = useState<number | null>(null)
  // Solo se publica el recorrido propio: si se abrió el resumen de otro usuario
  // (`?userId=`), la tarjeta no aparece. El backend igual publica solo lo de quien llama.
  const esPropio = !params.userId || userId === backendUserId

  const cargar = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await obtenerResumenViaje(viajeId, userId)
      setResumen(r)
      if (r.mis_metricas.distancia_m != null) {
        void clearTripMetrics(viajeId, userId)
      }
      if (r.viaje.es_grupal) {
        try {
          const g = await obtenerMetricasGrupales(viajeId, userId)
          setGrupales(g)
        } catch {
          // Las métricas grupales son adicionales; si fallan, seguimos mostrando el resumen.
        }
      }
    } catch (e) {
      const local = await loadTripMetrics(viajeId, userId)
      setDistanciaLocalM(local.distanceM > 0 ? local.distanceM : null)
      setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen')
    } finally {
      setLoading(false)
    }
  }, [viajeId, userId])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return
    let cancelado = false
    setCargandoRecorrido(true)
    void obtenerRecorrido(viajeId)
      .then((r) => {
        if (!cancelado) setRecorrido(r.segmentos)
      })
      .catch(() => {
        if (!cancelado) setRecorrido([])
      })
      .finally(() => {
        if (!cancelado) setCargandoRecorrido(false)
      })
    return () => {
      cancelado = true
    }
  }, [viajeId, userId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Aparte del resumen: si falla, el resumen se sigue viendo sin estos agregados.
  useEffect(() => {
    if (!viajeId || !userId.trim()) return
    let cancelado = false
    void obtenerViaje(viajeId, userId)
      .then((v) => {
        if (!cancelado) setViaje(v)
      })
      .catch(() => {
        if (!cancelado) setViaje(null)
      })
    void listarParticipantesViaje(viajeId, userId)
      .then((p) => {
        if (!cancelado) setParticipantes(p)
      })
      .catch(() => {
        if (!cancelado) setParticipantes([])
      })
    return () => {
      cancelado = true
    }
  }, [viajeId, userId])

  useEffect(() => {
    if (!viajeId || !esPropio) return
    let cancelado = false
    void listarMisViajesPublicados()
      .then((ids) => {
        if (!cancelado) setPublicado(ids.includes(viajeId))
      })
      .catch(() => {
        // Publicar es idempotente: ante la duda se ofrece publicar.
        if (!cancelado) setPublicado(false)
      })
    return () => {
      cancelado = true
    }
  }, [viajeId, esPropio])

  useEffect(() => {
    if (!viajeId || !esPropio) return
    let cancelado = false
    void listarChecklist(viajeId)
      .then((items) => {
        if (!cancelado) setItemsChecklist(items.length)
      })
      .catch(() => {
        // Sin checklist legible no se ofrece compartirlo; publicar sigue disponible.
        if (!cancelado) setItemsChecklist(0)
      })
    return () => {
      cancelado = true
    }
  }, [viajeId, esPropio])

  const elegirFotoRecorrido = (origen: OrigenFoto) => {
    setHojaFoto(false)
    setTimeout(async () => {
      try {
        const uri = await elegirFoto(origen, 'recorrido')
        if (uri) setFotosUri((prev) => [...prev, uri].slice(0, FOTOS_RECORRIDO_MAX))
      } catch (e) {
        if (e instanceof PermisoFotoDenegado) {
          meshAlert(
            'Permiso necesario',
            origen === 'camara'
              ? 'Habilitá el acceso a la cámara desde los ajustes del teléfono para sacar una foto.'
              : 'Habilitá el acceso a tus fotos desde los ajustes del teléfono para elegir una.'
          )
        } else {
          meshAlert('Error', 'No se pudo abrir la imagen. Probá con otra.')
        }
      }
    }, CIERRE_HOJA_MS)
  }

  const alternarPublicacion = async () => {
    if (!viajeId || publicado === null) return
    setPublicando(true)
    try {
      if (publicado) {
        await despublicarRecorrido(viajeId)
        setPublicado(false)
      } else {
        // Las fotos se suben primero, de a una y en orden; el backend las verifica al publicar.
        const fotoPaths: string[] = []
        for (const uri of fotosUri) {
          fotoPaths.push(await subirFotoRecorrido(viajeId, uri))
        }
        await publicarRecorrido(viajeId, {
          comentario: comentario.trim() || undefined,
          compartirChecklist: itemsChecklist > 0 && compartirChecklist,
          fotoPaths,
        })
        setPublicado(true)
      }
    } catch (e) {
      meshError(
        publicado ? 'No se pudo despublicar' : 'No se pudo publicar',
        e instanceof Error ? e.message : 'Probá de nuevo en un rato.'
      )
    } finally {
      setPublicando(false)
    }
  }

  const volverAlInicio = () => router.replace('/(tabs)')
  // Desde una lista se vuelve a la lista; recién cerrado el viaje, al inicio.
  const volver = () => {
    if (desdeCierre || !router.canGoBack()) volverAlInicio()
    else router.back()
  }

  const compartirRuta = async () => {
    if (!viajeId || !userId) return
    setAccionRuta(true)
    try {
      const out = await compartirRutaViaje(viajeId, userId)
      await Share.share(
        Platform.OS === 'ios'
          ? { url: out.link, message: 'Te comparto una ruta de Mesh' }
          : { message: `Te comparto una ruta de Mesh: ${out.link}` }
      )
    } catch (e) {
      const msg =
        e instanceof MeshApiError && e.code === 'RUTA_INCOMPLETA'
          ? 'Configurá la ruta completa antes de compartirla.'
          : e instanceof Error
            ? e.message
            : 'No se pudo compartir la ruta'
      meshAlert('Error', msg)
    } finally {
      setAccionRuta(false)
    }
  }

  const revocarLinkRuta = () => {
    if (!viajeId || !userId) return
    meshAlert('Revocar link', '¿Quienes tengan el link ya no podrán ver ni importar esta ruta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revocar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setAccionRuta(true)
            try {
              await revocarCompartirRutaViaje(viajeId, userId)
            } catch (e) {
              meshAlert('Error', e instanceof Error ? e.message : 'No se pudo revocar')
            } finally {
              setAccionRuta(false)
            }
          })()
        },
      },
    ])
  }

  // "El grupo": primero quienes tienen métricas (en el orden del backend), después el
  // resto de los participantes; los que no fueron, rechazaron o no respondieron, al final.
  const filasGrupo = useMemo<FilaGrupo[]>(() => {
    const liderId = viaje?.creador_id
    const porId = new Map(participantes.map((p) => [p.usuario.id, p]))
    const conMetricas: FilaGrupo[] = (grupales?.por_integrante ?? []).map((m) => ({
      usuarioId: m.usuario_id,
      nombre: m.nombre,
      metrica: m,
      estado: porId.get(m.usuario_id)?.estado ?? null,
      esLider: m.usuario_id === liderId,
    }))
    const listados = new Set(conMetricas.map((f) => f.usuarioId))
    const resto: FilaGrupo[] = participantes
      .filter((p) => !listados.has(p.usuario.id))
      .map((p) => ({
        usuarioId: p.usuario.id,
        nombre: nombreCompleto(p.usuario.nombre, p.usuario.apellido),
        metrica: null,
        estado: p.estado,
        esLider: p.usuario.id === liderId,
      }))
      .sort((a, b) => Number(noParticipo(a.estado)) - Number(noParticipo(b.estado)))
    return [...conMetricas, ...resto]
  }, [grupales, participantes, viaje?.creador_id])

  if (!viajeId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar title="Resumen" onBack={volver} bordered={false} />
        <View style={styles.center}>
          <Text style={{ color: theme.textDim }}>Viaje no especificado.</Text>
        </View>
      </View>
    )
  }

  const esGrupal = resumen?.viaje.es_grupal ?? false
  const esMoto = esMotorizado(resumen?.viaje.tipo_actividad)
  const totales = resumen?.totales
  const mias = resumen?.mis_metricas
  // Sin fila en metrica_viaje: el GPS no registró un desplazamiento real.
  const sinMovimiento = mias?.distancia_m == null
  // Mismas condiciones que valida el backend (RECORRIDO_SIN_TRAZA): métricas propias y
  // al menos dos puntos de traza.
  const puedePublicar =
    esPropio && mias?.distancia_m != null && recorrido.reduce((n, t) => n + t.length, 0) >= 2

  const esLider = viaje != null && viaje.creador_id === backendUserId
  // Mismas condiciones que en el detalle del viaje: líder o confirmado, con ruta cargada.
  const puedeCompartirRuta =
    esPropio && !!viaje?.ruta && (esLider || viaje.mi_participacion?.estado === 'confirmado')
  // RN-066 (y RN-070): solo entrenamientos no motorizados.
  const puedeRepetir =
    esPropio && viaje?.modo === 'entrenamiento' && !esMotorizado(viaje.tipo_actividad)

  // Cuándo fue, con las horas reales de inicio y fin (RN-105: siempre en hora argentina).
  const fechaViaje = (() => {
    const inicio = resumen?.viaje.fecha_inicio_real
    if (!inicio) return null
    const opcionesDia = { weekday: 'short', day: 'numeric', month: 'short' } as const
    const dia = formatearEnArg(inicio, opcionesDia)
    const fin = resumen?.viaje.fecha_fin_real
    if (!fin) return `${dia} · ${formatHoraCorta(inicio)}`
    const diaFin = formatearEnArg(fin, opcionesDia)
    const hastaFin = diaFin === dia ? formatHoraCorta(fin) : `${diaFin} ${formatHoraCorta(fin)}`
    return `${dia} · ${formatHoraCorta(inicio)} a ${hastaFin}`
  })()

  // Privacidad y compartir ruta: en la pestaña Configuración (grupal) o al final del resumen.
  const accionesViaje = esPropio ? (
    <View style={styles.acciones}>
      {/* RN-111/112: el registro de quién vio tu posición se consulta también después del viaje. */}
      <Btn
        variant="secondary"
        block
        size="sm"
        icon="shield"
        onPress={() => router.push({ pathname: '/viaje/[viajeId]/privacidad', params: { viajeId } })}
      >
        Privacidad y ubicación
      </Btn>
      {puedeCompartirRuta ? (
        <>
          <Btn
            variant="secondary"
            block
            size="sm"
            icon="map"
            onPress={() => void compartirRuta()}
            disabled={accionRuta}
            loading={accionRuta}
          >
            Compartir ruta
          </Btn>
          {esLider ? (
            <Btn variant="ghost" block size="sm" icon="x-circle" onPress={revocarLinkRuta} disabled={accionRuta}>
              Revocar link de ruta
            </Btn>
          ) : null}
        </>
      ) : null}
    </View>
  ) : null

  const comparativa = (() => {
    if (!totales?.distancia_planeada_m || totales.distancia_real_m == null) return null
    const delta =
      ((totales.distancia_real_m - totales.distancia_planeada_m) / totales.distancia_planeada_m) *
      100
    const signo = delta >= 0 ? '+' : ''
    return `Planeado ${formatKm(totales.distancia_planeada_m)} · Real ${formatKm(
      totales.distancia_real_m
    )} (${signo}${delta.toFixed(1).replace('.', ',')} %)`
  })()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Resumen"
        sub={resumen ? (esGrupal ? 'Salida grupal' : 'Salida individual') : 'Cargando...'}
        onBack={volver}
        bordered={false}
        // El tour recorre la pestaña de resumen: desde las otras no tendría a qué apuntar.
        onAyuda={pestania === 'resumen' ? () => start() : undefined}
        right={
          pestania === 'gastos' && cantidadGastos != null ? (
            // Lápiz en un círculo, como en el resto de la app; "+" si todavía no hay gastos.
            <Pressable
              onPress={() => router.push({ pathname: '/viaje/[viajeId]/gastos', params: { viajeId } })}
              accessibilityRole="button"
              accessibilityLabel={cantidadGastos > 0 ? 'Agregar o editar gastos' : 'Agregar un gasto'}
              hitSlop={8}
              style={({ pressed }) => [
                styles.botonCirculo,
                { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
              ]}
            >
              <Feather name={cantidadGastos > 0 ? 'edit-2' : 'plus'} size={19} color={theme.text} />
            </Pressable>
          ) : undefined
        }
      />

      {esGrupal ? (
        <SegmentTabs
          tabs={[
            { key: 'resumen', label: 'Resumen' },
            { key: 'gastos', label: 'Gastos' },
            { key: 'configuracion', label: 'Configuración' },
          ]}
          active={pestania}
          onChange={(key) => setPestania(key as Pestania)}
          theme={theme}
          style={styles.tabs}
        />
      ) : null}

      {pestania === 'gastos' ? (
        <GastosCierrePanel viajeId={viajeId} onCantidad={setCantidadGastos} />
      ) : null}

      {pestania === 'configuracion' ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          {viaje ? (
            // SCRUM-26 / RN-025: cómo estaba configurado el grupo; con el viaje cerrado no se edita.
            <ParametrosGrupoCard
              viaje={viaje}
              editable={false}
              guardando={false}
              onGuardar={() => {}}
              inicialAbierto
            />
          ) : (
            <ActivityIndicator color={theme.accent} />
          )}
          {accionesViaje}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : (
        // Oculta en vez de desmontada: así el mapa no se recarga en cada cambio de pestaña.
        <View style={[styles.container, pestania !== 'resumen' && styles.oculta]}>
        <ScrollViewAyuda
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {resumen ? (
            <View style={styles.hero}>
              <ActivityTile activity={resumen.viaje.tipo_actividad} size={46} />
              <View style={styles.heroText}>
                <Text style={[styles.tripName, { color: theme.text }]} numberOfLines={2}>
                  {resumen.viaje.nombre?.trim() || (esGrupal ? 'Salida grupal' : 'Salida individual')}
                </Text>
                <View style={styles.badgeRow}>
                  <Badge tone="mute">Finalizado</Badge>
                  {viaje ? <Badge tone={TONO_MODO[viaje.modo]}>{ETIQUETA_MODO[viaje.modo]}</Badge> : null}
                </View>
                {fechaViaje ? (
                  <Text style={[styles.fechaViaje, { color: theme.textDim }]}>{fechaViaje}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {error ? (
            <View
              style={[
                styles.warnCard,
                { backgroundColor: theme.dangerWeak, borderColor: theme.danger },
              ]}
            >
              <Text style={[styles.warnText, { color: theme.text }]}>
                {distanciaLocalM != null
                  ? `No pudimos traer el resumen del servidor. Estos son datos provisionales de tu dispositivo: ${formatKm(distanciaLocalM)} recorridos.`
                  : `No pudimos cargar el resumen. ${error}`}
              </Text>
              <Btn variant="outline" size="sm" icon="refresh-cw" onPress={() => void cargar()}>
                Reintentar
              </Btn>
            </View>
          ) : null}

          {/* ── Mapa del recorrido realizado (US2) ── */}
          <PasoAyuda {...AYUDA_VIAJE_RESUMEN[0]!}>
            <RecorridoMapView
              segmentos={recorrido}
              cargando={cargandoRecorrido}
              onExpandir={() =>
                router.push({ pathname: '/viaje/[viajeId]/recorrido', params: { viajeId } })
              }
            />
          </PasoAyuda>

          {/* ── El viaje (totales grupales) ── */}
          {totales ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>El viaje</Text>
              <PasoAyuda {...AYUDA_VIAJE_RESUMEN[1]!}>
                <StatCardRow>
                  <StatCard
                    icon="clock"
                    value={formatDurationHm(totales.duracion_segundos)}
                    label="Duración"
                  />
                  <StatCard
                    icon="activity"
                    value={formatKm(totales.distancia_real_m)}
                    label="Recorrido"
                  />
                  {esGrupal ? (
                    <StatCard
                      icon="users"
                      value={String(totales.cantidad_integrantes)}
                      label="Integrantes"
                    />
                  ) : (
                    <StatCard
                      icon="map"
                      value={formatKm(totales.distancia_planeada_m)}
                      label="Planeado"
                    />
                  )}
                </StatCardRow>
              </PasoAyuda>

              {comparativa ? (
                <Text style={[styles.comparativa, { color: theme.textDim }]}>{comparativa}</Text>
              ) : null}
            </>
          ) : null}

          {/* ── Paradas (solo si las hubo) ── */}
          {resumen ? <ParadasResumen paradas={resumen.paradas} esGrupal={esGrupal} /> : null}

          {/* ── Tu recorrido (métricas individuales) ── */}
          {mias ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>Tu recorrido</Text>
              {sinMovimiento ? (
                <Text style={[styles.nota, { color: theme.textDim }]}>
                  No registramos movimiento tuyo en este viaje, así que no hay distancia, ritmo ni
                  velocidad para mostrar.
                </Text>
              ) : (
              <>
              <StatCardRow>
                <StatCard icon="map-pin" value={formatKm(mias.distancia_m)} label="Tu distancia" />
                <StatCard
                  icon="trending-up"
                  value={formatSpeedKmh(mias.velocidad_promedio_kmh)}
                  label={esMoto ? 'Ritmo promedio' : 'Vel. promedio'}
                  hint={esMoto ? 'Dato informativo, no comparativo' : undefined}
                />
                {!esMoto ? (
                  <StatCard
                    icon="zap"
                    value={formatSpeedKmh(mias.velocidad_maxima_kmh)}
                    label="Vel. máxima"
                  />
                ) : null}
              </StatCardRow>

              {!esMoto ? (
                <StatCardRow>
                  <StatCard
                    icon="watch"
                    value={formatPace(mias.tiempo_movimiento_seg, mias.distancia_m)}
                    label="Ritmo"
                  />
                  <StatCard
                    icon="pause-circle"
                    value={formatDurationHm(
                      totales?.duracion_segundos != null && mias.tiempo_movimiento_seg != null
                        ? Math.max(0, totales.duracion_segundos - mias.tiempo_movimiento_seg)
                        : null
                    )}
                    label="Tiempo detenido"
                  />
                </StatCardRow>
              ) : null}

              {/* Altimetría del GPS del celular. Es un dato del terreno, no de
                  velocidad: se muestra en todas las modalidades (RN-070 no aplica). */}
              {mias.desnivel_positivo_m != null ? (
                <StatCardRow>
                  <StatCard
                    icon="arrow-up-right"
                    value={formatMetros(mias.desnivel_positivo_m)}
                    label="Desnivel +"
                  />
                  <StatCard
                    icon="arrow-down-right"
                    value={formatMetros(mias.desnivel_negativo_m)}
                    label="Desnivel −"
                  />
                  <StatCard
                    icon="triangle"
                    value={formatMetros(mias.altitud_max_m)}
                    label="Altura máx."
                    hint="Aproximada, según el GPS"
                  />
                </StatCardRow>
              ) : null}
              </>
              )}

              {mias.sali_antes ? (
                <Text style={[styles.nota, { color: theme.textDim }]}>
                  Saliste del viaje a las {formatHoraCorta(mias.fecha_salida)}. Estos son tus datos
                  hasta ese momento.
                </Text>
              ) : null}
            </>
          ) : null}

          {/* ── El grupo (métricas por integrante) ── */}
          {esGrupal && filasGrupo.length > 0 ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>El grupo</Text>
              <View
                style={[
                  styles.grupoCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                {filasGrupo.map((fila, idx) => {
                  const esYo = fila.usuarioId === backendUserId
                  return (
                    <View key={fila.usuarioId}>
                      {idx > 0 ? (
                        <View style={[styles.separador, { backgroundColor: theme.border }]} />
                      ) : null}
                      <Pressable
                        disabled={esYo}
                        onPress={() =>
                          router.push({
                            pathname: '/usuario/[usuarioId]',
                            params: { usuarioId: fila.usuarioId },
                          })
                        }
                        style={({ pressed }) => (pressed && !esYo ? { opacity: 0.85 } : undefined)}
                        accessibilityRole={esYo ? 'text' : 'button'}
                      >
                        <IntegranteRow
                          fila={fila}
                          esYo={esYo}
                          rankingHabilitado={grupales?.ranking_habilitado ?? false}
                          tipoActividad={resumen?.viaje.tipo_actividad ?? ''}
                        />
                      </Pressable>
                    </View>
                  )
                })}
              </View>
              <Btn
                variant="secondary"
                block
                size="sm"
                icon="users"
                onPress={() => router.push({ pathname: '/viaje/[viajeId]/miembros', params: { viajeId } })}
              >
                Ver miembros
              </Btn>
            </>
          ) : null}

          {esGrupal && grupales?.ranking_habilitado ? (
            <Btn
              variant="secondary"
              block
              icon="award"
              onPress={() =>
                router.push({ pathname: '/viaje/[viajeId]/recap', params: { viajeId } })
              }
              style={styles.cta}
            >
              Recap del grupo
            </Btn>
          ) : null}

          <PasoAyuda {...AYUDA_VIAJE_RESUMEN[2]!}>
            <Btn
              variant="outline"
              block
              icon="trending-up"
              onPress={() =>
                router.push({ pathname: '/viaje/[viajeId]/metricas', params: { viajeId } })
              }
              style={styles.cta}
            >
              Ver métricas detalladas
            </Btn>
          </PasoAyuda>

          {puedePublicar ? (
            <PasoAyuda {...AYUDA_VIAJE_RESUMEN[3]!}>
              <View
                style={[
                  styles.publicarCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.publicarTitulo, { color: theme.text }]}>
                  Compartir con la comunidad
                </Text>
                <Text style={[styles.nota, { color: theme.textDim }]}>
                  {publicado
                    ? 'Tu recorrido está publicado: cualquiera en Mesh puede verlo y usarlo como base de un viaje.'
                    : 'Publicá tu recorrido para que otros lo vean y lo usen como base de sus viajes. Se comparte tu traza, la distancia y el tiempo; nunca tu velocidad.'}
                </Text>
                {publicado === false ? (
                  <>
                    <TextInput
                      style={[
                        styles.comentarioInput,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder="Sumá un comentario (opcional)"
                      placeholderTextColor={theme.textMute}
                      value={comentario}
                      onChangeText={setComentario}
                      maxLength={COMENTARIO_MAX}
                      multiline
                      accessibilityLabel="Comentario del recorrido"
                    />
                    <Text style={[styles.contador, { color: theme.textMute }]}>
                      {comentario.length}/{COMENTARIO_MAX}
                    </Text>
                    {itemsChecklist > 0 ? (
                      <View style={styles.compartirChecklist}>
                        <Text style={[styles.compartirTexto, { color: theme.text }]}>
                          Compartir también mi checklist ({itemsChecklist}{' '}
                          {itemsChecklist === 1 ? 'ítem' : 'ítems'})
                        </Text>
                        <Switch
                          value={compartirChecklist}
                          onValueChange={setCompartirChecklist}
                          trackColor={{ true: theme.accent, false: theme.border }}
                          accessibilityLabel="Compartir también mi checklist"
                        />
                      </View>
                    ) : null}
                    {fotosUri.length > 0 ? (
                      <View style={styles.fotos}>
                        <Text style={[styles.fotosTitulo, { color: theme.textDim }]}>
                          Fotos · {fotosUri.length} de {FOTOS_RECORRIDO_MAX}
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.fotosFila}
                        >
                          {fotosUri.map((uri, i) => (
                            <View key={uri} style={styles.fotoMini}>
                              <Image
                                source={{ uri }}
                                style={[styles.fotoMiniImagen, { backgroundColor: theme.surface2 }]}
                                accessibilityLabel={`Foto ${i + 1} del recorrido`}
                              />
                              {i === 0 ? (
                                <View style={[styles.fotoPortada, { backgroundColor: theme.surface }]}>
                                  <Text style={[styles.fotoPortadaTexto, { color: theme.text }]}>
                                    Portada
                                  </Text>
                                </View>
                              ) : null}
                              <Pressable
                                onPress={() => setFotosUri((prev) => prev.filter((f) => f !== uri))}
                                disabled={publicando}
                                accessibilityRole="button"
                                accessibilityLabel={`Quitar la foto ${i + 1}`}
                                hitSlop={8}
                                style={[
                                  styles.fotoQuitar,
                                  { backgroundColor: theme.surface, borderColor: theme.border },
                                ]}
                              >
                                <Feather name="x" size={15} color={theme.text} />
                              </Pressable>
                            </View>
                          ))}
                          {fotosUri.length < FOTOS_RECORRIDO_MAX ? (
                            <Pressable
                              onPress={() => setHojaFoto(true)}
                              disabled={publicando}
                              accessibilityRole="button"
                              accessibilityLabel="Agregar otra foto"
                              style={[styles.fotoAgregar, { borderColor: theme.borderStrong }]}
                            >
                              <Feather name="plus" size={22} color={theme.textDim} />
                              <Text style={[styles.fotoAgregarTexto, { color: theme.textDim }]}>
                                Agregar
                              </Text>
                            </Pressable>
                          ) : null}
                        </ScrollView>
                      </View>
                    ) : (
                      <Btn
                        variant="outline"
                        block
                        icon="image"
                        onPress={() => setHojaFoto(true)}
                        disabled={publicando}
                      >
                        Agregar fotos (opcional, hasta {FOTOS_RECORRIDO_MAX})
                      </Btn>
                    )}
                  </>
                ) : null}
                <Btn
                  variant={publicado ? 'outline' : 'secondary'}
                  block
                  icon={publicado ? 'eye-off' : 'upload-cloud'}
                  loading={publicado === null || publicando}
                  disabled={publicado === null || publicando}
                  onPress={() => void alternarPublicacion()}
                >
                  {publicado ? 'Despublicar' : 'Publicar recorrido'}
                </Btn>
              </View>
            </PasoAyuda>
          ) : null}

          {puedeRepetir && viaje ? (
            <Btn
              variant="secondary"
              block
              icon="repeat"
              onPress={() => abrirRepetirEntrenamiento(viaje.id)}
            >
              Repetir este entrenamiento
            </Btn>
          ) : null}

          {/* En los viajes grupales estas acciones viven en la pestaña Configuración. */}
          {!esGrupal ? accionesViaje : null}

          {desdeCierre ? (
            <Btn variant="primary" block icon="home" onPress={volverAlInicio}>
              Volver al inicio
            </Btn>
          ) : null}
        </ScrollViewAyuda>
        </View>
      )}

      <HojaInferior visible={hojaFoto} titulo="Agregar una foto" onCerrar={() => setHojaFoto(false)}>
        <FilaOpcion icono="image" titulo="Elegir de la galería" onPress={() => elegirFotoRecorrido('galeria')} />
        <FilaOpcion icono="camera" titulo="Sacar una foto" onPress={() => elegirFotoRecorrido('camara')} />
      </HojaInferior>
    </View>
  )
}

type IntegranteRowProps = {
  fila: FilaGrupo
  esYo: boolean
  rankingHabilitado: boolean
  tipoActividad: string
}

function IntegranteRow({ fila, esYo, rankingHabilitado, tipoActividad }: IntegranteRowProps) {
  const theme = useTheme()
  const esPaceActivity = tipoActividad === 'running' || tipoActividad === 'trekking'
  const integrante = fila.metrica
  const badge = badgeFila(fila)
  // Los que no participaron no tienen métricas que mostrar.
  const atenuado = noParticipo(fila.estado)

  return (
    <View style={[styles.integranteRow, atenuado && styles.integranteAtenuado]}>
      <AvatarFallback nombre={fila.nombre} size={36} usuarioId={fila.usuarioId} />
      <View style={styles.integranteInfo}>
        <Text style={[styles.integranteNombre, { color: theme.text }]} numberOfLines={1}>
          {fila.nombre}
          {esYo ? ' (vos)' : ''}
        </Text>
        {!atenuado ? (
        <View style={styles.integranteStats}>
          <Text style={[styles.integranteStat, { color: theme.textDim }]}>
            {formatKm(integrante?.distancia_m)}
          </Text>
          {rankingHabilitado && integrante && integrante.distancia_m != null ? (
            <>
              {esPaceActivity ? (
                <Text style={[styles.integranteStat, { color: theme.textDim }]}>
                  {formatPace(integrante.tiempo_movimiento_seg, integrante.distancia_m)}
                </Text>
              ) : (
                <Text style={[styles.integranteStat, { color: theme.textDim }]}>
                  {formatSpeedKmh(integrante.velocidad_promedio_kmh)}
                </Text>
              )}
              <Text style={[styles.integranteStat, { color: theme.textDim }]}>
                {formatDurationHm(integrante.tiempo_movimiento_seg)} en mov.
              </Text>
            </>
          ) : null}
        </View>
        ) : null}
      </View>
      {badge ? <Badge tone={badge.tone}>{badge.texto}</Badge> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  botonCirculo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  oculta: {
    display: 'none',
  },
  tabs: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  tripName: {
    fontSize: 20,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fechaViaje: {
    fontSize: 13,
    fontWeight: '600',
  },
  acciones: {
    gap: 8,
  },
  seccion: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  comparativa: {
    fontSize: 13,
    lineHeight: 18,
  },
  nota: {
    fontSize: 13,
    lineHeight: 18,
  },
  warnCard: {
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  warnText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    marginTop: 10,
  },
  publicarCard: {
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  publicarTitulo: {
    fontSize: 15,
    fontWeight: '700',
  },
  comentarioInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  contador: {
    fontSize: 12,
    textAlign: 'right',
  },
  compartirChecklist: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  compartirTexto: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  fotos: {
    gap: 8,
  },
  fotosTitulo: {
    fontSize: 13,
    fontWeight: '600',
  },
  fotosFila: {
    gap: 10,
    paddingRight: 4,
  },
  fotoMini: {
    width: 132,
    height: 99,
  },
  fotoMiniImagen: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  fotoPortada: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  fotoPortadaTexto: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  fotoQuitar: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoAgregar: {
    width: 132,
    height: 99,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fotoAgregarTexto: {
    fontSize: 13,
    fontWeight: '600',
  },
  grupoCard: {
    borderWidth: 1.2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  separador: {
    height: 1,
    marginHorizontal: 12,
  },
  integranteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  integranteAtenuado: {
    opacity: 0.55,
  },
  integranteInfo: {
    flex: 1,
    gap: 3,
  },
  integranteNombre: {
    fontSize: 14,
    fontWeight: '600',
  },
  integranteStats: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  integranteStat: {
    fontSize: 12,
  },
})
