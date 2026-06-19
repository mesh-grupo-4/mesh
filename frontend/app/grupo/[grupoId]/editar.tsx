import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
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
import { Btn, TopBar, useTheme } from '@/components/MeshUI';
import { Feather } from '@expo/vector-icons';

export default function EditarGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();

  const [grupo, setGrupo] = useState<GrupoDetalleApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalTransferir, setModalTransferir] = useState(false);
  const [miembrosTransferencia, setMiembrosTransferencia] = useState<GrupoMiembroApi[]>([]);
  const [nuevoLiderId, setNuevoLiderId] = useState<string | null>(null);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!grupoId) return;
      setLoading(true);
      setError(null);
      try {
        const userId = resolveBackendUserId(backendUserId);
        const detalle = await obtenerGrupo(grupoId, userId);
        setGrupo(detalle);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo cargar el grupo.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <TopBar title="Editar grupo" onBack={() => router.back()} bordered={false} />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 48 }} />
        ) : error ? (
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
        ) : grupo ? (
          <>
            <Text style={[styles.grupoNombre, { color: theme.text }]} numberOfLines={2}>
              {grupo.nombre}
            </Text>

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
  grupoNombre: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  error: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },
  zonaPeligro: {
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
