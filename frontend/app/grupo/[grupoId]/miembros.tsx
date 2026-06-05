import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import { AvatarFallback } from '@/components/AvatarFallback';
import {
  cambiarRolMiembroGrupo,
  listarMiembrosGrupo,
  obtenerGrupo,
  type GrupoMiembroApi,
  type RolGrupoApi,
} from '@/lib/gruposApi';

function etiquetaRol(rol: RolGrupoApi): string {
  return rol === 'lider' ? 'Líder' : 'Participante';
}

export default function MiembrosGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const [miembros, setMiembros] = useState<GrupoMiembroApi[]>([]);
  const [miRol, setMiRol] = useState<RolGrupoApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  const cargar = useCallback(
    async (esRefresh = false) => {
      if (!grupoId) return;
      if (esRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const userId = resolveBackendUserId(backendUserId);
        const [detalle, lista] = await Promise.all([
          obtenerGrupo(grupoId, userId),
          listarMiembrosGrupo(grupoId, userId),
        ]);
        setMiRol(detalle.mi_rol);
        setMiembros(lista);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudieron cargar los miembros.';
        setError(msg);
        if (!esRefresh) Alert.alert('Error', msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [grupoId, backendUserId]
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarRol = (miembro: GrupoMiembroApi, nuevoRol: RolGrupoApi) => {
    if (!grupoId || miRol !== 'lider' || miembro.rol === nuevoRol) return;

    const rolAnterior = miembro.rol;
    const snapshot = miembros;

    setActualizandoId(miembro.id);
    setMiembros((prev) =>
      prev.map((m) => {
        if (m.id === miembro.id) return { ...m, rol: nuevoRol };
        if (nuevoRol === 'lider' && m.rol === 'lider') return { ...m, rol: 'participante' };
        return m;
      })
    );
    if (nuevoRol === 'lider') setMiRol('participante');

    void (async () => {
      try {
        const userId = resolveBackendUserId(backendUserId);
        await cambiarRolMiembroGrupo(grupoId, miembro.id, nuevoRol, userId);
        await cargar(true);
      } catch {
        setMiembros(snapshot);
        if (nuevoRol === 'lider') setMiRol('lider');
        Alert.alert('Error', 'Error al actualizar el rol. Inténtalo de nuevo.');
      } finally {
        setActualizandoId(null);
      }
    })();
  };

  const mostrarMenuRol = (miembro: GrupoMiembroApi) => {
    Alert.alert(`Rol de ${miembro.nombre}`, 'Seleccioná el nuevo rol:', [
      {
        text: 'Líder',
        onPress: () => cambiarRol(miembro, 'lider'),
      },
      {
        text: 'Participante',
        onPress: () => cambiarRol(miembro, 'participante'),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const renderItem = ({ item }: { item: GrupoMiembroApi }) => {
    const esYo = item.id === backendUserId;
    const puedeEditar = miRol === 'lider' && !esYo;
    const actualizando = actualizandoId === item.id;

    return (
      <View style={[styles.fila, actualizando && styles.filaDeshabilitada]}>
        <AvatarFallback nombre={item.nombre} />
        <View style={styles.filaContenido}>
          <View style={styles.filaTitulo}>
            <Text style={styles.nombre}>
              {item.nombre}
              {esYo ? ' (Tú)' : ''}
            </Text>
            <View
              style={[
                styles.badgeRol,
                item.rol === 'lider' ? styles.badgeLider : styles.badgeParticipante,
              ]}
            >
              <Text
                style={[
                  styles.badgeRolTexto,
                  item.rol === 'lider' ? styles.badgeLiderTexto : styles.badgeParticipanteTexto,
                ]}
              >
                {etiquetaRol(item.rol)}
              </Text>
            </View>
          </View>
          <Text style={styles.email}>{item.email}</Text>
        </View>
        {puedeEditar && (
          <TouchableOpacity
            style={styles.botonRol}
            onPress={() => mostrarMenuRol(item)}
            disabled={actualizandoId !== null}
          >
            {actualizando ? (
              <ActivityIndicator color="#4a9eff" size="small" />
            ) : (
              <Text style={styles.botonRolTexto}>···</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Miembros' }} />
      {loading ? (
        <View style={styles.centrado}>
          <ActivityIndicator color="#4a9eff" size="large" />
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={miembros}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void cargar(true)}
              tintColor="#4a9eff"
            />
          }
          ListEmptyComponent={
            <Text style={styles.vacio}>Este grupo aún no tiene integrantes.</Text>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lista: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#0f0f0f',
    flexGrow: 1,
    gap: 8,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  filaDeshabilitada: {
    opacity: 0.6,
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
  nombre: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  email: {
    color: '#888',
    fontSize: 13,
  },
  badgeRol: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeLider: {
    backgroundColor: '#1a3a5c',
  },
  badgeParticipante: {
    backgroundColor: '#2a2a2a',
  },
  badgeRolTexto: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeLiderTexto: {
    color: '#4a9eff',
  },
  badgeParticipanteTexto: {
    color: '#aaa',
  },
  botonRol: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  botonRolTexto: {
    color: '#4a9eff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  vacio: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 15,
    textAlign: 'center',
  },
});
