import { useCallback, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import {
  listarInvitacionesViajePendientes,
  listarViajesPlanificados,
  responderInvitacionViaje,
  type InvitacionViajePendienteApi,
  type ViajePlanificadoApi,
} from '@/lib/viajesApi'

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function etiquetaActividad(tipo: string): string {
  const map: Record<string, string> = {
    moto: 'Moto',
    bici: 'Bici',
    running: 'Running',
    trekking: 'Trekking',
  }
  return map[tipo] ?? tipo
}

export default function ViajesScreen() {
  const { backendUserId, backendSyncing } = useAuth()
  const [viajes, setViajes] = useState<ViajePlanificadoApi[]>([])
  const [invitaciones, setInvitaciones] = useState<InvitacionViajePendienteApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null)

  const cargar = useCallback(
    async (esRefresh = false) => {
      if (backendSyncing) return

      let userId: string
      try {
        userId = resolveBackendUserId(backendUserId)
      } catch {
        setViajes([])
        setInvitaciones([])
        setCargando(false)
        setRefreshing(false)
        return
      }

      if (esRefresh) setRefreshing(true)
      else setCargando(true)

      try {
        const [planificados, pendientes] = await Promise.all([
          listarViajesPlanificados(userId),
          listarInvitacionesViajePendientes(userId),
        ])
        setViajes(planificados)
        setInvitaciones(pendientes)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudieron cargar los viajes.'
        if (!esRefresh) Alert.alert('Error', msg)
      } finally {
        setCargando(false)
        setRefreshing(false)
      }
    },
    [backendUserId, backendSyncing]
  )

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const responder = async (viajeId: string, accion: 'aceptar' | 'rechazar') => {
    let userId: string
    try {
      userId = resolveBackendUserId(backendUserId)
    } catch {
      Alert.alert('Error', 'No se pudo identificar tu usuario.')
      return
    }

    setRespondiendoId(viajeId)
    try {
      await responderInvitacionViaje(viajeId, accion, userId)
      await cargar(true)
      if (accion === 'aceptar') {
        Alert.alert('Listo', 'Confirmaste tu asistencia al viaje.')
        router.push(`/viaje/${viajeId}`)
      } else {
        Alert.alert('Listo', 'Rechazaste la invitación al viaje.')
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo responder.')
    } finally {
      setRespondiendoId(null)
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void cargar(true)}
          tintColor="#4a9eff"
        />
      }
    >
      <TouchableOpacity style={styles.botonCrear} onPress={() => router.push('/viaje/crear')}>
        <Text style={styles.botonCrearTexto}>+ Crear viaje</Text>
      </TouchableOpacity>

      {cargando ? (
        <ActivityIndicator color="#4a9eff" size="large" style={{ marginTop: 32 }} />
      ) : (
        <>
          {invitaciones.length > 0 && (
            <>
              <Text style={styles.seccionTitulo}>Invitaciones pendientes</Text>
              {invitaciones.map((inv) => (
                <View key={inv.viaje_id} style={styles.tarjeta}>
                  <Text style={styles.tarjetaTitulo}>{etiquetaActividad(inv.tipo_actividad)}</Text>
                  <Text style={styles.tarjetaMeta}>
                    {formatearFecha(inv.fecha_programada)} · {inv.creador.nombre}
                  </Text>
                  <View style={styles.filaAcciones}>
                    <TouchableOpacity
                      style={styles.botonAceptar}
                      disabled={respondiendoId === inv.viaje_id}
                      onPress={() => void responder(inv.viaje_id, 'aceptar')}
                    >
                      {respondiendoId === inv.viaje_id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.botonAccionTexto}>Aceptar</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.botonRechazar}
                      disabled={respondiendoId === inv.viaje_id}
                      onPress={() => void responder(inv.viaje_id, 'rechazar')}
                    >
                      <Text style={styles.botonRechazarTexto}>Rechazar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          <Text style={styles.seccionTitulo}>Viajes planificados</Text>
          {viajes.length === 0 ? (
            <Text style={styles.vacio}>
              No tenés viajes planificados. Creá uno para configurar la ruta e invitar participantes.
            </Text>
          ) : (
            viajes.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={styles.tarjeta}
                onPress={() => router.push(`/viaje/${v.id}`)}
              >
                <Text style={styles.tarjetaTitulo}>{etiquetaActividad(v.tipo_actividad)}</Text>
                <Text style={styles.tarjetaMeta}>{formatearFecha(v.fecha_programada)}</Text>
                <Text style={styles.estadoBadge}>
                  {v.mi_estado === 'creador'
                    ? 'Creador'
                    : v.mi_estado === 'confirmado'
                      ? 'Confirmado'
                      : v.mi_estado === 'pendiente'
                        ? 'Invitación pendiente'
                        : v.mi_estado ?? ''}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 24, paddingBottom: 40, gap: 10 },
  botonCrear: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonCrearTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  seccionTitulo: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 20 },
  vacio: { color: '#666', fontSize: 14, lineHeight: 20, marginTop: 8 },
  tarjeta: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 8,
    gap: 6,
  },
  tarjetaTitulo: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tarjetaMeta: { color: '#888', fontSize: 13 },
  estadoBadge: { color: '#4a9eff', fontSize: 12, fontWeight: '600', marginTop: 4 },
  filaAcciones: { flexDirection: 'row', gap: 10, marginTop: 10 },
  botonAceptar: {
    flex: 1,
    backgroundColor: '#4a9eff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  botonAccionTexto: { color: '#fff', fontWeight: '600' },
  botonRechazar: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  botonRechazarTexto: { color: '#ccc', fontWeight: '600' },
})
