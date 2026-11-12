import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Pressable } from '@/components/Pressable';
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
import { useCopilot } from 'react-native-copilot';
import { TopBar, useTheme } from '@/components/MeshUI';
import { PasoAyuda } from '@/components/ayuda/PasoAyuda';
import { AYUDA_GRUPO_MIEMBROS } from '@/components/ayuda/contenidoAyuda';
import { HerramientasLista } from '@/components/BarraFiltros';
import { EstadoVacio } from '@/components/EstadoVacio';
import { Esqueleto } from '@/components/Esqueleto';
import { FilaMiembro, ordenarMiembros } from '@/components/grupos/FilaMiembro';
import { coincideBusqueda, normalizarBusqueda } from '@/lib/busqueda';
import { Feather } from '@expo/vector-icons';

export default function MiembrosGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const { start } = useCopilot();

  const [miembros, setMiembros] = useState<GrupoMiembroApi[]>([]);
  const [miRol, setMiRol] = useState<RolGrupoApi | null>(null);
  const [grupoNombre, setGrupoNombre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

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
        setMiembros(ordenarMiembros(lista));
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
      ordenarMiembros(
        prev.map((m) => {
          if (m.id === miembro.id) return { ...m, rol: nuevoRol };
          if (nuevoRol === 'lider' && m.rol === 'lider') return { ...m, rol: 'participante' };
          return m;
        })
      )
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

  // Hay un solo líder por grupo (RN-011): hacer líder a otro es pasarle el liderazgo.
  const mostrarMenuRol = (miembro: GrupoMiembroApi) => {
    meshAlert(
      `¿Pasarle el liderazgo a ${miembro.nombre}?`,
      'Va a poder armar viajes, invitar gente y editar el grupo. Vos vas a quedar como participante.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Hacer líder', onPress: () => cambiarRol(miembro, 'lider') },
      ]
    );
  };

  const consulta = normalizarBusqueda(busqueda);
  const visibles = miembros.filter((m) => coincideBusqueda(consulta, [m.nombre, m.email]));
  const lideres = visibles.filter((m) => m.rol === 'lider');
  const participantes = visibles.filter((m) => m.rol !== 'lider');

  const renderFila = (item: GrupoMiembroApi, i: number) => {
    const esYo = item.id === backendUserId;
    const puedeEditar = miRol === 'lider' && !esYo;
    const actualizando = actualizandoId === item.id;

    return (
      <FilaMiembro
        key={item.id}
        miembro={item}
        esYo={esYo}
        separador={i > 0}
        atenuada={actualizando}
        onPress={
          esYo
            ? undefined
            : () => router.push({ pathname: '/usuario/[usuarioId]', params: { usuarioId: item.id } })
        }
        derecha={
          puedeEditar ? (
            <Pressable
              style={({ pressed }) => [
                styles.botonRol,
                { backgroundColor: pressed ? theme.surface3 : theme.surface2 },
              ]}
              onPress={() => mostrarMenuRol(item)}
              disabled={actualizandoId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Opciones de ${item.nombre}`}
              hitSlop={6}
            >
              {actualizando ? (
                <ActivityIndicator color={theme.accent} size="small" />
              ) : (
                <Feather name="more-horizontal" size={18} color={theme.textDim} />
              )}
            </Pressable>
          ) : null
        }
      />
    );
  };

  const seccion = (titulo: string, lista: GrupoMiembroApi[]) =>
    lista.length === 0 ? null : (
      <View style={styles.seccion}>
        <Text style={[styles.eyebrow, { color: theme.textDim }]}>{titulo}</Text>
        <View style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {lista.map(renderFila)}
        </View>
      </View>
    );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Miembros"
        sub={grupoNombre ?? undefined}
        onBack={() => router.back()}
        bordered={false}
        onAyuda={() => start()}
      />

      {loading ? (
        <View style={styles.lista}>
          <Esqueleto ancho={70} alto={11} />
          <View style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.esqueletoFila}>
                <Esqueleto ancho={48} alto={48} radio={24} />
                <View style={styles.flex1}>
                  <Esqueleto ancho="55%" alto={15} />
                  <Esqueleto ancho="35%" alto={12} style={styles.esqueletoSub} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        </View>
      ) : (
        <PasoAyuda {...AYUDA_GRUPO_MIEMBROS[0]!} estilo={styles.flex1}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void cargar(true)}
                tintColor={theme.accent}
              />
            }
          >
            {miembros.length > 0 ? (
              <HerramientasLista
                resumen={
                  consulta
                    ? `Mostrando ${visibles.length} de ${miembros.length}`
                    : `${miembros.length} ${miembros.length === 1 ? 'miembro' : 'miembros'}`
                }
                busqueda={{
                  value: busqueda,
                  onChangeText: setBusqueda,
                  placeholder: 'Buscar por nombre...',
                  accessibilityLabel: 'Buscar miembros',
                  maxLength: 60,
                }}
              />
            ) : null}

            <View style={styles.lista}>
              {miembros.length === 0 ? (
                <EstadoVacio
                  icono="users"
                  titulo="Sin integrantes"
                  texto="Este grupo aún no tiene integrantes."
                />
              ) : visibles.length === 0 ? (
                <EstadoVacio
                  compacto
                  icono="search"
                  titulo="Sin resultados"
                  texto={`Nadie del grupo coincide con "${busqueda.trim()}".`}
                />
              ) : (
                <>
                  {seccion('LÍDER', lideres)}
                  {seccion(`PARTICIPANTES (${participantes.length})`, participantes)}
                </>
              )}
            </View>
          </ScrollView>
        </PasoAyuda>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lista: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 22,
  },
  seccion: {
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tarjeta: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  botonRol: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  esqueletoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  esqueletoSub: {
    marginTop: 6,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
});
