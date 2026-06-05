import { useCallback, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { listarGrupos, type GrupoListItemApi } from '@/lib/gruposApi'
import { crearViaje, type TipoActividadApi } from '@/lib/viajesApi'

const ACTIVIDADES: { id: TipoActividadApi; label: string }[] = [
  { id: 'moto', label: 'Moto' },
  { id: 'bici', label: 'Bici' },
  { id: 'running', label: 'Running' },
  { id: 'trekking', label: 'Trekking' },
]

export default function CrearViajeScreen() {
  const { backendUserId } = useAuth()
  const [grupos, setGrupos] = useState<GrupoListItemApi[]>([])
  const [cargandoGrupos, setCargandoGrupos] = useState(true)
  const [nombre, setNombre] = useState('')
  const [tipoActividad, setTipoActividad] = useState<TipoActividadApi>('bici')
  const [esGrupal, setEsGrupal] = useState(true)
  const [gruposSeleccionados, setGruposSeleccionados] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)

  const cargarGrupos = useCallback(async () => {
    setCargandoGrupos(true)
    try {
      const userId = resolveBackendUserId(backendUserId)
      const data = await listarGrupos(userId)
      setGrupos(data)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudieron cargar los grupos.')
    } finally {
      setCargandoGrupos(false)
    }
  }, [backendUserId])

  useFocusEffect(
    useCallback(() => {
      void cargarGrupos()
    }, [cargarGrupos])
  )

  const toggleGrupo = (id: string) => {
    setGruposSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCrear = async () => {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre del viaje es obligatorio.')
      return
    }

    if (esGrupal && gruposSeleccionados.size === 0) {
      Alert.alert(
        'Grupos opcionales',
        'Podés crear el viaje grupal sin grupos y sumar gente después por QR o link.'
      )
    }

    setGuardando(true)
    try {
      const userId = resolveBackendUserId(backendUserId)
      const fecha = new Date()
      fecha.setDate(fecha.getDate() + 7)
      fecha.setHours(9, 0, 0, 0)

      const viaje = await crearViaje(
        {
          nombre: nombre.trim(),
          esGrupal,
          grupoIds: esGrupal ? [...gruposSeleccionados] : [],
          tipoActividad,
          fechaProgramada: fecha,
        },
        userId
      )

      const msg =
        viaje.invitaciones_enviadas && viaje.invitaciones_enviadas > 0
          ? `Viaje creado. Se enviaron ${viaje.invitaciones_enviadas} invitaciones pendientes.`
          : 'Viaje creado correctamente.'

      Alert.alert('Listo', msg)
      router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId: viaje.id } })
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo crear el viaje.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.titulo}>Nuevo viaje</Text>
        <Text style={styles.hint}>
          Elegí la actividad y, si querés, grupos para invitar en bloque (RN-028).
        </Text>

        <Text style={styles.seccion}>Nombre del viaje</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Vuelta al valle"
          placeholderTextColor="#666"
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="sentences"
          maxLength={100}
          editable={!guardando}
        />

        <Text style={styles.seccion}>Tipo de actividad</Text>
        <View style={styles.chips}>
          {ACTIVIDADES.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[styles.chip, tipoActividad === a.id && styles.chipActivo]}
              onPress={() => setTipoActividad(a.id)}
            >
              <Text style={[styles.chipTexto, tipoActividad === a.id && styles.chipTextoActivo]}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.seccion}>Modalidad</Text>
        <View style={styles.filaModalidad}>
          <TouchableOpacity
            style={[styles.opcionModalidad, !esGrupal && styles.opcionActiva]}
            onPress={() => {
              setEsGrupal(false)
              setGruposSeleccionados(new Set())
            }}
          >
            <Text style={styles.opcionTitulo}>Individual</Text>
            <Text style={styles.opcionHint}>Sin invitados iniciales</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.opcionModalidad, esGrupal && styles.opcionActiva]}
            onPress={() => setEsGrupal(true)}
          >
            <Text style={styles.opcionTitulo}>Grupal</Text>
            <Text style={styles.opcionHint}>Invitar por grupos / QR</Text>
          </TouchableOpacity>
        </View>

        {esGrupal && (
          <>
            <Text style={styles.seccion}>Grupos para invitar</Text>
            <Text style={styles.hint}>
              Solo grupos donde sos miembro. Cada persona recibe una invitación para confirmar (RN-029).
            </Text>
            {cargandoGrupos ? (
              <ActivityIndicator color="#4a9eff" style={{ marginTop: 16 }} />
            ) : grupos.length === 0 ? (
              <Text style={styles.vacio}>No tenés grupos. Creá uno en la pestaña Grupos.</Text>
            ) : (
              grupos.map((g) => {
                const sel = gruposSeleccionados.has(g.id)
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.filaGrupo, sel && styles.filaGrupoSel]}
                    onPress={() => toggleGrupo(g.id)}
                  >
                    <Text style={styles.grupoNombre}>{g.nombre}</Text>
                    <Text style={styles.grupoRol}>{g.mi_rol === 'lider' ? 'Líder' : 'Participante'}</Text>
                  </TouchableOpacity>
                )
              })
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.botonCrear, guardando && styles.botonDisabled]}
          onPress={() => void handleCrear()}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonCrearTexto}>Crear viaje planificado</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 24, paddingBottom: 40, gap: 10 },
  titulo: { color: '#fff', fontSize: 24, fontWeight: '700' },
  hint: { color: '#888', fontSize: 14, lineHeight: 20 },
  seccion: { color: '#fff', fontSize: 17, fontWeight: '600', marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1e1e1e',
  },
  chipActivo: { borderColor: '#4a9eff', backgroundColor: '#1a3a5c' },
  chipTexto: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  chipTextoActivo: { color: '#4a9eff' },
  filaModalidad: { flexDirection: 'row', gap: 10, marginTop: 8 },
  opcionModalidad: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1e1e1e',
    gap: 4,
  },
  opcionActiva: { borderColor: '#4a9eff', backgroundColor: '#1a3a5c' },
  opcionTitulo: { color: '#fff', fontSize: 15, fontWeight: '600' },
  opcionHint: { color: '#888', fontSize: 12 },
  filaGrupo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1e1e1e',
    marginTop: 8,
  },
  filaGrupoSel: { borderColor: '#4a9eff', backgroundColor: '#152535' },
  grupoNombre: { color: '#fff', fontSize: 15, fontWeight: '600' },
  grupoRol: { color: '#888', fontSize: 13 },
  vacio: { color: '#666', fontSize: 14, marginTop: 12 },
  botonCrear: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  botonDisabled: { opacity: 0.6 },
  botonCrearTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    marginTop: 8,
  },
})
