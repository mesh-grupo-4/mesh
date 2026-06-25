import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { AvatarFallback } from '@/components/AvatarFallback';
import { SelectableCard } from '@/components/SelectableCard';
import { SelectionActionBar } from '@/components/SelectionActionBar';
import { SelectionHeader } from '@/components/SelectionHeader';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import { useTheme } from '@/components/MeshUI';
import { useSelectionMode } from '@/hooks/useSelectionMode';
import {
  bulkDeleteSummary,
  formatItemList,
  runBulkDelete,
} from '@/lib/bulkDelete';
import { meshAlert, meshConfirmDestructive, meshError, meshSuccess } from '@/lib/meshAlert';
import {
  buscarUsuariosAmistad,
  eliminarAmigo,
  listarAmigos,
  listarSolicitudesAmistadPendientes,
  responderSolicitudAmistad,
  solicitarAmistad,
  type AmigoApi,
  type RelacionAmistad,
  type SolicitudAmistadPendienteApi,
  type UsuarioBusquedaAmistadApi,
} from '@/lib/amistadesApi';

type TabAmigos = 'amigos' | 'solicitudes';

export default function AmigosScreen() {
  const theme = useTheme();
  const { backendUserId } = useAuth();
  const selection = useSelectionMode();
  const [tab, setTab] = useState<TabAmigos>('amigos');
  const [amigos, setAmigos] = useState<AmigoApi[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudAmistadPendienteApi[]>([]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<UsuarioBusquedaAmistadApi[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [solicitandoId, setSolicitandoId] = useState<string | null>(null);
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null);
  const [eliminandoBulk, setEliminandoBulk] = useState(false);
  const [relacionesLocales, setRelacionesLocales] = useState<Map<string, RelacionAmistad>>(
    new Map()
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      return () => selection.exit();
    }, [selection.exit])
  );

  const cargarDatos = useCallback(
    async (esRefresh = false) => {
      if (esRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const userId = resolveBackendUserId(backendUserId);
        const [listaAmigos, listaSolicitudes] = await Promise.all([
          listarAmigos(userId),
          listarSolicitudesAmistadPendientes(userId),
        ]);
        setAmigos(listaAmigos);
        setSolicitudes(listaSolicitudes);
      } catch (e: unknown) {
        if (!esRefresh) {
          meshError('Error', e instanceof Error ? e.message : 'No se pudieron cargar los datos.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [backendUserId]
  );

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = busqueda.trim();
    if (q.length < 2) {
      setResultadosBusqueda([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const userId = resolveBackendUserId(backendUserId);
          const resultados = await buscarUsuariosAmistad(q, userId);
          setResultadosBusqueda(resultados);
        } catch (e: unknown) {
          meshError('Error', e instanceof Error ? e.message : 'No se pudo buscar usuarios.');
        } finally {
          setBuscando(false);
        }
      })();
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busqueda, backendUserId]);

  const obtenerRelacion = (usuario: UsuarioBusquedaAmistadApi): RelacionAmistad => {
    return relacionesLocales.get(usuario.id) ?? usuario.relacion;
  };

  const ejecutarSolicitud = async (usuario: UsuarioBusquedaAmistadApi) => {
    setSolicitandoId(usuario.id);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await solicitarAmistad(usuario.id, userId);
      setRelacionesLocales((prev) => new Map(prev).set(usuario.id, 'solicitud_enviada'));
      setResultadosBusqueda((prev) =>
        prev.map((u) =>
          u.id === usuario.id ? { ...u, relacion: 'solicitud_enviada' as const } : u
        )
      );
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSolicitandoId(null);
    }
  };

  const amigosSeleccionados = amigos.filter((a) => selection.isSelected(a.id));
  const todosSeleccionados =
    amigos.length > 0 && amigos.every((a) => selection.isSelected(a.id));

  const toggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      selection.clear();
      return;
    }
    selection.selectAll(amigos.map((a) => a.id));
  };

  const confirmarEliminarSeleccionados = () => {
    if (selection.count === 0) return;

    const nombres = amigosSeleccionados.map((a) => a.nombre);
    const lista = formatItemList(nombres);

    meshConfirmDestructive({
      title: 'Eliminar amigos',
      message: `¿Querés eliminar a ${lista} de tu lista de amigos? Esta acción no se puede deshacer.`,
      confirmLabel: `Eliminar (${selection.count})`,
      onConfirm: () => void ejecutarEliminarBulk(),
    });
  };

  const ejecutarEliminarBulk = async () => {
    setEliminandoBulk(true);
    try {
      const userId = resolveBackendUserId(backendUserId);
      const items = amigosSeleccionados.map((a) => ({ id: a.id, label: a.nombre }));

      const result = await runBulkDelete(items, async (item) => {
        await eliminarAmigo(item.id, userId);
      });

      const idsOk = new Set(
        items.filter((i) => !result.failed.some((f) => f.id === i.id)).map((i) => i.id)
      );
      setAmigos((prev) => prev.filter((a) => !idsOk.has(a.id)));
      selection.exit();

      if (result.failed.length === 0) {
        meshSuccess('Listo', bulkDeleteSummary(result, 'amigo'));
      } else {
        meshAlert('Resultado parcial', bulkDeleteSummary(result, 'amigo'), [{ text: 'Entendido' }]);
      }
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo completar la eliminación.');
    } finally {
      setEliminandoBulk(false);
    }
  };

  const ejecutarRespuesta = async (solicitudId: string, accion: 'aceptar' | 'rechazar') => {
    setRespondiendoId(solicitudId);
    try {
      const userId = resolveBackendUserId(backendUserId);
      const resultado = await responderSolicitudAmistad(solicitudId, accion, userId);
      setSolicitudes((prev) => prev.filter((s) => s.id !== solicitudId));

      if (accion === 'aceptar') {
        await cargarDatos(true);
        meshSuccess('Listo', `${resultado.amigo_nombre} ahora es tu amigo.`);
      }
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo responder la solicitud.');
    } finally {
      setRespondiendoId(null);
    }
  };

  const enModoBusqueda = tab === 'amigos' && busqueda.trim().length >= 2;

  const renderBotonAgregar = (usuario: UsuarioBusquedaAmistadApi) => {
    const relacion = obtenerRelacion(usuario);
    const solicitando = solicitandoId === usuario.id;

    if (relacion === 'amigo') return null;

    if (relacion === 'solicitud_recibida') {
      return <Text style={[styles.hintRelacion, { color: theme.textDim }]}>Respondé en Solicitudes</Text>;
    }

    const enviada = relacion === 'solicitud_enviada';

    return (
      <TouchableOpacity
        style={[
          styles.botonAgregar,
          { borderColor: theme.accentLine },
          (enviada || solicitando) && styles.botonDeshabilitado,
        ]}
        onPress={() => void ejecutarSolicitud(usuario)}
        disabled={enviada || solicitando}
      >
        {solicitando ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <Text style={[styles.botonAgregarTexto, { color: theme.accent }]}>
            {enviada ? 'Solicitud enviada' : 'Agregar'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderFilaAmigo = ({ item }: { item: AmigoApi }) => (
    <SelectableCard
      itemId={item.id}
      selectionActive={selection.active}
      selected={selection.isSelected(item.id)}
      onEnterSelection={selection.enter}
      onToggle={selection.toggle}
      style={[styles.fila, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <AvatarFallback nombre={item.nombre} />
      <View style={styles.filaContenido}>
        <Text style={[styles.nombre, { color: theme.text }]}>{item.nombre}</Text>
        <Text style={[styles.email, { color: theme.textDim }]}>{item.email}</Text>
      </View>
    </SelectableCard>
  );

  const renderFilaBusqueda = ({ item }: { item: UsuarioBusquedaAmistadApi }) => (
    <View style={[styles.fila, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AvatarFallback nombre={item.nombre} />
      <View style={styles.filaContenido}>
        <Text style={[styles.nombre, { color: theme.text }]}>{item.nombre}</Text>
        <Text style={[styles.email, { color: theme.textDim }]}>{item.email}</Text>
      </View>
      {renderBotonAgregar(item)}
    </View>
  );

  const renderSolicitud = ({ item }: { item: SolicitudAmistadPendienteApi }) => {
    const procesando = respondiendoId === item.id;

    return (
      <View style={[styles.tarjetaSolicitud, { backgroundColor: theme.surface, borderColor: theme.accentLine }]}>
        <View style={styles.filaSolicitud}>
          <AvatarFallback nombre={item.solicitante.nombre} />
          <View style={styles.filaContenido}>
            <Text style={[styles.nombre, { color: theme.text }]}>{item.solicitante.nombre}</Text>
            <Text style={[styles.email, { color: theme.textDim }]}>{item.solicitante.email}</Text>
            <Text style={[styles.hintRelacion, { color: theme.textDim }]}>Quiere agregarte como amigo</Text>
          </View>
        </View>
        <View style={styles.accionesSolicitud}>
          <TouchableOpacity
            style={[styles.botonAceptar, { backgroundColor: theme.accent }, procesando && styles.botonDeshabilitado]}
            onPress={() => void ejecutarRespuesta(item.id, 'aceptar')}
            disabled={procesando}
          >
            {procesando ? (
              <ActivityIndicator color={theme.onAccent} size="small" />
            ) : (
              <Text style={[styles.botonAceptarTexto, { color: theme.onAccent }]}>Aceptar</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.botonRechazar, { borderColor: theme.borderStrong }, procesando && styles.botonDeshabilitado]}
            onPress={() => void ejecutarRespuesta(item.id, 'rechazar')}
            disabled={procesando}
          >
            <Text style={[styles.botonRechazarTexto, { color: theme.textDim }]}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const listaAmigosCargando = enModoBusqueda ? buscando : loading;

  return (
    <>
      <Stack.Screen options={{ title: 'Mis Amigos' }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.tabs, { borderColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: theme.surface },
              tab === 'amigos' && { backgroundColor: theme.accentWeak },
            ]}
            onPress={() => {
              selection.exit();
              setTab('amigos');
            }}
          >
            <Text style={[styles.tabTexto, { color: tab === 'amigos' ? theme.accent : theme.textDim }]}>
              Mis Amigos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: theme.surface },
              tab === 'solicitudes' && { backgroundColor: theme.accentWeak },
            ]}
            onPress={() => {
              selection.exit();
              setTab('solicitudes');
            }}
          >
            <Text style={[styles.tabTexto, { color: tab === 'solicitudes' ? theme.accent : theme.textDim }]}>
              Solicitudes{solicitudes.length > 0 ? ` (${solicitudes.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'amigos' && !enModoBusqueda ? (
          <SelectionHeader
            visible={selection.active}
            allSelected={todosSeleccionados}
            onToggleAll={toggleSeleccionarTodos}
            onCancel={selection.exit}
          />
        ) : null}

        {tab === 'amigos' && (
          <>
            <TextInput
              style={[
                styles.buscador,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="Buscar por nombre o email..."
              placeholderTextColor={theme.textMute}
              value={busqueda}
              onChangeText={(text) => {
                if (text.trim().length >= 2) selection.exit();
                setBusqueda(text);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {listaAmigosCargando ? (
              <ActivityIndicator color={theme.accent} size="large" style={styles.centrado} />
            ) : enModoBusqueda ? (
              <FlatList
                data={resultadosBusqueda}
                keyExtractor={(item) => item.id}
                renderItem={renderFilaBusqueda}
                contentContainerStyle={
                  resultadosBusqueda.length === 0 ? styles.listaVacia : undefined
                }
                ListEmptyComponent={
                  <Text style={[styles.vacio, { color: theme.textMute }]}>No se encontraron usuarios.</Text>
                }
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void cargarDatos(true)}
                    tintColor={theme.accent}
                  />
                }
              />
            ) : (
              <FlatList
                data={amigos}
                keyExtractor={(item) => item.id}
                renderItem={renderFilaAmigo}
                contentContainerStyle={[
                  amigos.length === 0 ? styles.listaVacia : undefined,
                  selection.active && styles.listaConBarra,
                ]}
                ListEmptyComponent={
                  <Text style={[styles.vacio, { color: theme.textMute }]}>
                    No tenés amigos todavía. Buscá usuarios y enviá solicitudes de amistad.
                    {'\n\n'}Mantené apretado un contacto para seleccionar y eliminar.
                  </Text>
                }
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void cargarDatos(true)}
                    tintColor={theme.accent}
                  />
                }
              />
            )}
          </>
        )}

        {tab === 'solicitudes' && (
          loading ? (
            <ActivityIndicator color={theme.accent} size="large" style={styles.centrado} />
          ) : (
            <FlatList
              data={solicitudes}
              keyExtractor={(item) => item.id}
              renderItem={renderSolicitud}
              contentContainerStyle={solicitudes.length === 0 ? styles.listaVacia : undefined}
              ListEmptyComponent={
                <Text style={[styles.vacio, { color: theme.textMute }]}>No tenés solicitudes pendientes.</Text>
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void cargarDatos(true)}
                  tintColor={theme.accent}
                />
              }
            />
          )
        )}

        <SelectionActionBar
          visible={selection.active && tab === 'amigos' && !enModoBusqueda}
          count={selection.count}
          deleting={eliminandoBulk}
          onCancel={selection.exit}
          onDelete={confirmarEliminarSeleccionados}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingBottom: 32 },
  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabTexto: { fontSize: 14, fontWeight: '600' },
  buscador: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  listaVacia: { flexGrow: 1, justifyContent: 'center' },
  listaConBarra: { paddingBottom: 88 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  filaContenido: { flex: 1, gap: 2 },
  nombre: { fontSize: 16, fontWeight: '600' },
  email: { fontSize: 13 },
  botonAgregar: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    minWidth: 120,
    alignItems: 'center',
  },
  botonAgregarTexto: { fontSize: 12, fontWeight: '600' },
  botonDeshabilitado: { opacity: 0.5 },
  hintRelacion: { fontSize: 12, fontStyle: 'italic' },
  tarjetaSolicitud: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  filaSolicitud: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accionesSolicitud: { flexDirection: 'row', gap: 10 },
  botonAceptar: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  botonAceptarTexto: { fontSize: 14, fontWeight: '600' },
  botonRechazar: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  botonRechazarTexto: { fontSize: 14, fontWeight: '600' },
  centrado: { marginTop: 48 },
  vacio: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
