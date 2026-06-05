import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import { TransferirLiderazgoModal } from '@/components/TransferirLiderazgoModal';
import {
  abandonarGrupo,
  eliminarGrupo,
  listarMiembrosGrupo,
  obtenerGrupo,
  type GrupoDetalleApi,
  type GrupoMiembroApi,
} from '@/lib/gruposApi';
import { Btn, TopBar, Badge, useTheme } from '@/components/MeshUI';
import { Feather } from '@expo/vector-icons';

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
  const [modalTransferir, setModalTransferir] = useState(false);
  const [miembrosTransferencia, setMiembrosTransferencia] = useState<GrupoMiembroApi[]>([]);
  const [nuevoLiderId, setNuevoLiderId] = useState<string | null>(null);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

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
      if (!esRefresh) Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [grupoId, backendUserId]);

  const redirigirTrasSalida = (mensaje: string) => {
    router.replace('/(tabs)/grupos');
    Alert.alert('Listo', mensaje);
  };

  const ejecutarAbandono = async (nuevoLider?: string) => {
    if (!grupoId) return;
    setProcesandoAccion(true);
    try {
      const userId = resolveBackendUserId(backendUserId);
      const result = await abandonarGrupo(grupoId, userId, nuevoLider);
      setModalTransferir(false);
      if (result.accion === 'grupo_eliminado') {
        redirigirTrasSalida('El grupo fue eliminado.');
      } else {
        redirigirTrasSalida('Abandonaste el grupo.');
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo abandonar el grupo.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const ejecutarEliminacion = () => {
    if (!grupoId) return;

    Alert.alert(
      'Eliminar grupo',
      '¿Eliminar este grupo definitivamente? Esta acción no se puede deshacer y todos los miembros serán expulsados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setProcesandoAccion(true);
              try {
                const userId = resolveBackendUserId(backendUserId);
                await eliminarGrupo(grupoId, userId);
                setModalTransferir(false);
                redirigirTrasSalida('El grupo fue eliminado.');
              } catch (e: unknown) {
                Alert.alert(
                  'Error',
                  e instanceof Error ? e.message : 'No se pudo eliminar el grupo.'
                );
              } finally {
                setProcesandoAccion(false);
              }
            })();
          },
        },
      ]
    );
  };

  const confirmarAbandonoParticipante = () => {
    Alert.alert(
      'Abandonar grupo',
      '¿Estás seguro de que quieres abandonar este grupo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abandonar', style: 'destructive', onPress: () => void ejecutarAbandono() },
      ]
    );
  };

  const confirmarAbandonoLiderSolo = () => {
    Alert.alert(
      'Abandonar grupo',
      'Sos el único integrante. Al abandonar, el grupo se eliminará permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar y salir', style: 'destructive', onPress: () => void ejecutarAbandono() },
      ]
    );
  };

  const iniciarAbandono = () => {
    if (!grupo || !grupoId) return;

    if (grupo.mi_rol === 'participante') {
      confirmarAbandonoParticipante();
      return;
    }

    void (async () => {
      try {
        const userId = resolveBackendUserId(backendUserId);
        const miembros = await listarMiembrosGrupo(grupoId, userId);
        const otros = miembros.filter((m) => m.id !== userId);

        if (otros.length === 0) {
          confirmarAbandonoLiderSolo();
          return;
        }

        setMiembrosTransferencia(otros);
        setNuevoLiderId(null);
        setModalTransferir(true);
      } catch (e: unknown) {
        Alert.alert('Error', e instanceof Error ? e.message : 'No se pudieron cargar los miembros.');
      }
    })();
  };

  const confirmarTransferenciaYAbandono = () => {
    if (!nuevoLiderId) return;
    void ejecutarAbandono(nuevoLiderId);
  };

  const cerrarModalTransferir = () => {
    if (procesandoAccion) return;
    setModalTransferir(false);
    setNuevoLiderId(null);
  };

  const esLider = grupo?.mi_rol === 'lider';
  const groupColor = grupo ? getGroupColor(grupo.nombre) : theme.accent;

  const headerRight = esLider ? (
    <Pressable
      onPress={() => Alert.alert('Editar grupo', 'Funcionalidad de edición disponible próximamente.')}
      style={({ pressed }) => [
        styles.headerIconBtn,
        { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
      ]}
    >
      <Feather name="edit" size={17} color={theme.text} />
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
                  <Text style={[styles.statValue, { color: theme.text }]}>--</Text>
                  <Text style={[styles.statLabel, { color: theme.textDim }]}>Miembros</Text>
                </View>
                <View style={[styles.cardStat, styles.borderLeft, { borderLeftColor: theme.border }]}>
                  <Text style={[styles.statValue, { color: theme.text }]}>--</Text>
                  <Text style={[styles.statLabel, { color: theme.textDim }]}>Viajes</Text>
                </View>
                <View style={[styles.cardStat, styles.borderLeft, { borderLeftColor: theme.border }]}>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {formatearFecha(grupo.fecha_creacion).split(' ')[1]}
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
              {esLider && (
                <Btn
                  variant="secondary"
                  icon="share"
                  onPress={() => router.push({ pathname: '/grupo/[grupoId]/invitar-desde-grupos', params: { grupoId } })}
                  style={styles.shareBtn}
                >
                  Invitar
                </Btn>
              )}
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

            {/* Zona de peligro */}
            <View
              style={[
                styles.zonaPeligro,
                {
                  backgroundColor: theme.dangerWeak,
                  borderColor: theme.danger,
                },
              ]}
            >
              <View style={styles.dangerHeader}>
                <Feather name="shield" size={16} color={theme.danger} style={{ marginRight: 6 }} />
                <Text style={[styles.zonaTitulo, { color: theme.danger }]}>Zona de peligro</Text>
              </View>
              <Text style={[styles.zonaHint, { color: theme.textDim }]}>
                Estas acciones son permanentes y no se pueden deshacer.
              </Text>
              
              <Btn
                variant="danger-outline"
                size="sm"
                block
                onPress={iniciarAbandono}
                disabled={procesandoAccion}
              >
                {procesandoAccion && !modalTransferir ? (
                  <ActivityIndicator color={theme.danger} size="small" />
                ) : (
                  'Abandonar Grupo'
                )}
              </Btn>

              {esLider && (
                <Btn
                  variant="danger"
                  size="sm"
                  block
                  onPress={ejecutarEliminacion}
                  disabled={procesandoAccion}
                  style={{ marginTop: 6 }}
                >
                  Eliminar Grupo
                </Btn>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <TransferirLiderazgoModal
        visible={modalTransferir}
        miembros={miembrosTransferencia}
        seleccionadoId={nuevoLiderId}
        procesando={procesandoAccion}
        onSeleccionar={setNuevoLiderId}
        onConfirmar={confirmarTransferenciaYAbandono}
        onEliminarGrupo={() => {
          setModalTransferir(false);
          ejecutarEliminacion();
        }}
        onCerrar={cerrarModalTransferir}
      />
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
  shareBtn: {
    paddingHorizontal: 16,
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
  zonaPeligro: {
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.2,
    gap: 10,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zonaTitulo: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  zonaHint: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 4,
  },
});

