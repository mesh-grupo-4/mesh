import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator, 
  ScrollView,
  Pressable,
  Platform,
} from 'react-native'
import { meshAlert } from '@/lib/meshAlert';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Feather } from '@expo/vector-icons'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { listarGrupos, type GrupoListItemApi } from '@/lib/gruposApi'
import { listarAmigos, type AmigoApi } from '@/lib/amistadesApi'
import {
  crearViaje,
  listarViajesPlanificados,
  listarViajesFinalizados,
  type ParametrosViajeInput,
  type TipoActividadApi,
} from '@/lib/viajesApi'
import { ajustarSiQuedoEnPasado, esFechaFutura } from '@/lib/fechaProgramada'
import { aCamposArg, ahoraEnCamposArg, desdeCamposArg, formatearEnArg } from '@/lib/tiempoArg'
import {
  ACTIVIDADES,
  RANGO_PARAMETROS,
  actividadInicialDesdePerfil,
  parametrosPorActividad,
  textoParametrosActividad,
} from '@/lib/activityDefaults'
import { Btn, ActivityTile, Field, useTheme } from '@/components/MeshUI'
import { Collapsible } from '@/components/Collapsible'

const MSG_FECHA_PASADA = 'La fecha y hora programadas deben ser futuras.'

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

export default function CrearViajeScreen() {
  const theme = useTheme()
  const { backendUserId, profile } = useAuth()
  const params = useLocalSearchParams<{
    plantillaId?: string | string[]
    tipoActividad?: string | string[]
  }>()
  const plantillaId = useMemo(() => {
    const p = params.plantillaId
    return (Array.isArray(p) ? p[0] : p)?.trim() || null
  }, [params.plantillaId])
  const tipoDesdePlantilla = useMemo(() => {
    const t = params.tipoActividad
    const raw = (Array.isArray(t) ? t[0] : t)?.trim()
    if (raw === 'moto' || raw === 'bici' || raw === 'running' || raw === 'trekking' || raw === 'otro') return raw
    return null
  }, [params.tipoActividad])

  const [grupos, setGrupos] = useState<GrupoListItemApi[]>([])
  const [amigos, setAmigos] = useState<AmigoApi[]>([])
  const [cargandoInvitables, setCargandoInvitables] = useState(true)
  const [nombre, setNombre] = useState('')
  const [nombreFocus, setNombreFocus] = useState(false)
  const [tipoActividad, setTipoActividad] = useState<TipoActividadApi>(() =>
    tipoDesdePlantilla ?? actividadInicialDesdePerfil(profile?.actividadPreferida)
  )
  const [esGrupal, setEsGrupal] = useState(true)
  // RN-065: entrenamiento muestra ritmo en vivo y métricas de sesión al cerrar.
  const [modo, setModo] = useState<'recreativo' | 'entrenamiento' | 'competitivo'>('recreativo')
  // RN-071 / RN-070: competir exige grupo y nunca moto.
  const puedeCompetir = esGrupal && tipoActividad !== 'moto'
  useEffect(() => {
    if (!puedeCompetir && modo === 'competitivo') setModo('recreativo')
  }, [puedeCompetir, modo])
  const [gruposSeleccionados, setGruposSeleccionados] = useState<Set<string>>(new Set())
  const [amigosSeleccionados, setAmigosSeleccionados] = useState<Set<string>>(new Set())
  const [fecha, setFecha] = useState<Date>(fechaPorDefecto)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date')
  const [guardando, setGuardando] = useState(false)
  // Con plantilla ya hay una ruta precargada: se va directo a revisarla/ajustarla.
  const [conRecorrido, setConRecorrido] = useState(() => Boolean(plantillaId))
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
      const [dataGrupos, dataAmigos] = await Promise.all([
        listarGrupos(userId),
        listarAmigos(userId),
      ])
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

    if (!esFechaFutura(fecha)) {
      meshAlert('Fecha inválida', MSG_FECHA_PASADA)
      return
    }

    if (esGrupal && gruposSeleccionados.size === 0 && amigosSeleccionados.size === 0) {
      meshAlert(
        'Invitados opcionales',
        'Podés crear el viaje grupal sin invitar a nadie y sumar gente después por QR o link.'
      )
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
          ...parametros,
        },
        userId
      )

      const msg =
        viaje.invitaciones_enviadas && viaje.invitaciones_enviadas > 0
          ? `Viaje creado. Se enviaron ${viaje.invitaciones_enviadas} invitaciones pendientes.`
          : viaje.ruta_precargada
            ? 'Viaje creado con la ruta de tu plantilla. Podés ajustarla antes de iniciar.'
            : 'Viaje creado correctamente.'

      meshAlert('Listo', msg)
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Sin este título el header del Stack muestra el nombre de la ruta ("crear").
          No lo ocultamos como en `live.tsx` porque esta pantalla no tiene botón de volver propio. */}
      <Stack.Screen options={{ title: 'Nuevo viaje' }} />

      {plantillaId ? (
        <View
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Feather name="map" size={18} color={theme.accent} />
          <Text style={{ color: theme.textDim, flex: 1, fontWeight: '600', fontSize: 13 }}>
            Vas a crear el viaje con una ruta de Mis rutas. Podés ajustarla después.
          </Text>
        </View>
      ) : null}

      <Text style={[styles.seccion, styles.seccionPrimera, { color: theme.text }]}>
        Nombre del viaje
      </Text>
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
        editable={!guardando}
      />

      <Text style={[styles.seccion, { color: theme.text }]}>Fecha programada</Text>
      <Pressable
        style={[
          styles.fechaBtn,
          {
            backgroundColor: theme.surface,
            borderColor: fechaInvalida ? theme.danger : theme.border,
          },
        ]}
        onPress={abrirPicker}
        disabled={guardando}
      >
        <Feather name="calendar" size={18} color={fechaInvalida ? theme.danger : theme.accent} />
        <Text style={[styles.fechaTexto, { color: theme.text }]}>{formatearFechaHora(fecha)}</Text>
        <Feather name="edit-2" size={15} color={theme.textMute} />
      </Pressable>
      {fechaInvalida && (
        <Text style={[styles.fechaError, { color: theme.danger }]}>{MSG_FECHA_PASADA}</Text>
      )}
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

      <Text style={[styles.seccion, { color: theme.text }]}>Modo de Actividad</Text>
      <View style={styles.activityList}>
        {ACTIVIDADES.map((a) => {
          const isActive = tipoActividad === a.id
          return (
            <Pressable
              key={a.id}
              onPress={() => {
                setTipoActividad(a.id)
                // Cambiar de actividad vuelve a los defaults: los ajustes eran para la otra.
                setParamsEdit(null)
              }}
              style={[
                styles.activityItem,
                a.id === 'otro' && styles.activityItemFull,
                {
                  backgroundColor: isActive ? theme.accentWeak : theme.surface,
                  borderColor: isActive ? theme.accentLine : theme.border,
                },
              ]}
            >
              <ActivityTile activity={a.id} size={34} />
              <Text
                style={[
                  styles.activityLabel,
                  a.id === 'otro' && styles.activityLabelFull,
                  { color: theme.text },
                ]}
              >
                {a.label}
              </Text>
              {isActive ? (
                <Feather name="check" size={16} color={theme.accent} style={styles.checkIcon} />
              ) : null}
            </Pressable>
          )
        })}
      </View>
      <Text style={[styles.paramHint, { color: theme.textDim }]}>
        {textoParametrosActividad(tipoActividad)}
      </Text>

      {/* RN-025 (SCRUM-26): el líder ajusta los parámetros del grupo. */}
      <Collapsible title="Ajustar parámetros del grupo" icon="sliders">
        <Text style={[styles.paramHint, { color: theme.textDim, marginTop: 0 }]}>
          Si los dejás como están, el viaje usa los valores de la actividad.
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
            <Text style={[styles.paramHint, { color: theme.accent, marginTop: 4 }]}>
              Volver a los valores de la actividad
            </Text>
          </Pressable>
        ) : null}
      </Collapsible>

      <Text style={[styles.seccion, { color: theme.text }]}>Modalidad</Text>
      <View style={styles.filaModalidad}>
        <Pressable
          style={[
            styles.opcionModalidad,
            { backgroundColor: theme.surface, borderColor: theme.border },
            !esGrupal && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
          ]}
          onPress={() => {
            setEsGrupal(false)
            setGruposSeleccionados(new Set())
            setAmigosSeleccionados(new Set())
          }}
        >
          <Text style={[styles.opcionTitulo, { color: !esGrupal ? theme.accent : theme.text }]}>
            Individual
          </Text>
          <Text style={[styles.opcionHint, { color: theme.textDim }]}>Sin invitados iniciales</Text>
        </Pressable>
        <Pressable
          style={[
            styles.opcionModalidad,
            { backgroundColor: theme.surface, borderColor: theme.border },
            esGrupal && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
          ]}
          onPress={() => setEsGrupal(true)}
        >
          <Text style={[styles.opcionTitulo, { color: esGrupal ? theme.accent : theme.text }]}>
            Grupal
          </Text>
          <Text style={[styles.opcionHint, { color: theme.textDim }]}>Invitar grupos / amigos</Text>
        </Pressable>
      </View>

      {/* RN-065 (SCRUM-48): modo del viaje. Competitivo llega con E07. */}
      <Text style={[styles.seccion, { color: theme.text }]}>Modo</Text>
      <View style={styles.filaModalidad}>
        <Pressable
          style={[
            styles.opcionModalidad,
            { backgroundColor: theme.surface, borderColor: theme.border },
            modo === 'recreativo' && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
          ]}
          onPress={() => setModo('recreativo')}
        >
          <Text style={[styles.opcionTitulo, { color: modo === 'recreativo' ? theme.accent : theme.text }]}>
            Recreativo
          </Text>
          <Text style={[styles.opcionHint, { color: theme.textDim }]}>Navegación y alertas, sin comparaciones</Text>
        </Pressable>
        <Pressable
          style={[
            styles.opcionModalidad,
            { backgroundColor: theme.surface, borderColor: theme.border },
            modo === 'entrenamiento' && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
          ]}
          onPress={() => setModo('entrenamiento')}
        >
          <Text style={[styles.opcionTitulo, { color: modo === 'entrenamiento' ? theme.accent : theme.text }]}>
            Entrenamiento
          </Text>
          <Text style={[styles.opcionHint, { color: theme.textDim }]}>
            {tipoActividad === 'moto' ? 'Splits y evolución de tus sesiones' : 'Ritmo en vivo, splits y evolución'}
          </Text>
        </Pressable>
        {puedeCompetir ? (
          <Pressable
            style={[
              styles.opcionModalidad,
              { backgroundColor: theme.surface, borderColor: theme.border },
              modo === 'competitivo' && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
            ]}
            onPress={() => setModo('competitivo')}
          >
            <Text style={[styles.opcionTitulo, { color: modo === 'competitivo' ? theme.accent : theme.text }]}>
              Competitivo
            </Text>
            <Text style={[styles.opcionHint, { color: theme.textDim }]}>Clasificación en vivo y recap con puestos</Text>
          </Pressable>
        ) : null}
      </View>
      {tipoActividad === 'moto' ? (
        <Text style={[styles.paramHint, { color: theme.textDim }]}>
          En moto no hay modo competitivo ni comparaciones de velocidad (seguridad vial).
        </Text>
      ) : null}

      {plantillaId ? null : (
        <>
          <Text style={[styles.seccion, { color: theme.text }]}>Recorrido</Text>
          <View style={styles.filaModalidad}>
            <Pressable
              style={[
                styles.opcionModalidad,
                { backgroundColor: theme.surface, borderColor: theme.border },
                !conRecorrido && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
              ]}
              onPress={() => setConRecorrido(false)}
            >
              <Text style={[styles.opcionTitulo, { color: !conRecorrido ? theme.accent : theme.text }]}>
                Sin recorrido
              </Text>
              <Text style={[styles.opcionHint, { color: theme.textDim }]}>
                Lo agregás después si hace falta
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.opcionModalidad,
                { backgroundColor: theme.surface, borderColor: theme.border },
                conRecorrido && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
              ]}
              onPress={() => setConRecorrido(true)}
            >
              <Text style={[styles.opcionTitulo, { color: conRecorrido ? theme.accent : theme.text }]}>
                Con recorrido
              </Text>
              <Text style={[styles.opcionHint, { color: theme.textDim }]}>
                Trazá origen, destino y paradas
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {esGrupal && (
        <>
          <Text style={[styles.seccion, { color: theme.text }]}>A quién invitar</Text>
          <Text style={[styles.hint, { color: theme.textDim }]}>
            Cada persona recibe una invitación para confirmar.
          </Text>

          {cargandoInvitables ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 16 }} />
          ) : (
            <View style={styles.collapsibles}>
              <Collapsible
                title="Grupos"
                icon="users"
                badge={gruposSeleccionados.size}
                defaultOpen
              >
                {grupos.length === 0 ? (
                  <Text style={[styles.vacio, { color: theme.textMute }]}>
                    No tenés grupos. Creá uno en la pestaña Grupos.
                  </Text>
                ) : (
                  grupos.map((g) => {
                    const sel = gruposSeleccionados.has(g.id)
                    return (
                      <Pressable
                        key={g.id}
                        style={[
                          styles.fila,
                          { backgroundColor: theme.surface2, borderColor: theme.border },
                          sel && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
                        ]}
                        onPress={() => toggleGrupo(g.id)}
                      >
                        <View style={styles.filaInfo}>
                          <Text style={[styles.filaNombre, { color: theme.text }]}>{g.nombre}</Text>
                          <Text style={[styles.filaMeta, { color: theme.textDim }]}>
                            {g.mi_rol === 'lider' ? 'Líder' : 'Participante'} · invita al grupo entero
                          </Text>
                        </View>
                        <Feather
                          name={sel ? 'check-circle' : 'circle'}
                          size={20}
                          color={sel ? theme.accent : theme.textMute}
                        />
                      </Pressable>
                    )
                  })
                )}
              </Collapsible>

              <Collapsible title="Amigos" icon="user-plus" badge={amigosSeleccionados.size}>
                {amigos.length === 0 ? (
                  <Text style={[styles.vacio, { color: theme.textMute }]}>
                    No tenés amigos todavía. Agregá amigos desde tu perfil.
                  </Text>
                ) : (
                  amigos.map((a) => {
                    const sel = amigosSeleccionados.has(a.id)
                    return (
                      <Pressable
                        key={a.id}
                        style={[
                          styles.fila,
                          { backgroundColor: theme.surface2, borderColor: theme.border },
                          sel && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
                        ]}
                        onPress={() => toggleAmigo(a.id)}
                      >
                        <View style={styles.filaInfo}>
                          <Text style={[styles.filaNombre, { color: theme.text }]}>{a.nombre}</Text>
                          <Text style={[styles.filaMeta, { color: theme.textDim }]} numberOfLines={1}>
                            {a.email}
                          </Text>
                        </View>
                        <Feather
                          name={sel ? 'check-circle' : 'circle'}
                          size={20}
                          color={sel ? theme.accent : theme.textMute}
                        />
                      </Pressable>
                    )
                  })
                )}
              </Collapsible>
            </View>
          )}
        </>
      )}

      <Btn
        block
        size="lg"
        onPress={() => void handleCrear()}
        disabled={guardando || fechaInvalida}
        loading={guardando}
        icon={conRecorrido ? 'map' : 'check'}
        style={{ marginTop: 24 }}
      >
        Crear viaje planificado
      </Btn>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, gap: 10 },
  hint: { fontSize: 14, lineHeight: 20 },
  seccion: { fontSize: 17, fontWeight: '600', marginTop: 16 },
  seccionPrimera: { marginTop: 0 },
  activityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginTop: 8,
  },
  activityItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 11,
    borderWidth: 1.2,
  },
  activityItemFull: {
    width: '100%',
    justifyContent: 'center',
  },
  activityLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  activityLabelFull: {
    flex: 0,
  },
  checkIcon: { marginLeft: 2 },
  paramHint: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  filaModalidad: { flexDirection: 'row', gap: 10, marginTop: 8 },
  opcionModalidad: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  opcionTitulo: { fontSize: 15, fontWeight: '600' },
  opcionHint: { fontSize: 12 },
  fechaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  fechaTexto: { flex: 1, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  fechaError: { fontSize: 13, marginTop: 4 },
  listoBtn: { alignSelf: 'flex-end', marginTop: 8 },
  collapsibles: { gap: 10, marginTop: 8 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  filaInfo: { flex: 1, gap: 2 },
  filaNombre: { fontSize: 15, fontWeight: '600' },
  filaMeta: { fontSize: 12.5 },
  vacio: { fontSize: 14, paddingVertical: 4 },
  input: {
    borderRadius: 10,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 8,
  },
})
