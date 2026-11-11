import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { meshAlert } from '@/lib/meshAlert'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Feather } from '@expo/vector-icons'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { listarGrupos, type GrupoListItemApi } from '@/lib/gruposApi'
import { listarAmigos, type AmigoApi } from '@/lib/amistadesApi'
import {
  crearViaje,
  listarViajesPlanificados,
  listarViajesFinalizados,
  type ModoViajeApi,
  type ParametrosViajeInput,
  type TipoActividadApi,
} from '@/lib/viajesApi'
import { ajustarSiQuedoEnPasado, esFechaFutura } from '@/lib/fechaProgramada'
import { aCamposArg, ahoraEnCamposArg, desdeCamposArg, formatearEnArg } from '@/lib/tiempoArg'
import {
  RANGO_PARAMETROS,
  actividadInicialDesdePerfil,
  actividadValida,
  esMotorizado,
  etiquetaActividad,
  parametrosPorActividad,
  textoParametrosActividad,
} from '@/lib/activityDefaults'
import { paramTexto } from '@/lib/nuevoViaje'
import { Btn, ActivityTile, Field, TopBar, useTheme } from '@/components/MeshUI'
import { BotonAyuda } from '@/components/ayuda/BotonAyuda'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda'
import { AYUDA_VIAJE_CREAR } from '@/components/ayuda/contenidoAyuda'
import { Collapsible } from '@/components/Collapsible'
import { ActividadGrid } from '@/components/viaje-nuevo/ActividadGrid'
import { SelectorModo } from '@/components/viaje-nuevo/SelectorModo'
import { useVolverInterno } from '@/hooks/useVolver'

const MSG_FECHA_PASADA = 'La fecha y hora programadas deben ser futuras.'

type Paso = 'actividad' | 'cuando' | 'recorrido' | 'invitados' | 'resumen'

/** Pasos con tour de ayuda: en el resto no se muestra el "?". */
const PASOS_CON_AYUDA: Paso[] = ['actividad', 'cuando', 'invitados']

/** Dentro de una semana, a las 9:00 de la mañana hora argentina. */
function fechaPorDefecto(): Date {
  const campos = ahoraEnCamposArg()
  campos.setDate(campos.getDate() + 7)
  campos.setHours(9, 0, 0, 0)
  return desdeCamposArg(campos)
}

function formatearFechaHora(d: Date): string {
  return formatearEnArg(d, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function plural(n: number, singular: string, pluralTxt: string): string {
  return `${n} ${n === 1 ? singular : pluralTxt}`
}

/**
 * "Planificar viaje" como wizard: una decisión principal por paso
 * (actividad → cuándo → recorrido → con quién) y un resumen final con lo
 * avanzado (modo y parámetros) en valores por defecto. Desde el resumen se
 * vuelve a cualquier paso y al confirmarlo se regresa directo al resumen.
 * Con una ruta de "Mis rutas" o al repetir una sesión de entrenamiento (RN-066) no se
 * pregunta actividad ni recorrido: ya vienen. Desde la tab Entrenar llega con
 * `modo=entrenamiento` y arranca individual.
 */
export default function CrearViajeScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { backendUserId, profile } = useAuth()
  const params = useLocalSearchParams<{
    plantillaId?: string | string[]
    tipoActividad?: string | string[]
    grupo?: string | string[]
    modo?: string | string[]
    repetirViajeId?: string | string[]
    recorrido?: string | string[]
    nombre?: string | string[]
  }>()
  const plantillaId = paramTexto(params.plantillaId) ?? null
  // RN-066: repetir una sesión de entrenamiento; el backend fija modo, actividad y recorrido.
  const repetirViajeId = paramTexto(params.repetirViajeId) ?? null
  const recorridoRepetir = paramTexto(params.recorrido) === 'planificado' ? 'planificado' : 'real'
  /** El recorrido ya viene dado (ruta guardada o sesión repetida): no se elige actividad ni ruta. */
  const recorridoDado = Boolean(plantillaId || repetirViajeId)
  /** Se abrió desde la tab Entrenar (o repitiendo): es un entrenamiento desde el arranque. */
  const esEntrenamientoDeEntrada = Boolean(repetirViajeId) || paramTexto(params.modo) === 'entrenamiento'
  const grupoInicial = paramTexto(params.grupo) ?? null
  const tipoDesdePlantilla = useMemo(() => {
    const raw = paramTexto(params.tipoActividad)
    return actividadValida(raw) ? raw : null
  }, [params.tipoActividad])

  const pasos = useMemo<Paso[]>(
    () =>
      recorridoDado
        ? ['cuando', 'invitados', 'resumen']
        : ['actividad', 'cuando', 'recorrido', 'invitados', 'resumen'],
    [recorridoDado]
  )
  const [paso, setPaso] = useState<Paso>(pasos[0]!)
  /** Se entró a un paso tocando una fila del resumen: al confirmarlo se vuelve ahí. */
  const [editandoDesdeResumen, setEditandoDesdeResumen] = useState(false)

  const [grupos, setGrupos] = useState<GrupoListItemApi[]>([])
  const [amigos, setAmigos] = useState<AmigoApi[]>([])
  const [cargandoInvitables, setCargandoInvitables] = useState(true)
  const [nombre, setNombre] = useState(() => (repetirViajeId ? (paramTexto(params.nombre) ?? '') : ''))
  const [nombreFocus, setNombreFocus] = useState(false)
  const [tipoActividad, setTipoActividad] = useState<TipoActividadApi>(() => {
    const inicial = tipoDesdePlantilla ?? actividadInicialDesdePerfil(profile?.actividadPreferida)
    // RN-070: desde Entrenar no se puede arrancar en moto ni auto, aunque sea la preferida.
    return esEntrenamientoDeEntrada && esMotorizado(inicial) ? 'running' : inicial
  })
  // Un entrenamiento arranca individual; después se puede invitar gente.
  const [esGrupal, setEsGrupal] = useState(!esEntrenamientoDeEntrada)
  // RN-065: entrenamiento muestra ritmo en vivo y métricas de sesión al cerrar.
  const [modo, setModo] = useState<ModoViajeApi>(esEntrenamientoDeEntrada ? 'entrenamiento' : 'recreativo')
  // RN-071 / RN-070: competir exige grupo y nunca vehículo motorizado; entrenar tampoco en moto/auto.
  const motorizado = esMotorizado(tipoActividad)
  const puedeCompetir = esGrupal && !motorizado
  useEffect(() => {
    if (!puedeCompetir && modo === 'competitivo') setModo('recreativo')
    if (motorizado && modo === 'entrenamiento') setModo('recreativo')
  }, [puedeCompetir, motorizado, modo])
  const [gruposSeleccionados, setGruposSeleccionados] = useState<Set<string>>(
    () => new Set(grupoInicial ? [grupoInicial] : [])
  )
  const [amigosSeleccionados, setAmigosSeleccionados] = useState<Set<string>>(new Set())
  const [fecha, setFecha] = useState<Date>(fechaPorDefecto)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date')
  const [guardando, setGuardando] = useState(false)
  // Con plantilla ya hay una ruta precargada: se va directo a revisarla/ajustarla.
  const [conRecorrido, setConRecorrido] = useState(() => recorridoDado)
  // RN-025: overrides del líder sobre los defaults de la actividad. Como texto,
  // para que el usuario pueda borrar y reescribir; se valida al crear.
  const [paramsEdit, setParamsEdit] = useState<{
    velocidad: string
    separacion: string
    tolerancia: string
  } | null>(null)
  const defaultsActividad = parametrosPorActividad(tipoActividad)

  const nombrePorDefectoAplicado = useRef(false)

  useEffect(() => {
    if (nombrePorDefectoAplicado.current) return
    let cancelado = false
    ;(async () => {
      try {
        const userId = resolveBackendUserId(backendUserId)
        const [planificados, finalizados] = await Promise.all([
          listarViajesPlanificados(userId),
          listarViajesFinalizados(userId),
        ])
        const propios =
          planificados.filter((v) => v.mi_estado === 'creador').length +
          finalizados.filter((v) => v.mi_estado === 'creador').length
        if (cancelado) return
        nombrePorDefectoAplicado.current = true
        setNombre((prev) => (prev === '' ? `Viaje ${propios + 1}` : prev))
      } catch {
        // Sin nombre por defecto el usuario lo escribe a mano; no es bloqueante.
      }
    })()
    return () => {
      cancelado = true
    }
  }, [backendUserId])

  const cargarInvitables = useCallback(async () => {
    setCargandoInvitables(true)
    try {
      const userId = resolveBackendUserId(backendUserId)
      const [dataGrupos, dataAmigos] = await Promise.all([listarGrupos(userId), listarAmigos(userId)])
      setGrupos(dataGrupos)
      setAmigos(dataAmigos)
    } catch (e: unknown) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudieron cargar grupos y amigos.')
    } finally {
      setCargandoInvitables(false)
    }
  }, [backendUserId])

  useFocusEffect(
    useCallback(() => {
      void cargarInvitables()
    }, [cargarInvitables])
  )

  // ---- Navegación entre pasos ----

  const indicePaso = pasos.indexOf(paso)

  const avanzar = () => {
    setShowPicker(false)
    if (editandoDesdeResumen) {
      setEditandoDesdeResumen(false)
      setPaso('resumen')
      return
    }
    const siguiente = pasos[indicePaso + 1]
    if (siguiente) setPaso(siguiente)
  }

  const retroceder = () => {
    setShowPicker(false)
    if (editandoDesdeResumen) {
      setEditandoDesdeResumen(false)
      setPaso('resumen')
      return
    }
    const anterior = pasos[indicePaso - 1]
    if (anterior) setPaso(anterior)
    else router.back()
  }

  const editarPaso = (destino: Paso) => {
    setEditandoDesdeResumen(true)
    setPaso(destino)
  }

  // Atrás (botón, gesto o físico) retrocede un paso; desde el primero sale de la pantalla.
  useVolverInterno((indicePaso > 0 || editandoDesdeResumen) && !guardando, retroceder)

  // ---- Selecciones ----

  const elegirActividad = (a: TipoActividadApi) => {
    // Cambiar de actividad vuelve a los defaults: los ajustes eran para la otra.
    if (a !== tipoActividad) setParamsEdit(null)
    setTipoActividad(a)
    avanzar()
  }

  const toggleGrupo = (id: string) => {
    setGruposSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAmigo = (id: string) => {
    setAmigosSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const abrirPicker = () => {
    setPickerMode('date')
    setShowPicker(true)
  }

  const onChangeFecha = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed' || !selected) {
      setShowPicker(false)
      return
    }

    // El picker nativo lee y escribe en la zona del dispositivo, así que lo que
    // devuelve se interpreta como campos de hora argentina (RN-105).
    const campos = aCamposArg(fecha)

    // Android y web: fecha y hora en dos pasos. El time picker no respeta minimumDate.
    if (Platform.OS !== 'ios') {
      if (pickerMode === 'date') {
        campos.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate())
        setFecha(ajustarSiQuedoEnPasado(desdeCamposArg(campos)))
        setPickerMode('time')
        // el picker sigue abierto para elegir la hora
      } else {
        campos.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
        const instante = desdeCamposArg(campos)
        setShowPicker(false)
        if (!esFechaFutura(instante)) {
          meshAlert('Fecha inválida', MSG_FECHA_PASADA)
          return
        }
        setFecha(instante)
      }
      return
    }

    // iOS: modo datetime en una sola pasada (minimumDate a veces no bloquea el spinner)
    const instante = desdeCamposArg(selected)
    if (!esFechaFutura(instante)) {
      meshAlert('Fecha inválida', MSG_FECHA_PASADA)
      return
    }
    setFecha(instante)
  }

  const fechaInvalida = !esFechaFutura(fecha)

  /** RN-025: solo viaja lo que el líder cambió respecto del default; el resto lo pone el backend. */
  const resolverParametros = (): ParametrosViajeInput | 'invalido' => {
    if (!paramsEdit) return {}
    const leer = (txt: string, rango: { min: number; max: number }, entero: boolean) => {
      const n = Number(txt.replace(',', '.'))
      if (!Number.isFinite(n) || n < rango.min || n > rango.max || (entero && !Number.isInteger(n))) return null
      return n
    }
    const velocidad = leer(paramsEdit.velocidad, RANGO_PARAMETROS.velocidadEsperada, false)
    const separacion = leer(paramsEdit.separacion, RANGO_PARAMETROS.distanciaMaxSeparacion, true)
    const tolerancia = leer(paramsEdit.tolerancia, RANGO_PARAMETROS.toleranciaAtrasoMin, true)
    if (velocidad == null || separacion == null || tolerancia == null) return 'invalido'
    return {
      velocidadEsperada: velocidad !== defaultsActividad.velocidadEsperada ? velocidad : undefined,
      distanciaMaxSeparacion:
        separacion !== defaultsActividad.distanciaMaxSeparacion ? separacion : undefined,
      toleranciaAtrasoMin: tolerancia !== defaultsActividad.toleranciaAtrasoMin ? tolerancia : undefined,
    }
  }

  const handleCrear = async () => {
    if (!nombre.trim()) {
      meshAlert('Campo requerido', 'El nombre del viaje es obligatorio.')
      editarPaso('cuando')
      return
    }

    const parametros = resolverParametros()
    if (parametros === 'invalido') {
      meshAlert(
        'Parámetros inválidos',
        `Velocidad ${RANGO_PARAMETROS.velocidadEsperada.min}–${RANGO_PARAMETROS.velocidadEsperada.max} km/h, separación ${RANGO_PARAMETROS.distanciaMaxSeparacion.min}–${RANGO_PARAMETROS.distanciaMaxSeparacion.max} m y tolerancia ${RANGO_PARAMETROS.toleranciaAtrasoMin.min}–${RANGO_PARAMETROS.toleranciaAtrasoMin.max} min.`
      )
      return
    }

    // La fecha pudo quedar en el pasado si el wizard quedó abierto un rato.
    if (!esFechaFutura(fecha)) {
      meshAlert('Fecha inválida', MSG_FECHA_PASADA)
      editarPaso('cuando')
      return
    }

    setGuardando(true)
    try {
      const userId = resolveBackendUserId(backendUserId)

      const viaje = await crearViaje(
        {
          nombre: nombre.trim(),
          esGrupal,
          grupoIds: esGrupal ? [...gruposSeleccionados] : [],
          amigoIds: esGrupal ? [...amigosSeleccionados] : [],
          tipoActividad,
          modo,
          fechaProgramada: fecha,
          rutaPlantillaId: plantillaId,
          repetir: repetirViajeId ? { viajeId: repetirViajeId, recorrido: recorridoRepetir } : null,
          ...parametros,
        },
        userId
      )

      if (conRecorrido) {
        router.replace({
          pathname: '/configurar-ruta/[viajeId]',
          params: { viajeId: viaje.id, userId },
        })
      } else {
        router.replace({
          pathname: '/viaje/[viajeId]',
          params: { viajeId: viaje.id, userId },
        })
      }
    } catch (e: unknown) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo crear el viaje.')
    } finally {
      setGuardando(false)
    }
  }

  // ---- Textos del resumen ----

  const textoInvitados = (() => {
    if (!esGrupal) return 'Individual'
    const partes: string[] = []
    if (gruposSeleccionados.size) partes.push(plural(gruposSeleccionados.size, 'grupo', 'grupos'))
    if (amigosSeleccionados.size) partes.push(plural(amigosSeleccionados.size, 'amigo', 'amigos'))
    return partes.length ? `Grupal · ${partes.join(' · ')}` : 'Grupal · sumás gente después por QR o link'
  })()

  const textoRecorrido = repetirViajeId
    ? `${recorridoRepetir === 'planificado' ? 'Lo planificado' : 'Lo que hiciste'} en esa sesión (lo podés ajustar)`
    : plantillaId
      ? 'Ruta de Mis rutas (la podés ajustar)'
      : conRecorrido
      ? 'Lo trazás después de crear el viaje'
      : 'Sin recorrido'

  // ---- Render por paso ----

  const etiquetaSiguiente = editandoDesdeResumen ? 'Listo' : 'Siguiente'

  let contenido: ReactNode
  let pie: ReactNode = null

  if (paso === 'actividad') {
    contenido = (
      <>
        <Text style={[styles.titulo, { color: theme.text }]}>¿Qué actividad?</Text>
        <PasoAyuda {...AYUDA_VIAJE_CREAR[0]!}>
          <ActividadGrid
            seleccionada={tipoActividad}
            onElegir={elegirActividad}
            // RN-070: desde Entrenar no se ofrece moto ni auto.
            deshabilitada={esEntrenamientoDeEntrada ? esMotorizado : undefined}
          />
        </PasoAyuda>
      </>
    )
  } else if (paso === 'cuando') {
    contenido = (
      <>
        <Text style={[styles.titulo, { color: theme.text }]}>¿Cuándo salen?</Text>
        <PasoAyuda {...AYUDA_VIAJE_CREAR[2]!}>
          <Pressable
            style={[
              styles.fechaBtn,
              { backgroundColor: theme.surface, borderColor: fechaInvalida ? theme.danger : theme.border },
            ]}
            onPress={abrirPicker}
            accessibilityRole="button"
            accessibilityLabel="Elegir fecha y hora"
          >
            <Feather name="calendar" size={22} color={fechaInvalida ? theme.danger : theme.accent} />
            <Text style={[styles.fechaTexto, { color: theme.text }]}>{formatearFechaHora(fecha)}</Text>
            <Feather name="edit-2" size={16} color={theme.textMute} />
          </Pressable>
        </PasoAyuda>
        {fechaInvalida && <Text style={[styles.error, { color: theme.danger }]}>{MSG_FECHA_PASADA}</Text>}
        {showPicker && (
          <DateTimePicker
            key={pickerMode}
            value={aCamposArg(esFechaFutura(fecha) ? fecha : ajustarSiQuedoEnPasado(fecha))}
            mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={ahoraEnCamposArg()}
            onChange={onChangeFecha}
          />
        )}
        {Platform.OS === 'ios' && showPicker && (
          <Btn variant="secondary" size="sm" onPress={() => setShowPicker(false)} style={styles.listoBtn}>
            Listo
          </Btn>
        )}

        <Text style={[styles.etiqueta, { color: theme.textDim }]}>Nombre del viaje</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor: nombreFocus ? theme.accent : theme.border,
              color: theme.text,
            },
          ]}
          placeholder="Ej: Vuelta al valle"
          placeholderTextColor={theme.textMute}
          value={nombre}
          onChangeText={setNombre}
          onFocus={() => setNombreFocus(true)}
          onBlur={() => setNombreFocus(false)}
          autoCapitalize="sentences"
          maxLength={100}
          returnKeyType="done"
        />
      </>
    )
    pie = (
      <Btn block size="xl" iconRight="arrow-right" disabled={fechaInvalida || !nombre.trim()} onPress={avanzar}>
        {etiquetaSiguiente}
      </Btn>
    )
  } else if (paso === 'recorrido') {
    contenido = (
      <>
        <Text style={[styles.titulo, { color: theme.text }]}>¿Ya tenés el recorrido?</Text>
        <View style={styles.lista}>
          <OpcionGrande
            icon="map"
            titulo="Trazar recorrido"
            detalle="Origen, destino y paradas. Lo armás apenas creás el viaje."
            activa={conRecorrido}
            onPress={() => {
              setConRecorrido(true)
              avanzar()
            }}
          />
          <OpcionGrande
            icon="clock"
            titulo="Después"
            detalle="Creás el viaje sin recorrido y lo agregás cuando quieras."
            activa={!conRecorrido}
            onPress={() => {
              setConRecorrido(false)
              avanzar()
            }}
          />
        </View>
      </>
    )
  } else if (paso === 'invitados') {
    contenido = (
      <>
        <Text style={[styles.titulo, { color: theme.text }]}>¿Con quién van?</Text>
        <PasoAyuda {...AYUDA_VIAJE_CREAR[1]!}>
          <View style={styles.fila2}>
            <OpcionGrande
              icon="user"
              titulo="Solo"
              detalle="Sin invitados"
              activa={!esGrupal}
              compacta
              onPress={() => {
                setEsGrupal(false)
                setGruposSeleccionados(new Set())
                setAmigosSeleccionados(new Set())
              }}
            />
            <OpcionGrande
              icon="users"
              titulo="En grupo"
              detalle="Grupos o amigos"
              activa={esGrupal}
              compacta
              onPress={() => setEsGrupal(true)}
            />
          </View>
        </PasoAyuda>

        {esGrupal && (
          <PasoAyuda {...AYUDA_VIAJE_CREAR[3]!}>
            <View style={styles.collapsibles}>
              <Text style={[styles.hint, { color: theme.textDim }]}>
                Cada persona recibe una invitación para confirmar. También podés sumar gente después por QR o
                link.
              </Text>
              {cargandoInvitables ? (
                <ActivityIndicator color={theme.accent} style={{ marginTop: 16 }} />
              ) : (
                <>
                  <Collapsible title="Grupos" icon="users" badge={gruposSeleccionados.size} defaultOpen>
                    {grupos.length === 0 ? (
                      <Text style={[styles.vacio, { color: theme.textMute }]}>
                        No tenés grupos. Creá uno en la pestaña Grupos.
                      </Text>
                    ) : (
                      grupos.map((g) => (
                        <FilaSeleccion
                          key={g.id}
                          titulo={g.nombre}
                          meta={`${g.mi_rol === 'lider' ? 'Líder' : 'Participante'} · invita al grupo entero`}
                          seleccionada={gruposSeleccionados.has(g.id)}
                          onPress={() => toggleGrupo(g.id)}
                        />
                      ))
                    )}
                  </Collapsible>

                  <Collapsible title="Amigos" icon="user-plus" badge={amigosSeleccionados.size}>
                    {amigos.length === 0 ? (
                      <Text style={[styles.vacio, { color: theme.textMute }]}>
                        No tenés amigos todavía. Agregá amigos desde tu perfil.
                      </Text>
                    ) : (
                      amigos.map((a) => (
                        <FilaSeleccion
                          key={a.id}
                          titulo={a.nombre}
                          meta={a.email}
                          seleccionada={amigosSeleccionados.has(a.id)}
                          onPress={() => toggleAmigo(a.id)}
                        />
                      ))
                    )}
                  </Collapsible>
                </>
              )}
            </View>
          </PasoAyuda>
        )}
      </>
    )
    pie = (
      <Btn block size="xl" iconRight="arrow-right" onPress={avanzar}>
        {etiquetaSiguiente}
      </Btn>
    )
  } else {
    contenido = (
      <>
        <Text style={[styles.titulo, { color: theme.text }]}>Revisá y creá</Text>

        <View style={[styles.tarjetaResumen, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <FilaResumen
            leading={<ActivityTile activity={tipoActividad} size={30} />}
            etiqueta="Actividad"
            valor={etiquetaActividad(tipoActividad)}
            onPress={recorridoDado ? undefined : () => editarPaso('actividad')}
          />
          <FilaResumen
            icon="calendar"
            etiqueta={nombre.trim() || 'Sin nombre'}
            valor={formatearFechaHora(fecha)}
            capitalizar
            onPress={() => editarPaso('cuando')}
          />
          <FilaResumen
            icon="map"
            etiqueta="Recorrido"
            valor={textoRecorrido}
            onPress={recorridoDado ? undefined : () => editarPaso('recorrido')}
          />
          <FilaResumen
            icon={esGrupal ? 'users' : 'user'}
            etiqueta="Con quién"
            valor={textoInvitados}
            onPress={() => editarPaso('invitados')}
            ultima
          />
        </View>

        {/* RN-065 (SCRUM-48): modo del viaje. */}
        <Text style={[styles.etiqueta, { color: theme.textDim }]}>Modo</Text>
        {repetirViajeId ? (
          // RN-066: una repetición siempre es un entrenamiento.
          <Text style={[styles.hint, { color: theme.textDim }]}>
            Entrenamiento. En el mapa vas a ver tu sesión anterior como fantasma.
          </Text>
        ) : (
          <>
            <SelectorModo modo={modo} onChange={setModo} puedeCompetir={puedeCompetir} motorizado={motorizado} />
            {!puedeCompetir ? (
              <Text style={[styles.hint, { color: theme.textDim }]}>
                {motorizado
                  ? 'En moto y auto no hay modo competitivo ni entrenamiento (seguridad vial).'
                  : 'El modo competitivo necesita un viaje en grupo.'}
              </Text>
            ) : null}
          </>
        )}

        {/* RN-025 (SCRUM-26): el líder ajusta los parámetros del grupo. */}
        <View style={styles.parametros}>
          <Collapsible title="Ajustar parámetros del grupo" icon="sliders">
            <Text style={[styles.hint, { color: theme.textDim }]}>
              {textoParametrosActividad(tipoActividad)} Si los dejás como están, el viaje usa los valores de la
              actividad.
            </Text>
            <Field
              label="Velocidad esperada (km/h)"
              leading="trending-up"
              keyboardType="decimal-pad"
              value={paramsEdit?.velocidad ?? String(defaultsActividad.velocidadEsperada)}
              onChangeText={(t) =>
                setParamsEdit((prev) => ({
                  velocidad: t,
                  separacion: prev?.separacion ?? String(defaultsActividad.distanciaMaxSeparacion),
                  tolerancia: prev?.tolerancia ?? String(defaultsActividad.toleranciaAtrasoMin),
                }))
              }
            />
            <Field
              label="Separación máxima del grupo (m)"
              leading="maximize-2"
              keyboardType="number-pad"
              value={paramsEdit?.separacion ?? String(defaultsActividad.distanciaMaxSeparacion)}
              onChangeText={(t) =>
                setParamsEdit((prev) => ({
                  velocidad: prev?.velocidad ?? String(defaultsActividad.velocidadEsperada),
                  separacion: t,
                  tolerancia: prev?.tolerancia ?? String(defaultsActividad.toleranciaAtrasoMin),
                }))
              }
            />
            <Field
              label="Tolerancia de atraso (min)"
              leading="clock"
              keyboardType="number-pad"
              value={paramsEdit?.tolerancia ?? String(defaultsActividad.toleranciaAtrasoMin)}
              onChangeText={(t) =>
                setParamsEdit((prev) => ({
                  velocidad: prev?.velocidad ?? String(defaultsActividad.velocidadEsperada),
                  separacion: prev?.separacion ?? String(defaultsActividad.distanciaMaxSeparacion),
                  tolerancia: t,
                }))
              }
            />
            {paramsEdit ? (
              <Pressable onPress={() => setParamsEdit(null)} hitSlop={6}>
                <Text style={[styles.hint, { color: theme.accent, marginTop: 4 }]}>
                  Volver a los valores de la actividad
                </Text>
              </Pressable>
            ) : null}
          </Collapsible>
        </View>
      </>
    )
    pie = (
      <Btn
        block
        size="xl"
        icon={conRecorrido ? 'map' : 'check'}
        onPress={() => void handleCrear()}
        disabled={guardando}
        loading={guardando}
      >
        {conRecorrido ? 'Crear y trazar recorrido' : 'Crear viaje'}
      </Btn>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title={repetirViajeId ? 'Repetir entrenamiento' : esEntrenamientoDeEntrada ? 'Planificar entrenamiento' : 'Planificar viaje'}
        sub={`Paso ${indicePaso + 1} de ${pasos.length}`}
        bordered={false}
        onBack={retroceder}
        right={PASOS_CON_AYUDA.includes(paso) ? <BotonAyuda /> : undefined}
      />
      <View style={styles.progreso}>
        {pasos.map((p, i) => (
          <View
            key={p}
            style={[styles.progresoTramo, { backgroundColor: i <= indicePaso ? theme.accent : theme.border }]}
          />
        ))}
      </View>

      {repetirViajeId && paso !== 'resumen' ? (
        <View style={[styles.aviso, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Feather name="repeat" size={18} color={theme.accent} />
          <Text style={[styles.avisoTexto, { color: theme.textDim }]}>
            Repetís {recorridoRepetir === 'planificado' ? 'la ruta planificada' : 'lo que hiciste'} en esa
            sesión ({etiquetaActividad(tipoActividad)}). Podés ajustarla después.
          </Text>
        </View>
      ) : null}

      {plantillaId && paso !== 'resumen' ? (
        <View style={[styles.aviso, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Feather name="map" size={18} color={theme.accent} />
          <Text style={[styles.avisoTexto, { color: theme.textDim }]}>
            Usás una ruta de Mis rutas ({etiquetaActividad(tipoActividad)}). Podés ajustarla después.
          </Text>
        </View>
      ) : null}

      <ScrollViewAyuda
        key={paso}
        style={styles.flex}
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        {contenido}
      </ScrollViewAyuda>

      {pie ? <View style={[styles.pie, { paddingBottom: insets.bottom + 16 }]}>{pie}</View> : null}
    </View>
  )
}

function OpcionGrande({
  icon,
  titulo,
  detalle,
  activa,
  compacta = false,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap
  titulo: string
  detalle: string
  activa: boolean
  compacta?: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: activa }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.opcion,
        compacta && styles.opcionCompacta,
        {
          backgroundColor: pressed || activa ? theme.accentWeak : theme.surface,
          borderColor: pressed || activa ? theme.accentLine : theme.border,
        },
      ]}
    >
      <Feather name={icon} size={compacta ? 26 : 30} color={activa ? theme.accent : theme.text} />
      <View style={compacta ? undefined : styles.flex}>
        <Text style={[styles.opcionTitulo, { color: activa ? theme.accent : theme.text }]}>{titulo}</Text>
        <Text style={[styles.opcionDetalle, { color: theme.textDim }]}>{detalle}</Text>
      </View>
    </Pressable>
  )
}

function FilaSeleccion({
  titulo,
  meta,
  seleccionada,
  onPress,
}: {
  titulo: string
  meta: string
  seleccionada: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: seleccionada }}
      style={[
        styles.filaSel,
        { backgroundColor: theme.surface2, borderColor: theme.border },
        seleccionada && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
      ]}
      onPress={onPress}
    >
      <View style={styles.flex}>
        <Text style={[styles.filaSelTitulo, { color: theme.text }]}>{titulo}</Text>
        <Text style={[styles.filaSelMeta, { color: theme.textDim }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Feather
        name={seleccionada ? 'check-circle' : 'circle'}
        size={22}
        color={seleccionada ? theme.accent : theme.textMute}
      />
    </Pressable>
  )
}

function FilaResumen({
  icon,
  leading,
  etiqueta,
  valor,
  capitalizar = false,
  ultima = false,
  onPress,
}: {
  icon?: keyof typeof Feather.glyphMap
  leading?: ReactNode
  etiqueta: string
  valor: string
  capitalizar?: boolean
  ultima?: boolean
  /** Sin `onPress` la fila es solo informativa (ej. lo que impone una plantilla). */
  onPress?: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Cambiar ${etiqueta}` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.filaResumen, !ultima && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
    >
      <View style={styles.filaResumenIcono}>
        {leading ?? <Feather name={icon ?? 'circle'} size={20} color={theme.accent} />}
      </View>
      <View style={styles.flex}>
        <Text style={[styles.filaResumenEtiqueta, { color: theme.textDim }]} numberOfLines={1}>
          {etiqueta}
        </Text>
        <Text
          style={[styles.filaResumenValor, { color: theme.text }, capitalizar && styles.capitalizar]}
          numberOfLines={2}
        >
          {valor}
        </Text>
      </View>
      {onPress ? <Feather name="edit-2" size={16} color={theme.textMute} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  progreso: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  progresoTramo: { flex: 1, height: 4, borderRadius: 2 },
  titulo: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  etiqueta: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginTop: 12 },
  hint: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 14 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  avisoTexto: { flex: 1, fontSize: 14, fontWeight: '600' },
  fechaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  fechaTexto: { flex: 1, fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  listoBtn: { alignSelf: 'flex-end' },
  input: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  lista: { gap: 12 },
  fila2: { flexDirection: 'row', gap: 12 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    minHeight: 110,
  },
  opcionCompacta: { flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: 16 },
  opcionTitulo: { fontSize: 18, fontWeight: '700' },
  opcionDetalle: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  collapsibles: { gap: 10, marginTop: 8 },
  filaSel: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  filaSelTitulo: { fontSize: 16, fontWeight: '600' },
  filaSelMeta: { fontSize: 13 },
  vacio: { fontSize: 14, paddingVertical: 4 },
  tarjetaResumen: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  filaResumen: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  filaResumenIcono: { width: 32, alignItems: 'center' },
  filaResumenEtiqueta: { fontSize: 13, fontWeight: '600' },
  filaResumenValor: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  capitalizar: { textTransform: 'capitalize' },
  parametros: { marginTop: 8 },
  pie: { paddingHorizontal: 16, paddingTop: 8 },
})
