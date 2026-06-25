import { useCallback, useState } from 'react'
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
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { listarGrupos, type GrupoListItemApi } from '@/lib/gruposApi'
import { listarAmigos, type AmigoApi } from '@/lib/amistadesApi'
import { crearViaje, type TipoActividadApi } from '@/lib/viajesApi'
import {
  ACTIVIDADES,
  actividadInicialDesdePerfil,
  textoParametrosActividad,
} from '@/lib/activityDefaults'
import { Btn, ActivityTile, useTheme } from '@/components/MeshUI'
import { Collapsible } from '@/components/Collapsible'

function fechaPorDefecto(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(9, 0, 0, 0)
  return d
}

function formatearFechaHora(d: Date): string {
  return d.toLocaleString('es-AR', {
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
  const [grupos, setGrupos] = useState<GrupoListItemApi[]>([])
  const [amigos, setAmigos] = useState<AmigoApi[]>([])
  const [cargandoInvitables, setCargandoInvitables] = useState(true)
  const [nombre, setNombre] = useState('')
  const [nombreFocus, setNombreFocus] = useState(false)
  const [tipoActividad, setTipoActividad] = useState<TipoActividadApi>(() =>
    actividadInicialDesdePerfil(profile?.actividadPreferida)
  )
  const [esGrupal, setEsGrupal] = useState(true)
  const [gruposSeleccionados, setGruposSeleccionados] = useState<Set<string>>(new Set())
  const [amigosSeleccionados, setAmigosSeleccionados] = useState<Set<string>>(new Set())
  const [fecha, setFecha] = useState<Date>(fechaPorDefecto)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date')
  const [guardando, setGuardando] = useState(false)

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

    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        const merged = new Date(fecha)
        merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate())
        setFecha(merged)
        setPickerMode('time')
        // el picker sigue abierto para elegir la hora
      } else {
        const merged = new Date(fecha)
        merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
        setFecha(merged)
        setShowPicker(false)
      }
    } else {
      // iOS: modo datetime en una sola pasada
      setFecha(selected)
    }
  }

  const handleCrear = async () => {
    if (!nombre.trim()) {
      meshAlert('Campo requerido', 'El nombre del viaje es obligatorio.')
      return
    }

    if (fecha.getTime() <= Date.now()) {
      meshAlert('Fecha inválida', 'La fecha programada debe ser futura.')
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
          fechaProgramada: fecha,
        },
        userId
      )

      const msg =
        viaje.invitaciones_enviadas && viaje.invitaciones_enviadas > 0
          ? `Viaje creado. Se enviaron ${viaje.invitaciones_enviadas} invitaciones pendientes.`
          : 'Viaje creado correctamente.'

      meshAlert('Listo', msg)
      router.replace({
        pathname: '/configurar-ruta/[viajeId]',
        params: { viajeId: viaje.id, userId },
      })
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
      <Text style={[styles.titulo, { color: theme.text }]}>Nuevo viaje</Text>
      <Text style={[styles.hint, { color: theme.textDim }]}>
        Elegí la actividad, la fecha y, si querés, grupos o amigos para invitar (RN-028).
      </Text>

      <Text style={[styles.seccion, { color: theme.text }]}>Nombre del viaje</Text>
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
        style={[styles.fechaBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={abrirPicker}
        disabled={guardando}
      >
        <Feather name="calendar" size={18} color={theme.accent} />
        <Text style={[styles.fechaTexto, { color: theme.text }]}>{formatearFechaHora(fecha)}</Text>
        <Feather name="edit-2" size={15} color={theme.textMute} />
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={fecha}
          mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={new Date()}
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
              onPress={() => setTipoActividad(a.id)}
              style={[
                styles.activityItem,
                {
                  backgroundColor: isActive ? theme.accentWeak : theme.surface,
                  borderColor: isActive ? theme.accentLine : theme.border,
                },
              ]}
            >
              <ActivityTile activity={a.id} />
              <Text style={[styles.activityLabel, { color: theme.text }]}>{a.label}</Text>
              {isActive ? (
                <Feather name="check" size={20} color={theme.accent} style={styles.checkIcon} />
              ) : null}
            </Pressable>
          )
        })}
      </View>
      <Text style={[styles.paramHint, { color: theme.textDim }]}>
        {textoParametrosActividad(tipoActividad)}
      </Text>

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

      {esGrupal && (
        <>
          <Text style={[styles.seccion, { color: theme.text }]}>A quién invitar</Text>
          <Text style={[styles.hint, { color: theme.textDim }]}>
            Cada persona recibe una invitación para confirmar (RN-029).
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
        disabled={guardando}
        loading={guardando}
        icon="map"
        style={{ marginTop: 24 }}
      >
        Crear viaje planificado
      </Btn>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 40, gap: 10 },
  titulo: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  hint: { fontSize: 14, lineHeight: 20 },
  seccion: { fontSize: 17, fontWeight: '600', marginTop: 16 },
  activityList: { gap: 11, marginTop: 8 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.2,
  },
  activityLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 14,
  },
  checkIcon: { marginRight: 4 },
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
