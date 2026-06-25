import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator, 
  RefreshControl,
  Pressable,
} from 'react-native';
import { meshAlert } from '@/lib/meshAlert';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  cambiarRolMiembroGrupo,
  listarMiembrosGrupo,
  obtenerGrupo,
  type GrupoMiembroApi,
  type RolGrupoApi,
} from '@/lib/gruposApi';
import { TopBar, Avatar, Badge, useTheme } from '@/components/MeshUI';
import { Feather } from '@expo/vector-icons';

function etiquetaRol(rol: RolGrupoApi): string {
  return rol === 'lider' ? 'Líder' : 'Participante';
}

export default function MiembrosGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [miembros, setMiembros] = useState<GrupoMiembroApi[]>([]);
  const [miRol, setMiRol] = useState<RolGrupoApi | null>(null);
  const [grupoNombre, setGrupoNombre] = useState<string | null>(null);
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
        setGrupoNombre(detalle.nombre);
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
    [grupoId, backendUserId]
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarRol = (miembro: GrupoMiembroApi, nuevoRol: RolGrupoApi) => {
    if (!grupoId || miRol !== 'lider' || miembro.rol === nuevoRol) return;

    const snapshot = [...miembros];

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
        meshAlert('Error', 'Error al actualizar el rol. Inténtalo de nuevo.');
      } finally {
        setActualizandoId(null);
      }
    })();
  };

  const mostrarMenuRol = (miembro: GrupoMiembroApi) => {
    meshAlert(`Rol de ${miembro.nombre}`, 'Seleccioná el nuevo rol:', [
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

    const dummyPerson = {
      nombre: item.nombre,
      apellido: '',
      color: item.rol === 'lider' ? theme.accent : undefined,
    };

    return (
      <View
        style={[
          styles.fila,
          { backgroundColor: theme.surface, borderColor: theme.border },
          actualizando && styles.filaDeshabilitada,
        ]}
      >
        <Avatar person={dummyPerson} size="sm" ring={item.rol === 'lider'} />
        
        <View style={styles.filaContenido}>
          <View style={styles.filaTitulo}>
            <Text style={[styles.nombreText, { color: theme.text }]} numberOfLines={1}>
              {item.nombre}
              {esYo ? ' (Vos)' : ''}
            </Text>
            
            <Badge tone={item.rol === 'lider' ? 'accent' : 'mute'}>
              {item.rol === 'lider' && (
                <Feather name="award" size={10} color={theme.accent} style={{ marginRight: 3 }} />
              )}
              {etiquetaRol(item.rol)}
            </Badge>
          </View>
          <Text style={[styles.email, { color: theme.textDim }]} numberOfLines={1}>
            {item.email}
          </Text>
        </View>

        {puedeEditar && (
          <Pressable
            style={({ pressed }) => [
              styles.botonRol,
              { backgroundColor: pressed ? theme.surface3 : theme.surface2 },
            ]}
            onPress={() => mostrarMenuRol(item)}
            disabled={actualizandoId !== null}
          >
            {actualizando ? (
              <ActivityIndicator color={theme.accent} size="small" />
            ) : (
              <Feather name="more-horizontal" size={16} color={theme.textDim} />
            )}
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Miembros" sub={grupoNombre ?? 'Cargando...'} onBack={() => router.back()} bordered={false} />

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
          keyExtractor={(item) => item.id}
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
            <Text style={[styles.vacio, { color: theme.textMute }]}>Este grupo aún no tiene integrantes.</Text>
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
  filaDeshabilitada: {
    opacity: 0.6,
  },
  filaContenido: {
    flex: 1,
    gap: 2,
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
  email: {
    fontSize: 13,
  },
  botonRol: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
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

