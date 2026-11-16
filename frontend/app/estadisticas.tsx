import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Pressable } from '@/components/Pressable'
import { Btn, TopBar, useTheme } from '@/components/MeshUI'
import { useAuth } from '@/context/AuthContext'
import { listarAmigos } from '@/lib/amistadesApi'
import { resolveBackendUserId } from '@/lib/apiClient'
import { formatKmCompact } from '@/lib/format'
import { listarGrupos } from '@/lib/gruposApi'
import { obtenerEstadisticasUsuario } from '@/lib/viajesApi'

/** `null` = ese dato no se pudo cargar (no es lo mismo que cero). */
type Stats = {
  viajes: number | null
  grupos: number | null
  amigos: number | null
  distancia_m: number | null
}

const STATS_VACIAS: Stats = { viajes: 0, grupos: 0, amigos: 0, distancia_m: 0 }

/** Números del usuario. Cada uno lleva a su sección, sin apilar otra vez las tabs. */
export default function EstadisticasScreen() {
  const { backendUserId } = useAuth()
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [stats, setStats] = useState<Stats | null>(null)

  const cargar = useCallback(async () => {
    let userId: string
    try {
      userId = resolveBackendUserId(backendUserId)
    } catch {
      setStats(STATS_VACIAS)
      return
    }

    const [estadisticas, grupos, amigos] = await Promise.all([
      obtenerEstadisticasUsuario(userId).catch(() => null),
      listarGrupos(userId).catch(() => null),
      listarAmigos(userId).catch(() => null),
    ])

    // Un fallo de red no se muestra como "0 viajes / 0 km": queda sin dato y con reintento.
    setStats({
      viajes: estadisticas ? estadisticas.viajes_finalizados ?? 0 : null,
      grupos: grupos ? grupos.length : null,
      amigos: amigos ? amigos.length : null,
      distancia_m: estadisticas ? estadisticas.distancia_total_m ?? 0 : null,
    })
  }, [backendUserId])

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const hayError = stats != null && Object.values(stats).some((v) => v == null)
  const texto = (v: number | null | undefined, formato: (n: number) => string = String) =>
    stats == null ? '·' : v == null ? '–' : formato(v)

  const celdas: { key: string; label: string; value: string; destino: Href }[] = [
    { key: 'viajes', label: 'Viajes', value: texto(stats?.viajes), destino: '/(tabs)/two' },
    { key: 'grupos', label: 'Grupos', value: texto(stats?.grupos), destino: '/(tabs)/grupos' },
    {
      key: 'amigos',
      label: 'Amigos',
      value: texto(stats?.amigos),
      destino: '/(tabs)/grupos?tab=amigos',
    },
    {
      key: 'km',
      label: 'Km',
      value: texto(stats?.distancia_m, formatKmCompact),
      destino: '/(tabs)/two',
    },
  ]

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar title="Estadísticas" bordered={false} />

      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + 24 }]}>
        {celdas.map((celda) => (
          <Pressable
            key={celda.key}
            onPress={() => router.dismissTo(celda.destino)}
            accessibilityRole="button"
            accessibilityLabel={`${celda.label}: ${celda.value}`}
            style={({ pressed }) => [
              styles.celda,
              {
                backgroundColor: pressed ? theme.surface2 : theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.valor, { color: theme.text }]} numberOfLines={1}>
              {celda.value}
            </Text>
            <Text style={[styles.etiqueta, { color: theme.textDim }]}>{celda.label}</Text>
          </Pressable>
        ))}
        {hayError && (
          <View style={styles.error}>
            <Text style={[styles.errorTexto, { color: theme.textDim }]}>
              No pudimos cargar todas tus estadísticas. Revisá tu conexión.
            </Text>
            <Btn variant="primary" onPress={() => void cargar()}>
              Reintentar
            </Btn>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contenido: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    padding: 20,
  },
  celda: {
    width: '48%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 28,
    borderRadius: 16,
    borderWidth: 1,
  },
  error: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
  },
  errorTexto: {
    fontSize: 14,
    textAlign: 'center',
  },
  valor: {
    fontSize: 30,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  etiqueta: {
    fontSize: 12,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
})
