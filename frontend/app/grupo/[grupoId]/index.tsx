import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
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

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function GrupoDetalleScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
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

  return (
    <>
      <Stack.Screen options={{ title: grupo?.nombre ?? 'Grupo' }} />
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
        {loading ? (
          <ActivityIndicator color="#4a9eff" size="large" style={{ marginTop: 48 }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : grupo ? (
          <>
            <Text style={styles.nombre}>{grupo.nombre}</Text>
            <Text style={styles.meta}>Creado el {formatearFecha(grupo.fecha_creacion)}</Text>
            {grupo.mi_rol === 'lider' && (
              <View style={styles.badge}>
                <Text style={styles.badgeTexto}>Sos el líder</Text>
              </View>
            )}

            <Text style={styles.descripcion}>
              Lista de contactos para invitar personas a grupos y, al crear un viaje, invitar en bloque
              desde la pestaña Viajes.
            </Text>

            <Text style={styles.seccionTitulo}>Miembros</Text>
            <Text style={styles.seccionHint}>
              Integrantes del grupo y sus roles asignados.
            </Text>
            <TouchableOpacity
              style={styles.botonMiembros}
              onPress={() => router.push(`/grupo/${grupoId}/miembros`)}
            >
              <Text style={styles.botonMiembrosTexto}>Ver miembros</Text>
            </TouchableOpacity>

            {grupo.mi_rol === 'lider' && (
              <>
                <Text style={styles.seccionTitulo}>Invitar al grupo</Text>
                <Text style={styles.seccionHint}>
                  Sumá integrantes desde tus otros grupos. Las invitaciones llegan a la bandeja de Grupos.
                </Text>
                <TouchableOpacity
                  style={styles.botonInvitarGrupos}
                  onPress={() => router.push(`/grupo/${grupoId}/invitar-desde-grupos`)}
                >
                  <Text style={styles.botonInvitarGruposTexto}>Invitar personas</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.zonaPeligro}>
              <Text style={styles.zonaTitulo}>Zona de peligro</Text>
              <Text style={styles.zonaHint}>
                Estas acciones son permanentes y no se pueden deshacer.
              </Text>
              <TouchableOpacity
                style={styles.botonDestructivo}
                onPress={iniciarAbandono}
                disabled={procesandoAccion}
              >
                {procesandoAccion && !modalTransferir ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botonDestructivoTexto}>Abandonar Grupo</Text>
                )}
              </TouchableOpacity>
              {grupo.mi_rol === 'lider' && (
                <TouchableOpacity
                  style={styles.botonEliminar}
                  onPress={ejecutarEliminacion}
                  disabled={procesandoAccion}
                >
                  <Text style={styles.botonEliminarTexto}>Eliminar Grupo</Text>
                </TouchableOpacity>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 24, paddingBottom: 40, gap: 12 },
  nombre: { color: '#fff', fontSize: 26, fontWeight: '700' },
  meta: { color: '#888', fontSize: 14 },
  descripcion: { color: '#888', fontSize: 14, lineHeight: 20, marginTop: 8 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a3a5c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  badgeTexto: { color: '#4a9eff', fontSize: 13, fontWeight: '600' },
  botonMiembros: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  botonMiembrosTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  seccionTitulo: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 20 },
  seccionHint: { color: '#888', fontSize: 14, lineHeight: 20 },
  botonInvitarGrupos: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botonInvitarGruposTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  error: { color: '#ff6b6b', fontSize: 15, textAlign: 'center', marginTop: 24 },
  zonaPeligro: {
    marginTop: 32,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#5c1a1a',
    backgroundColor: '#1a1010',
    gap: 10,
  },
  zonaTitulo: { color: '#ff6b6b', fontSize: 16, fontWeight: '700' },
  zonaHint: { color: '#888', fontSize: 13, lineHeight: 18 },
  botonDestructivo: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonDestructivoTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  botonEliminar: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  botonEliminarTexto: { color: '#ff6b6b', fontSize: 15, fontWeight: '600' },
});
