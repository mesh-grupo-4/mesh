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
import {
  OpcionFiltro,
  OpcionesFiltro,
  PantallaFiltros,
  SeccionFiltro,
} from '@/components/PantallaFiltros'
import { Pressable } from '@/components/Pressable'
import { SegmentTabs } from '@/components/SegmentTabs'
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
  }, [actividad, circuitoFiltro?.id])

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
        contentContainerStyle={{ paddingBottom: espacioTabBar }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true)
              void cargar()
            }}
            tintColor={theme.accent}
          />
        }
      >
        <TopBar title="Entrenar" raiz bordered={false} />

        <View style={styles.cabecera}>
          <Btn block size="lg" icon="plus" onPress={abrirNuevoEntrenamiento}>
            Nuevo entrenamiento
          </Btn>
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
            <ActivityIndicator color={theme.accent} />
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
              height: Math.max(4, Math.round((s.distancia_m / max) * 36)),
              backgroundColor: theme.accent,
              // La última es la más reciente: es la única a pleno color.
              opacity: i === sesiones.length - 1 ? 1 : 0.4,
            },
          ]}
        />
      ))}
    </View>
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
      <View style={styles.tarjetaCabecera}>
        <ActivityTile activity={circuito.tipo_actividad} size={44} />
        <View style={styles.flex}>
          <Text style={[styles.tarjetaTitulo, { color: theme.text }]} numberOfLines={1}>
            {circuito.nombre}
          </Text>
          <Text style={[styles.tarjetaSub, { color: theme.textDim }]}>
            {etiquetaActividad(circuito.tipo_actividad)} · {circuito.total_sesiones}{' '}
            {circuito.total_sesiones === 1 ? 'sesión' : 'sesiones'}
          </Text>
        </View>
        <Pressable
          onPress={onRenombrar}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Renombrar ${circuito.nombre}`}
          style={styles.iconoBtn}
        >
          <Feather name="edit-2" size={18} color={theme.textDim} />
        </Pressable>
      </View>

      <View style={styles.tarjetaCuerpo}>
        <View style={styles.flex}>
          <Text style={[styles.dato, { color: theme.text }]}>
            Mejor ritmo {formatPaceMinKm(circuito.mejor_pace_min_km)}
          </Text>
          {ultima ? (
            <Text style={[styles.tarjetaSub, { color: theme.textDim }]}>
              Última: {fechaCorta(ultima.fecha_fin_real)} · {formatKm(ultima.distancia_m)} ·{' '}
              {formatPaceMinKm(ultima.pace_min_km)}
            </Text>
          ) : null}
        </View>
        <BarrasEvolucion sesiones={circuito.evolucion} />
      </View>

      {onRepetir ? (
        <Btn variant="outline" size="md" icon="repeat" onPress={onRepetir}>
          Repetir
        </Btn>
      ) : null}
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
      <View style={styles.tarjetaCabecera}>
        <ActivityTile activity={sesion.tipo_actividad} size={44} />
        <View style={styles.flex}>
          <Text style={[styles.tarjetaTitulo, { color: theme.text }]} numberOfLines={1}>
            {sesion.nombre}
          </Text>
          <Text style={[styles.tarjetaSub, { color: theme.textDim }]}>
            {fechaCorta(sesion.fecha_fin_real)}
            {sesion.es_creador ? '' : ' · armado por otra persona'}
          </Text>
        </View>
      </View>

      <Text style={[styles.dato, { color: theme.text }]}>
        {formatKm(sesion.distancia_m)} · {formatPaceMinKm(sesion.pace_min_km)} ·{' '}
        {formatDurationHm(sesion.tiempo_movimiento_seg)}
      </Text>

      {sesion.circuito ? (
        <View style={styles.circuitoFila}>
          <Feather name="repeat" size={14} color={theme.accent} />
          <Text style={[styles.tarjetaSub, styles.flex, { color: theme.textDim }]} numberOfLines={1}>
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

      {sesion.repetir.planificado || sesion.repetir.real ? (
        <Btn variant="outline" size="md" icon="repeat" onPress={onRepetir}>
          Repetir
        </Btn>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  cabecera: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  center: { paddingVertical: 48, alignItems: 'center' },
  vacio: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 12 },
  vacioTitulo: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  vacioTexto: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  tarjeta: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tarjetaTitulo: { fontSize: 17, fontWeight: '800' },
  tarjetaSub: { fontSize: 14, lineHeight: 19 },
  tarjetaCuerpo: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  dato: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  iconoBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 36 },
  barra: { width: 8, borderRadius: 3 },
  circuitoFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sacar: { fontSize: 14, fontWeight: '700' },
  modalFondo: { flex: 1, justifyContent: 'center', padding: 24 },
  modalCaja: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  modalTitulo: { fontSize: 20, fontWeight: '800' },
  modalBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
})
