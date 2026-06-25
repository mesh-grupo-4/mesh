import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator, 
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { meshAlert } from '@/lib/meshAlert';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  obtenerGrupo,
  type GrupoDetalleApi,
} from '@/lib/gruposApi';
import { Btn, TopBar, Badge, useTheme } from '@/components/MeshUI';
import { Feather } from '@expo/vector-icons';

const MESES_ABREV = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function formatearDesde(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '--';
  const mes = MESES_ABREV[fecha.getMonth()] ?? '--';
  const anio = String(fecha.getFullYear()).slice(2);
  return `${mes} '${anio}`;
}

function getGroupColor(nombre: string): string {
  const colors = ['#d76655', '#4a9eff', '#2f9e63', '#7a5ae0', '#c98a3e'];
  const charSum = nombre.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[charSum % colors.length];
}

export default function GrupoDetalleScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();

  const [grupo, setGrupo] = useState<GrupoDetalleApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = async (esRefresh = false) => {
    if (!grupoId) return;
    if (esRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const userId = resolveBackendUserId(backendUserId);
      const detalle = await obtenerGrupo(grupoId, userId);
      setGrupo(detalle);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo cargar el grupo.';
      setError(msg);
      if (!esRefresh) meshAlert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [grupoId, backendUserId]);

  const esLider = grupo?.mi_rol === 'lider';
  const groupColor = grupo ? getGroupColor(grupo.nombre) : theme.accent;

  const headerRight = grupo ? (
    <Pressable
      onPress={() => router.push({ pathname: '/grupo/[grupoId]/editar', params: { grupoId } })}
      style={({ pressed }) => [
        styles.headerIconBtn,
        { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
      ]}
    >
      <Feather name="settings" size={17} color={theme.text} />
    </Pressable>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <TopBar title={grupo?.nombre ?? 'Grupo'} onBack={() => router.back()} bordered={false} right={headerRight} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargar(true)}
            tintColor={theme.accent}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 48 }} />
        ) : error ? (
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
        ) : grupo ? (
          <>
            {/* Tarjeta principal con degradado/tinta según color del grupo */}
            <View
              style={[
                styles.detailCard,
                {
                  backgroundColor: `${groupColor}16`,
                  borderColor: `${groupColor}55`,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.cardIconBox, { backgroundColor: `${groupColor}29` }]}>
                  <Feather name="users" size={24} color={groupColor} />
                </View>
                {esLider && (
                  <Badge tone="accent">
                    <Feather name="award" size={12} color={theme.accent} style={{ marginRight: 4 }} />
                    Líder
                  </Badge>
                )}
              </View>

              <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
                {grupo.nombre}
              </Text>

              <View style={styles.cardStatsRow}>
                <View style={styles.cardStat}>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {grupo.cantidad_miembros}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textDim }]}>Miembros</Text>
                </View>
                <View style={[styles.cardStat, styles.borderLeft, { borderLeftColor: theme.border }]}>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {grupo.cantidad_viajes}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textDim }]}>Viajes</Text>
                </View>
                <View style={[styles.cardStat, styles.borderLeft, { borderLeftColor: theme.border }]}>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {formatearDesde(grupo.fecha_creacion)}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textDim }]}>Desde</Text>
                </View>
              </View>
            </View>

            {/* Acciones principales */}
            <View style={styles.actionsRow}>
              <Btn
                variant="primary"
                block
                icon="plus"
                onPress={() => router.push({ pathname: '/viaje/crear', params: { grupo: grupo.id } })}
                style={styles.actionBtn}
              >
                Nuevo viaje
              </Btn>
            </View>

            {/* Enlaces de lista */}
            <View style={styles.linksContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.liLink,
                  {
                    backgroundColor: pressed ? theme.surface2 : theme.surface,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => router.push({ pathname: '/grupo/[grupoId]/miembros', params: { grupoId } })}
              >
                <View style={styles.liLinkContent}>
                  <View style={[styles.liIconWrapper, { backgroundColor: theme.surface2 }]}>
                    <Feather name="users" size={18} color={theme.text} />
                  </View>
                  <View style={styles.liLinkText}>
                    <Text style={[styles.liLinkTitle, { color: theme.text }]}>Miembros</Text>
                    <Text style={[styles.liLinkSub, { color: theme.textDim }]}>
                      Ver roles y permisos
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textMute} />
              </Pressable>

              {esLider && (
                <Pressable
                  style={({ pressed }) => [
                    styles.liLink,
                    {
                      backgroundColor: pressed ? theme.surface2 : theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => router.push({ pathname: '/grupo/[grupoId]/invitar-desde-grupos', params: { grupoId } })}
                >
                  <View style={styles.liLinkContent}>
                    <View style={[styles.liIconWrapper, { backgroundColor: theme.accentWeak }]}>
                      <Feather name="share-2" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.liLinkText}>
                      <Text style={[styles.liLinkTitle, { color: theme.text }]}>
                        Invitar personas
                      </Text>
                      <Text style={[styles.liLinkSub, { color: theme.textDim }]}>
                        Por QR o desde otros grupos
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textMute} />
                </Pressable>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  cardStatsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  cardStat: {
    flex: 1,
    gap: 3,
  },
  borderLeft: {
    borderLeftWidth: 1,
    paddingLeft: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  statLabel: {
    fontSize: 10.5,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  actionBtn: {
    flex: 1,
  },
  linksContainer: {
    gap: 11,
  },
  liLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 14,
  },
  liLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  liIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liLinkText: {
    flex: 1,
    marginLeft: 14,
  },
  liLinkTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  liLinkSub: {
    fontSize: 13,
    marginTop: 2,
  },
  error: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },
});
