import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { meshAlert } from '@/lib/meshAlert';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  listarParticipantesViaje,
  obtenerViaje,
  type ViajeParticipanteApi,
} from '@/lib/viajesApi';
import { TopBar, Avatar, Badge, useTheme } from '@/components/MeshUI';
import { Feather } from '@expo/vector-icons';

function etiquetaRol(rol: ViajeParticipanteApi['rol']): string {
  return rol === 'lider' ? 'Líder' : 'Participante';
}

/** Estado de la invitación al viaje (distinto de si se unió efectivamente). */
function badgeEstado(estado: ViajeParticipanteApi['estado']): {
  texto: string;
  tone: 'good' | 'mute' | 'live';
} {
  switch (estado) {
    case 'confirmado':
      return { texto: 'Confirmó', tone: 'good' };
    case 'pendiente':
      return { texto: 'Pendiente', tone: 'mute' };
    case 'salido':
      return { texto: 'Salió', tone: 'mute' };
    case 'rechazado':
      return { texto: 'Rechazó', tone: 'live' };
  }
}

export default function MiembrosViajeScreen() {
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [miembros, setMiembros] = useState<ViajeParticipanteApi[]>([]);
  const [viajeNombre, setViajeNombre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (esRefresh = false) => {
      if (!viajeId) return;
      if (esRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const userId = resolveBackendUserId(backendUserId);
        const [detalle, lista] = await Promise.all([
          obtenerViaje(viajeId, userId),
          listarParticipantesViaje(viajeId, userId),
        ]);
        setViajeNombre(detalle.nombre ?? null);
        setMiembros(lista);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudieron cargar los miembros.';
        setError(msg);
        if (!esRefresh) meshAlert('Error', msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [viajeId, backendUserId]
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const renderItem = ({ item }: { item: ViajeParticipanteApi }) => {
    const esYo = item.usuario.id === backendUserId;
    const esLider = item.rol === 'lider';

    const dummyPerson = {
      nombre: item.usuario.nombre,
      apellido: item.usuario.apellido ?? '',
      color: esLider ? theme.accent : undefined,
    };

    return (
      <View style={[styles.fila, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Avatar person={dummyPerson} size="sm" ring={esLider} />

        <View style={styles.filaContenido}>
          <View style={styles.filaTitulo}>
            <Text style={[styles.nombreText, { color: theme.text }]} numberOfLines={1}>
              {item.usuario.nombre}
              {esYo ? ' (Vos)' : ''}
            </Text>
            <Badge tone={esLider ? 'accent' : 'mute'}>
              {esLider && (
                <Feather name="award" size={10} color={theme.accent} style={{ marginRight: 3 }} />
              )}
              {etiquetaRol(item.rol)}
            </Badge>
          </View>

          {item.grupo_origen && (
            <Text style={[styles.grupoOrigen, { color: theme.accent }]} numberOfLines={1}>
              <Feather name="users" size={12} />
              {'  '}Grupo: {item.grupo_origen.nombre}
            </Text>
          )}

          <View style={styles.badgesRow}>
            <Badge tone={badgeEstado(item.estado).tone}>{badgeEstado(item.estado).texto}</Badge>
            {item.union_efectiva && (
              <Badge tone="good">
                <Feather name="check" size={10} color={theme.good} style={{ marginRight: 3 }} />
                Se unió al viaje
              </Badge>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Miembros" sub={viajeNombre ?? 'Cargando...'} onBack={() => router.back()} bordered={false} />

      {loading ? (
        <View style={styles.centrado}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={miembros}
          keyExtractor={(item) => item.usuario.id}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void cargar(true)}
              tintColor={theme.accent}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.vacio, { color: theme.textMute }]}>Este viaje aún no tiene miembros.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lista: {
    padding: 20,
    paddingBottom: 40,
    gap: 11,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
    gap: 12,
  },
  filaContenido: {
    flex: 1,
    gap: 4,
  },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  nombreText: {
    fontSize: 15.5,
    fontWeight: '700',
    maxWidth: '60%',
  },
  grupoOrigen: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vacio: {
    fontSize: 14.5,
    textAlign: 'center',
    marginTop: 32,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
});
