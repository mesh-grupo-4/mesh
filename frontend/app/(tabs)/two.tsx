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
import { Btn, useTheme } from '@/components/MeshUI'
import { etiquetaActividad } from '@/lib/activityDefaults'
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

export default function ViajesScreen() {
  const theme = useTheme()
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
        router.push({ pathname: '/viaje/[viajeId]', params: { viajeId } })
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
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void cargar(true)}
          tintColor={theme.accent}
        />
      }
    >
      <Btn block size="lg" icon="plus" onPress={() => router.push('/viaje/crear')}>
        Crear viaje
      </Btn>

      {cargando ? (
        <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 32 }} />
      ) : (
        <>
          {invitaciones.length > 0 && (
            <>
              <Text style={[styles.seccionTitulo, { color: theme.text }]}>Invitaciones pendientes</Text>
              {invitaciones.map((inv) => (
                <View
                  key={inv.viaje_id}
                  style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={[styles.tarjetaTitulo, { color: theme.text }]}>
                    {inv.nombre ?? etiquetaActividad(inv.tipo_actividad)}
                  </Text>
                  <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
                    {formatearFecha(inv.fecha_programada)} · {inv.creador.nombre}
                  </Text>
                  {inv.grupo_origen && (
                    <Text style={[styles.tarjetaGrupo, { color: theme.accent }]}>
                      Grupo: {inv.grupo_origen.nombre}
                    </Text>
                  )}
                  <View style={styles.filaAcciones}>
                    <Btn
                      size="sm"
                      style={styles.flex1}
                      loading={respondiendoId === inv.viaje_id}
                      disabled={respondiendoId === inv.viaje_id}
                      onPress={() => void responder(inv.viaje_id, 'aceptar')}
                    >
                      Aceptar
                    </Btn>
                    <Btn
                      variant="secondary"
                      size="sm"
                      style={styles.flex1}
                      disabled={respondiendoId === inv.viaje_id}
                      onPress={() => void responder(inv.viaje_id, 'rechazar')}
                    >
                      Rechazar
                    </Btn>
                  </View>
                </View>
              ))}
            </>
          )}

          <Text style={[styles.seccionTitulo, { color: theme.text }]}>Viajes planificados</Text>
          {viajes.length === 0 ? (
            <Text style={[styles.vacio, { color: theme.textMute }]}>
              No tenés viajes planificados. Creá uno para configurar la ruta e invitar participantes.
            </Text>
          ) : (
            viajes.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push({ pathname: '/viaje/[viajeId]', params: { viajeId: v.id } })}
              >
                <View style={styles.tarjetaHeader}>
                  <Text style={[styles.tarjetaTitulo, { color: theme.text }]} numberOfLines={1}>
                    {v.nombre ?? etiquetaActividad(v.tipo_actividad)}
                  </Text>
                  <Text style={[styles.tarjetaActividad, { color: theme.textDim }]}>
                    {etiquetaActividad(v.tipo_actividad)}
                  </Text>
                </View>
                <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
                  {formatearFecha(v.fecha_programada)}
                </Text>
                <Text style={[styles.estadoBadge, { color: theme.accent }]}>
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
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 40, gap: 10 },
  flex1: { flex: 1 },
  seccionTitulo: { fontSize: 18, fontWeight: '600', marginTop: 20 },
  vacio: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  tarjeta: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
  },
  tarjetaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tarjetaTitulo: { flex: 1, fontSize: 16, fontWeight: '600' },
  tarjetaActividad: { fontSize: 13, fontWeight: '600' },
  tarjetaMeta: { fontSize: 13 },
  tarjetaGrupo: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  estadoBadge: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  filaAcciones: { flexDirection: 'row', gap: 10, marginTop: 10 },
})
