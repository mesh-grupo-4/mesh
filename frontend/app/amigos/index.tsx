import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { AvatarFallback } from '@/components/AvatarFallback';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
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
  const { backendUserId } = useAuth();
  const [tab, setTab] = useState<TabAmigos>('amigos');
  const [amigos, setAmigos] = useState<AmigoApi[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudAmistadPendienteApi[]>([]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<UsuarioBusquedaAmistadApi[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [solicitandoId, setSolicitandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null);
  const [relacionesLocales, setRelacionesLocales] = useState<Map<string, RelacionAmistad>>(
    new Map()
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          Alert.alert('Error', e instanceof Error ? e.message : 'No se pudieron cargar los datos.');
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
          Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo buscar usuarios.');
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
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSolicitandoId(null);
    }
  };

  const confirmarEliminar = (amigo: AmigoApi) => {
    Alert.alert(
      'Eliminar amigo',
      `¿Querés eliminar a ${amigo.nombre} de tu lista de amigos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void ejecutarEliminar(amigo),
        },
      ]
    );
  };

  const ejecutarEliminar = async (amigo: AmigoApi) => {
    setEliminandoId(amigo.id);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await eliminarAmigo(amigo.id, userId);
      setAmigos((prev) => prev.filter((a) => a.id !== amigo.id));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar al amigo.');
    } finally {
      setEliminandoId(null);
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
        Alert.alert('Listo', `${resultado.amigo_nombre} ahora es tu amigo.`);
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo responder la solicitud.');
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
      return <Text style={styles.hintRelacion}>Respondé en Solicitudes</Text>;
    }

    const enviada = relacion === 'solicitud_enviada';

    return (
      <TouchableOpacity
        style={[styles.botonAgregar, (enviada || solicitando) && styles.botonDeshabilitado]}
        onPress={() => void ejecutarSolicitud(usuario)}
        disabled={enviada || solicitando}
      >
        {solicitando ? (
          <ActivityIndicator color="#4a9eff" size="small" />
        ) : (
          <Text style={styles.botonAgregarTexto}>{enviada ? 'Solicitud enviada' : 'Agregar'}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderFilaAmigo = ({ item }: { item: AmigoApi }) => {
    const eliminando = eliminandoId === item.id;

    return (
      <View style={styles.fila}>
        <AvatarFallback nombre={item.nombre} />
        <View style={styles.filaContenido}>
          <Text style={styles.nombre}>{item.nombre}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
        <TouchableOpacity
          style={[styles.botonEliminar, eliminando && styles.botonDeshabilitado]}
          onPress={() => confirmarEliminar(item)}
          disabled={eliminando}
        >
          {eliminando ? (
            <ActivityIndicator color="#ef4444" size="small" />
          ) : (
            <Text style={styles.botonEliminarTexto}>Eliminar</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderFilaBusqueda = ({ item }: { item: UsuarioBusquedaAmistadApi }) => (
    <View style={styles.fila}>
      <AvatarFallback nombre={item.nombre} />
      <View style={styles.filaContenido}>
        <Text style={styles.nombre}>{item.nombre}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      {renderBotonAgregar(item)}
    </View>
  );

  const renderSolicitud = ({ item }: { item: SolicitudAmistadPendienteApi }) => {
    const procesando = respondiendoId === item.id;

    return (
      <View style={styles.tarjetaSolicitud}>
        <View style={styles.filaSolicitud}>
          <AvatarFallback nombre={item.solicitante.nombre} />
          <View style={styles.filaContenido}>
            <Text style={styles.nombre}>{item.solicitante.nombre}</Text>
            <Text style={styles.email}>{item.solicitante.email}</Text>
            <Text style={styles.hintRelacion}>Quiere agregarte como amigo</Text>
          </View>
        </View>
        <View style={styles.accionesSolicitud}>
          <TouchableOpacity
            style={[styles.botonAceptar, procesando && styles.botonDeshabilitado]}
            onPress={() => void ejecutarRespuesta(item.id, 'aceptar')}
            disabled={procesando}
          >
            {procesando ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.botonAceptarTexto}>Aceptar</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.botonRechazar, procesando && styles.botonDeshabilitado]}
            onPress={() => void ejecutarRespuesta(item.id, 'rechazar')}
            disabled={procesando}
          >
            <Text style={styles.botonRechazarTexto}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const listaAmigosCargando = enModoBusqueda ? buscando : loading;

  return (
    <>
      <Stack.Screen options={{ title: 'Mis Amigos' }} />
      <View style={styles.container}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'amigos' && styles.tabActiva]}
            onPress={() => setTab('amigos')}
          >
            <Text style={[styles.tabTexto, tab === 'amigos' && styles.tabTextoActivo]}>
              Mis Amigos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'solicitudes' && styles.tabActiva]}
            onPress={() => setTab('solicitudes')}
          >
            <Text style={[styles.tabTexto, tab === 'solicitudes' && styles.tabTextoActivo]}>
              Solicitudes{solicitudes.length > 0 ? ` (${solicitudes.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'amigos' && (
          <>
            <TextInput
              style={styles.buscador}
              placeholder="Buscar por nombre o email..."
              placeholderTextColor="#666"
              value={busqueda}
              onChangeText={setBusqueda}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {listaAmigosCargando ? (
              <ActivityIndicator color="#4a9eff" size="large" style={styles.centrado} />
            ) : enModoBusqueda ? (
              <FlatList
                data={resultadosBusqueda}
                keyExtractor={(item) => item.id}
                renderItem={renderFilaBusqueda}
                contentContainerStyle={
                  resultadosBusqueda.length === 0 ? styles.listaVacia : undefined
                }
                ListEmptyComponent={
                  <Text style={styles.vacio}>No se encontraron usuarios.</Text>
                }
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void cargarDatos(true)}
                    tintColor="#4a9eff"
                  />
                }
              />
            ) : (
              <FlatList
                data={amigos}
                keyExtractor={(item) => item.id}
                renderItem={renderFilaAmigo}
                contentContainerStyle={amigos.length === 0 ? styles.listaVacia : undefined}
                ListEmptyComponent={
                  <Text style={styles.vacio}>
                    No tenés amigos todavía. Buscá usuarios y enviá solicitudes de amistad.
                  </Text>
                }
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void cargarDatos(true)}
                    tintColor="#4a9eff"
                  />
                }
              />
            )}
          </>
        )}

        {tab === 'solicitudes' && (
          loading ? (
            <ActivityIndicator color="#4a9eff" size="large" style={styles.centrado} />
          ) : (
            <FlatList
              data={solicitudes}
              keyExtractor={(item) => item.id}
              renderItem={renderSolicitud}
              contentContainerStyle={solicitudes.length === 0 ? styles.listaVacia : undefined}
              ListEmptyComponent={
                <Text style={styles.vacio}>No tenés solicitudes pendientes.</Text>
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void cargarDatos(true)}
                  tintColor="#4a9eff"
                />
              }
            />
          )
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 24, paddingBottom: 32 },
  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
  tabActiva: { backgroundColor: '#0d2a4a' },
  tabTexto: { color: '#888', fontSize: 14, fontWeight: '600' },
  tabTextoActivo: { color: '#4a9eff' },
  buscador: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  listaVacia: { flexGrow: 1, justifyContent: 'center' },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  filaContenido: { flex: 1, gap: 2 },
  nombre: { color: '#fff', fontSize: 16, fontWeight: '600' },
  email: { color: '#888', fontSize: 13 },
  botonAgregar: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#4a9eff',
    minWidth: 120,
    alignItems: 'center',
  },
  botonAgregarTexto: { color: '#4a9eff', fontSize: 12, fontWeight: '600' },
  botonEliminar: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    minWidth: 90,
    alignItems: 'center',
  },
  botonEliminarTexto: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  botonDeshabilitado: { opacity: 0.5 },
  hintRelacion: { color: '#888', fontSize: 12, fontStyle: 'italic' },
  tarjetaSolicitud: {
    backgroundColor: '#1a2a1a',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a4a2a',
    gap: 12,
  },
  filaSolicitud: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accionesSolicitud: { flexDirection: 'row', gap: 10 },
  botonAceptar: {
    flex: 1,
    backgroundColor: '#4a9eff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  botonAceptarTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
  botonRechazar: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  botonRechazarTexto: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  centrado: { marginTop: 48 },
  vacio: { color: '#666', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
