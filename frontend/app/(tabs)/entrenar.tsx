import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'

import { ActivityTile, Btn, Field, TopBar, useTheme } from '@/components/MeshUI'
import { HerramientasLista } from '@/components/BarraFiltros'
import { FranjaEstado } from '@/components/FranjaEstado'
import { BotonFlotante, ESPACIO_BOTON_FLOTANTE, useBotonFlotante } from '@/components/BotonFlotante'
import {
  OpcionFiltro,
  OpcionesFiltro,
  PantallaFiltros,
  SeccionFiltro,
} from '@/components/PantallaFiltros'
import { Pressable } from '@/components/Pressable'
import { SegmentTabs } from '@/components/SegmentTabs'
import { CampanitaNotificaciones } from '@/components/notificaciones/CampanitaNotificaciones'
import { useAuth } from '@/context/AuthContext'
import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { etiquetaActividad } from '@/lib/activityDefaults'
import {
  listarCircuitos,
  listarSesiones,
  renombrarCircuito,
  sacarSesionDeCircuito,
  type ActividadEntrenableApi,
  type CircuitoApi,
  type SesionApi,
  type SesionCircuitoApi,
} from '@/lib/entrenamientosApi'
import { formatDurationHm, formatKm, formatPaceMinKm } from '@/lib/format'
import { meshAlert, meshConfirmDestructive } from '@/lib/meshAlert'
import { abrirNuevoEntrenamiento, abrirRepetirEntrenamiento } from '@/lib/nuevoViaje'
import { formatearEnArg } from '@/lib/tiempoArg'
import { coincideBusqueda, normalizarBusqueda } from '@/lib/busqueda'
import { listarInvitacionesViajePendientes } from '@/lib/viajesApi'

type Seccion = 'circuitos' | 'sesiones'

/** RN-070: el entrenamiento no existe en moto ni auto. */
const ACTIVIDADES_ENTRENABLES: ActividadEntrenableApi[] = ['running', 'bici', 'trekking', 'otro']

function fechaCorta(iso: string | null): string {
  return iso ? formatearEnArg(iso, { weekday: 'short', day: '2-digit', month: 'short' }) : 'Sin fecha'
}

/**
 * RN-066: tab "Entrenar". Entrada para arrancar un entrenamiento y lugar donde
 * seguirlos como serie: los circuitos (sesiones de un mismo recorrido, con su
 * evolución) y todas las sesiones, con "Repetir" en cada una.
 */
export default function EntrenarScreen() {
  const theme = useTheme()
  const espacioTabBar = useEspacioTabBar()
  const botonFlotante = useBotonFlotante()
  const { backendUserId } = useAuth()

  /** Invitaciones a entrenamientos sin responder: el puntito de la campanita. */
  const [invitaciones, setInvitaciones] = useState(0)
  const [seccion, setSeccion] = useState<Seccion>('circuitos')
  const [actividad, setActividad] = useState<ActividadEntrenableApi | null>(null)
  /** Ver solo las sesiones de un circuito (se entra tocando su tarjeta). */
  const [circuitoFiltro, setCircuitoFiltro] = useState<{ id: string; nombre: string } | null>(null)

  const [circuitos, setCircuitos] = useState<CircuitoApi[]>([])
  const [sesiones, setSesiones] = useState<SesionApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [pantallaFiltros, setPantallaFiltros] = useState(false)
  // La pantalla de filtros edita un borrador; se aplica recién al confirmar.
  const [borradorActividad, setBorradorActividad] = useState<ActividadEntrenableApi | null>(null)
  const [borradorCircuito, setBorradorCircuito] = useState<{ id: string; nombre: string } | null>(null)

  const [renombrando, setRenombrando] = useState<CircuitoApi | null>(null)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardandoNombre, setGuardandoNombre] = useState(false)

  const cargar = useCallback(async () => {
    // Aparte de la lista: si falla, la campanita queda como estaba y la pantalla carga igual.
    if (backendUserId) {
      void listarInvitacionesViajePendientes(backendUserId)
        .then((inv) => setInvitaciones(inv.filter((i) => i.modo === 'entrenamiento').length))
        .catch(() => {})
    }
    try {
      const [c, s] = await Promise.all([
        listarCircuitos({ tipoActividad: actividad }),
        listarSesiones({ tipoActividad: actividad, circuitoId: circuitoFiltro?.id }),
      ])
      setCircuitos(c)
      setSesiones(s)
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudieron cargar tus entrenamientos.')
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [actividad, circuitoFiltro?.id, backendUserId])

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const verCircuito = (c: CircuitoApi) => {
    setCircuitoFiltro({ id: c.id, nombre: c.nombre })
    setSeccion('sesiones')
  }

  const cambiarSeccion = (key: string) => {
    // Volver a Circuitos suelta el filtro: en Sesiones se ven todas otra vez.
    if (key === 'circuitos') setCircuitoFiltro(null)
    setSeccion(key as Seccion)
  }

  const cantidadFiltros =
    (actividad ? 1 : 0) + (seccion === 'sesiones' && circuitoFiltro ? 1 : 0)

  const abrirFiltros = () => {
    setBorradorActividad(actividad)
    setBorradorCircuito(circuitoFiltro)
    setPantallaFiltros(true)
  }

  const aplicarFiltros = () => {
    setActividad(borradorActividad)
    setCircuitoFiltro(seccion === 'sesiones' ? borradorCircuito : null)
    setPantallaFiltros(false)
  }

  const limpiarFiltros = () => {
    setActividad(null)
    setCircuitoFiltro(null)
  }

  const consulta = normalizarBusqueda(busqueda)
  const circuitosVisibles = circuitos.filter((c) => coincideBusqueda(consulta, [c.nombre]))
  const sesionesVisibles = sesiones.filter((s) =>
    coincideBusqueda(consulta, [s.nombre, s.circuito?.nombre])
  )
  const total = seccion === 'circuitos' ? circuitos.length : sesiones.length
  const visibles = seccion === 'circuitos' ? circuitosVisibles.length : sesionesVisibles.length
  const sustantivo =
    seccion === 'circuitos'
      ? total === 1 ? 'circuito' : 'circuitos'
      : total === 1 ? 'sesión' : 'sesiones'
  const resumen = cargando
    ? undefined
    : consulta
      ? `Mostrando ${visibles} de ${total}`
      : `${total} ${sustantivo}${seccion === 'sesiones' && circuitoFiltro ? ` · ${circuitoFiltro.nombre}` : ''}`

  // Circuitos para elegir en los filtros: el aplicado siempre aparece, aunque no esté en la lista cargada.
  const circuitosParaFiltro =
    circuitoFiltro && !circuitos.some((c) => c.id === circuitoFiltro.id)
      ? [circuitoFiltro, ...circuitos]
      : circuitos

  const abrirRenombrar = (c: CircuitoApi) => {
    setNombreNuevo(c.nombre)
    setRenombrando(c)
  }

  const guardarNombre = async () => {
    const nombre = nombreNuevo.trim()
    if (!renombrando || !nombre) return
    setGuardandoNombre(true)
    try {
      await renombrarCircuito(renombrando.id, nombre)
      setCircuitos((prev) => prev.map((c) => (c.id === renombrando.id ? { ...c, nombre } : c)))
      setSesiones((prev) =>
        prev.map((s) => (s.circuito?.id === renombrando.id ? { ...s, circuito: { ...s.circuito, nombre } } : s))
      )
      setRenombrando(null)
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo renombrar el circuito.')
    } finally {
      setGuardandoNombre(false)
    }
  }

  const sacarDelCircuito = (s: SesionApi) => {
    const circuito = s.circuito
    if (!circuito) return
    meshConfirmDestructive({
      title: 'Sacar del circuito',
      message: `"${s.nombre}" deja de contar en "${circuito.nombre}". La sesión y sus métricas no se borran.`,
      confirmLabel: 'Sacar',
      onConfirm: async () => {
        try {
          await sacarSesionDeCircuito(circuito.id, s.viaje_id)
          await cargar()
        } catch (e) {
          meshAlert('Error', e instanceof Error ? e.message : 'No se pudo sacar la sesión.')
        }
      },
    })
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        onScroll={botonFlotante.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: espacioTabBar + ESPACIO_BOTON_FLOTANTE }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true)
              void cargar()
            }}
            tintColor={theme.good}
          />
        }
      >
        <TopBar
          title="Entrenar"
          raiz
          bordered={false}
          right={
            <CampanitaNotificaciones
              pendientes={invitaciones}
              etiqueta="Invitaciones a entrenamientos"
              onPress={() => router.push('/viaje/invitaciones')}
            />
          }
        />

        <View style={styles.cabecera}>
          <SegmentTabs
            tabs={[
              { key: 'circuitos', label: 'Circuitos' },
              { key: 'sesiones', label: 'Sesiones' },
            ]}
            active={seccion}
            onChange={cambiarSeccion}
            theme={theme}
          />
        </View>

        <HerramientasLista
          resumen={resumen}
          busqueda={{
            value: busqueda,
            onChangeText: setBusqueda,
            placeholder: seccion === 'circuitos' ? 'Buscar circuitos...' : 'Buscar sesiones...',
            accessibilityLabel: 'Buscar entrenamientos',
            maxLength: 60,
          }}
          filtros={{ cantidad: cantidadFiltros, onPress: abrirFiltros, onLimpiar: limpiarFiltros }}
        />

        <View style={styles.content}>
        {cargando ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.good} />
          </View>
        ) : visibles === 0 && (consulta || cantidadFiltros > 0) ? (
          <Vacio
            icon="search"
            titulo="Sin resultados"
            texto={
              consulta
                ? `Nada coincide con "${busqueda.trim()}".`
                : 'No hay entrenamientos con los filtros aplicados.'
            }
          />
        ) : seccion === 'circuitos' ? (
          circuitos.length === 0 ? (
            <Vacio
              icon="repeat"
              titulo="Todavía no tenés circuitos"
              texto={'Un circuito se arma solo cuando repetís una sesión (botón "Repetir") o cuando entrenás varias veces con la misma ruta guardada. Ahí vas a ver cómo evolucionás en ese recorrido.'}
            />
          ) : (
            circuitosVisibles.map((c) => (
              <TarjetaCircuito
                key={c.id}
                circuito={c}
                onVer={() => verCircuito(c)}
                onRenombrar={() => abrirRenombrar(c)}
                onRepetir={
                  c.ultima_sesion_viaje_id
                    ? () => abrirRepetirEntrenamiento(c.ultima_sesion_viaje_id!)
                    : undefined
                }
              />
            ))
          )
        ) : sesiones.length === 0 ? (
          <Vacio
            icon="activity"
            titulo="Todavía no hay sesiones"
            texto='Tocá "Nuevo entrenamiento" para arrancar. Cada entrenamiento que termines queda acá con su distancia y su ritmo.'
          />
        ) : (
          sesionesVisibles.map((s) => (
            <FilaSesion
              key={s.viaje_id}
              sesion={s}
              onAbrir={() =>
                router.push({ pathname: '/viaje/[viajeId]/metricas', params: { viajeId: s.viaje_id } })
              }
              onRepetir={() => abrirRepetirEntrenamiento(s.viaje_id)}
              onSacar={s.circuito ? () => sacarDelCircuito(s) : undefined}
            />
          ))
        )}
        </View>
      </ScrollView>

      <FranjaEstado />

      <BotonFlotante
        icono="heartbeat"
        label="Nuevo entrenamiento"
        onPress={abrirNuevoEntrenamiento}
        extendido={botonFlotante.extendido}
      />

      <PantallaFiltros
        visible={pantallaFiltros}
        titulo="Filtrar entrenamientos"
        onCerrar={() => setPantallaFiltros(false)}
        onLimpiar={() => {
          setBorradorActividad(null)
          setBorradorCircuito(null)
        }}
        puedeLimpiar={borradorActividad !== null || borradorCircuito !== null}
        textoAplicar="Aplicar filtros"
        onAplicar={aplicarFiltros}
      >
        <SeccionFiltro titulo="Actividad">
          <OpcionesFiltro>
            <OpcionFiltro
              etiqueta="Todas"
              activa={borradorActividad === null}
              onPress={() => setBorradorActividad(null)}
            />
            {ACTIVIDADES_ENTRENABLES.map((a) => (
              <OpcionFiltro
                key={a}
                etiqueta={etiquetaActividad(a)}
                activa={borradorActividad === a}
                onPress={() => setBorradorActividad(a)}
                icono={<ActivityTile activity={a} size={24} />}
              />
            ))}
          </OpcionesFiltro>
        </SeccionFiltro>

        {seccion === 'sesiones' && circuitosParaFiltro.length > 0 ? (
          <SeccionFiltro titulo="Circuito">
            <OpcionesFiltro>
              <OpcionFiltro
                etiqueta="Todos"
                activa={borradorCircuito === null}
                onPress={() => setBorradorCircuito(null)}
              />
              {circuitosParaFiltro.map((c) => (
                <OpcionFiltro
                  key={c.id}
                  etiqueta={c.nombre}
                  activa={borradorCircuito?.id === c.id}
                  onPress={() => setBorradorCircuito({ id: c.id, nombre: c.nombre })}
                />
              ))}
            </OpcionesFiltro>
          </SeccionFiltro>
        ) : null}
      </PantallaFiltros>

      <Modal
        visible={renombrando != null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenombrando(null)}
      >
        <View style={[styles.modalFondo, { backgroundColor: theme.scrim }]}>
          <View style={[styles.modalCaja, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.modalTitulo, { color: theme.text }]}>Renombrar circuito</Text>
            <Field
              label="Nombre"
              value={nombreNuevo}
              onChangeText={setNombreNuevo}
              maxLength={100}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void guardarNombre()}
            />
            <View style={styles.modalBotones}>
              <Btn variant="ghost" onPress={() => setRenombrando(null)} disabled={guardandoNombre}>
                Cancelar
              </Btn>
              <Btn
                onPress={() => void guardarNombre()}
                loading={guardandoNombre}
                disabled={guardandoNombre || !nombreNuevo.trim()}
              >
                Guardar
              </Btn>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function Vacio({
  icon,
  titulo,
  texto,
}: {
  icon: keyof typeof Feather.glyphMap
  titulo: string
  texto: string
}) {
  const theme = useTheme()
  return (
    <View style={styles.vacio}>
      <Feather name={icon} size={36} color={theme.textMute} />
      <Text style={[styles.vacioTitulo, { color: theme.text }]}>{titulo}</Text>
      <Text style={[styles.vacioTexto, { color: theme.textDim }]}>{texto}</Text>
    </View>
  )
}

/** Barras de las últimas sesiones del circuito: el alto es la distancia de cada una. */
function BarrasEvolucion({ sesiones }: { sesiones: SesionCircuitoApi[] }) {
  const theme = useTheme()
  const max = Math.max(...sesiones.map((s) => s.distancia_m), 1)
  return (
    <View
      style={styles.barras}
      accessibilityLabel={`Distancia de las últimas ${sesiones.length} sesiones`}
    >
      {sesiones.map((s, i) => (
        <View
          key={s.viaje_id}
          style={[
            styles.barra,
            {
              height: Math.max(4, Math.round((s.distancia_m / max) * 30)),
              backgroundColor: theme.good,
              // La última es la más reciente: es la única a pleno color.
              opacity: i === sesiones.length - 1 ? 1 : 0.4,
            },
          ]}
        />
      ))}
    </View>
  )
}

/** Métrica de la tarjeta: mismo formato valor + etiqueta que las tarjetas de Viajes. */
function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const theme = useTheme()
  return (
    <View style={styles.metrica}>
      <Text style={[styles.metricaValor, { color: theme.text }]} numberOfLines={1}>
        {valor}
      </Text>
      <Text style={[styles.metricaLabel, { color: theme.textMute }]}>{etiqueta}</Text>
    </View>
  )
}

/** "Repetir" con el verde del modo entrenamiento (RN-065), en lugar del acento de la marca. */
function BotonRepetir({ onPress }: { onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Repetir"
      style={({ pressed }) => [
        styles.repetir,
        { borderColor: theme.good },
        pressed && { backgroundColor: `${theme.good}1f` },
      ]}
    >
      <Feather name="repeat" size={16} color={theme.good} />
      <Text style={[styles.repetirTexto, { color: theme.good }]}>Repetir</Text>
    </Pressable>
  )
}

function TarjetaCircuito({
  circuito,
  onVer,
  onRenombrar,
  onRepetir,
}: {
  circuito: CircuitoApi
  onVer: () => void
  onRenombrar: () => void
  onRepetir?: () => void
}) {
  const theme = useTheme()
  const ultima = circuito.evolucion[circuito.evolucion.length - 1]
  return (
    <Pressable
      onPress={onVer}
      accessibilityRole="button"
      accessibilityLabel={`Circuito ${circuito.nombre}, ${circuito.total_sesiones} sesiones`}
      style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.tarjetaHeader}>
        <ActivityTile activity={circuito.tipo_actividad} size={22} color={theme.good} />
        <Text style={[styles.tarjetaTitulo, { color: theme.text }]} numberOfLines={1}>
          {circuito.nombre}
        </Text>
        <Pressable
          onPress={onRenombrar}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Renombrar ${circuito.nombre}`}
          style={styles.iconoBtn}
        >
          <Feather name="edit-2" size={16} color={theme.textDim} />
        </Pressable>
      </View>

      <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
        <Feather name="repeat" size={12} />
        {'  '}
        {etiquetaActividad(circuito.tipo_actividad)} · {circuito.total_sesiones}{' '}
        {circuito.total_sesiones === 1 ? 'sesión' : 'sesiones'}
      </Text>
      {ultima ? (
        <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
          <Feather name="calendar" size={12} />
          {'  '}Última: {fechaCorta(ultima.fecha_fin_real)}
        </Text>
      ) : null}

      <View style={[styles.metricas, { borderTopColor: theme.border }]}>
        <Metrica valor={formatPaceMinKm(circuito.mejor_pace_min_km)} etiqueta="Mejor ritmo" />
        {ultima ? (
          <>
            <Metrica valor={formatPaceMinKm(ultima.pace_min_km)} etiqueta="Último ritmo" />
            <Metrica valor={formatKm(ultima.distancia_m)} etiqueta="Última distancia" />
          </>
        ) : null}
        <BarrasEvolucion sesiones={circuito.evolucion} />
      </View>

      {onRepetir ? <BotonRepetir onPress={onRepetir} /> : null}
    </Pressable>
  )
}

function FilaSesion({
  sesion,
  onAbrir,
  onRepetir,
  onSacar,
}: {
  sesion: SesionApi
  onAbrir: () => void
  onRepetir: () => void
  onSacar?: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      accessibilityLabel={`Sesión ${sesion.nombre}, ${fechaCorta(sesion.fecha_fin_real)}`}
      style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.tarjetaHeader}>
        <ActivityTile activity={sesion.tipo_actividad} size={22} color={theme.good} />
        <Text style={[styles.tarjetaTitulo, { color: theme.text }]} numberOfLines={1}>
          {sesion.nombre}
        </Text>
      </View>

      <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
        <Feather name="calendar" size={12} />
        {'  '}
        {fechaCorta(sesion.fecha_fin_real)}
        {sesion.es_creador ? '' : ' · armado por otra persona'}
      </Text>

      {sesion.circuito ? (
        <View style={styles.circuitoFila}>
          <Feather name="repeat" size={12} color={theme.good} />
          <Text style={[styles.tarjetaMeta, styles.flex, { color: theme.textDim }]} numberOfLines={1}>
            {sesion.circuito.nombre}
          </Text>
          {onSacar ? (
            <Pressable
              onPress={onSacar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Sacar del circuito ${sesion.circuito.nombre}`}
            >
              <Text style={[styles.sacar, { color: theme.danger }]}>Sacar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.metricas, { borderTopColor: theme.border }]}>
        <Metrica valor={formatKm(sesion.distancia_m)} etiqueta="Distancia" />
        <Metrica valor={formatPaceMinKm(sesion.pace_min_km)} etiqueta="Ritmo" />
        <Metrica valor={formatDurationHm(sesion.tiempo_movimiento_seg)} etiqueta="En movimiento" />
      </View>

      {sesion.repetir.planificado || sesion.repetir.real ? <BotonRepetir onPress={onRepetir} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  cabecera: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  center: { paddingVertical: 48, alignItems: 'center' },
  // Misma escala tipográfica que las tarjetas y el estado vacío de Viajes.
  vacio: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 12 },
  vacioTitulo: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  vacioTexto: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  tarjeta: { borderRadius: 14, borderWidth: 1.2, padding: 14, gap: 6 },
  tarjetaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tarjetaTitulo: { flex: 1, fontSize: 15.5, fontWeight: '700' },
  tarjetaMeta: { fontSize: 13, lineHeight: 18 },
  metricas: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  metrica: { flex: 1, gap: 2 },
  metricaValor: { fontSize: 15, fontWeight: '800' },
  metricaLabel: { fontSize: 11, fontWeight: '600' },
  iconoBtn: { padding: 4 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 30 },
  barra: { width: 6, borderRadius: 2 },
  circuitoFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sacar: { fontSize: 13, fontWeight: '700' },
  repetir: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  repetirTexto: { fontSize: 15, fontWeight: '700' },
  modalFondo: { flex: 1, justifyContent: 'center', padding: 24 },
  modalCaja: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  modalTitulo: { fontSize: 20, fontWeight: '800' },
  modalBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
})
