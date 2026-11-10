import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Pressable } from '@/components/Pressable'
import { TopBar, useTheme } from '@/components/MeshUI'
import { useAuth } from '@/context/AuthContext'
import { listarAmigos } from '@/lib/amistadesApi'
import { resolveBackendUserId } from '@/lib/apiClient'
import { formatKmCompact } from '@/lib/format'
import { listarGrupos } from '@/lib/gruposApi'
import { obtenerEstadisticasUsuario } from '@/lib/viajesApi'

type Stats = {
  viajes: number
  grupos: number
  amigos: number
  distancia_m: number
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

    setStats({
      viajes: estadisticas?.viajes_finalizados ?? 0,
      grupos: grupos?.length ?? 0,
      amigos: amigos?.length ?? 0,
      distancia_m: estadisticas?.distancia_total_m ?? 0,
    })
  }, [backendUserId])

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const celdas: { key: string; label: string; value: string; destino: Href }[] = [
    { key: 'viajes', label: 'Viajes', value: stats ? String(stats.viajes) : '·', destino: '/(tabs)/two' },
    { key: 'grupos', label: 'Grupos', value: stats ? String(stats.grupos) : '·', destino: '/(tabs)/grupos' },
    {
      key: 'amigos',
      label: 'Amigos',
      value: stats ? String(stats.amigos) : '·',
      destino: '/(tabs)/grupos?tab=amigos',
    },
    {
      key: 'km',
      label: 'Km',
      value: stats ? formatKmCompact(stats.distancia_m) : '·',
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
