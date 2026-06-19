import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { Avatar, Badge, Btn, useTheme } from '@/components/MeshUI'
import { etiquetaActividad } from '@/lib/activityDefaults'
import {
  obtenerEstadisticasUsuario,
  obtenerViajeEnCurso,
  type EstadisticasUsuarioApi,
  type ViajeEnCursoApi,
} from '@/lib/viajesApi'

function formatearKm(metros: number): string {
  const km = metros / 1000
  if (km === 0) return '0'
  if (km < 10) return km.toFixed(1)
  if (km < 1000) return Math.round(km).toString()
  return `${(km / 1000).toFixed(1)}k`
}

function formatearDuracion(segundos: number): string {
  if (segundos <= 0) return '0m'
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  if (horas === 0) return `${minutos}m`
  if (horas < 100) return `${horas}h ${minutos}m`
  return `${horas}h`
}

function horaInicio(iso: string | null): string {
  if (!iso) return 'En curso'
  return `Desde las ${new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export default function InicioScreen() {
  const theme = useTheme()
  const { profile, backendUserId, backendSyncing } = useAuth()
  const [enCurso, setEnCurso] = useState<ViajeEnCursoApi | null>(null)
  const [stats, setStats] = useState<EstadisticasUsuarioApi | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const cargar = useCallback(
    async (esRefresh = false) => {
      if (backendSyncing) return

      let userId: string
      try {
        userId = resolveBackendUserId(backendUserId)
      } catch {
        setEnCurso(null)
        setStats(null)
        setCargando(false)
        setRefreshing(false)
        return
      }

      if (esRefresh) setRefreshing(true)
      else setCargando(true)

      try {
        const [viaje, estadisticas] = await Promise.all([
          obtenerViajeEnCurso(userId),
          obtenerEstadisticasUsuario(userId),
        ])
        setEnCurso(viaje)
        setStats(estadisticas)
      } catch {
        // Inicio es informativo: ante un fallo de red dejamos el último estado conocido.
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

  const nombre = profile?.nombre?.trim() || 'viajero/a'
  const meAvatar = {
    nombre: profile?.nombre || 'U',
    apellido: profile?.apellido || '',
    color: theme.accent,
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
      {/* Saludo */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.saludo, { color: theme.textDim }]}>Bienvenido</Text>
          <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={1}>
            {nombre}
          </Text>
        </View>
        <Avatar person={meAvatar} size="lg" ring />
      </View>

      {/* Viaje en curso */}
      {enCurso && (
        <Pressable
          style={({ pressed }) => [
            styles.enCursoCard,
            {
              backgroundColor: pressed ? theme.surface2 : theme.surface,
              borderColor: theme.accentLine,
            },
          ]}
          onPress={() =>
            router.push({ pathname: '/viaje/[viajeId]/live', params: { viajeId: enCurso.id } })
          }
        >
          <View style={styles.enCursoTop}>
            <Badge tone="live" pulse>
              EN VIVO
            </Badge>
            <Text style={[styles.enCursoActividad, { color: theme.textDim }]}>
              {etiquetaActividad(enCurso.tipo_actividad)}
            </Text>
          </View>
          <Text style={[styles.enCursoTitulo, { color: theme.text }]} numberOfLines={1}>
            {enCurso.nombre || etiquetaActividad(enCurso.tipo_actividad)}
          </Text>
          <Text style={[styles.enCursoMeta, { color: theme.textMute }]}>
            {horaInicio(enCurso.fecha_inicio_real)}
          </Text>
          <View style={styles.enCursoCta}>
            <Text style={[styles.enCursoCtaText, { color: theme.accent }]}>
              Abrir mapa en vivo
            </Text>
            <Feather name="arrow-right" size={18} color={theme.accent} />
          </View>
        </Pressable>
      )}

      {/* Estadísticas personales */}
      <Text style={[styles.eyebrow, { color: theme.textDim }]}>TU ACTIVIDAD</Text>
      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {cargando && !stats ? '·' : formatearKm(stats?.distancia_total_m ?? 0)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMute }]}>Km</Text>
        </View>
        <View style={[styles.statBox, styles.borderLeft, { borderLeftColor: theme.border }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {cargando && !stats ? '·' : (stats?.viajes_finalizados ?? 0)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMute }]}>Viajes</Text>
        </View>
        <View style={[styles.statBox, styles.borderLeft, { borderLeftColor: theme.border }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {cargando && !stats ? '·' : formatearDuracion(stats?.tiempo_total_seg ?? 0)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMute }]}>En ruta</Text>
        </View>
      </View>
      {stats?.actividad_favorita && (
        <Text style={[styles.favorita, { color: theme.textMute }]}>
          Tu actividad favorita: {etiquetaActividad(stats.actividad_favorita)}
        </Text>
      )}

      {/* Accesos rápidos */}
      <Text style={[styles.eyebrow, { color: theme.textDim }]}>ACCESOS RÁPIDOS</Text>
      <View style={styles.acciones}>
        <Btn block size="lg" icon="plus" onPress={() => router.push('/viaje/crear')}>
          Crear viaje
        </Btn>
        <Btn
          block
          size="lg"
          variant="secondary"
          icon="maximize"
          onPress={() => router.push('/escanear-qr')}
        >
          Escanear QR
        </Btn>
        <Btn
          block
          size="lg"
          variant="ghost"
          icon="map"
          onPress={() => router.push('/(tabs)/two')}
        >
          Ver mis viajes
        </Btn>
      </View>

      {cargando && !stats && (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 12 }} />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerText: { flex: 1 },
  saludo: { fontSize: 15 },
  nombre: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginTop: 2 },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  enCursoCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    gap: 6,
  },
  enCursoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  enCursoActividad: { fontSize: 13, fontWeight: '600' },
  enCursoTitulo: { fontSize: 19, fontWeight: '700', marginTop: 4 },
  enCursoMeta: { fontSize: 13 },
  enCursoCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  enCursoCtaText: { fontSize: 15, fontWeight: '700' },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  borderLeft: { borderLeftWidth: 1 },
  statValue: { fontSize: 22, fontWeight: '700', fontFamily: 'SpaceMono' },
  statLabel: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  favorita: { fontSize: 12.5, marginTop: -6 },
  acciones: { gap: 11 },
})
