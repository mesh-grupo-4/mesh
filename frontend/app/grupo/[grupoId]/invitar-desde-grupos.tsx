import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AvatarFallback } from '@/components/AvatarFallback';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import { listarAmigos, solicitarAmistad } from '@/lib/amistadesApi';
import {
  buscarUsuariosParaInvitar,
  invitarUsuarios,
  listarAmigosParaInvitar,
  type UsuarioParaInvitarApi,
} from '@/lib/gruposApi';

export default function AgregarIntegranteScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const [amigos, setAmigos] = useState<UsuarioParaInvitarApi[]>([]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<UsuarioParaInvitarApi[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [invitandoId, setInvitandoId] = useState<string | null>(null);
  const [solicitandoAmistadId, setSolicitandoAmistadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [idsAmigos, setIdsAmigos] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargarAmigos = useCallback(async () => {
    if (!grupoId) return;
    setLoading(true);
    setError(null);

    try {
      const userId = resolveBackendUserId(backendUserId);
      const [lista, amigosAceptados] = await Promise.all([
        listarAmigosParaInvitar(grupoId, userId),
        listarAmigos(userId),
      ]);
      setAmigos(lista);
      setIdsAmigos(new Set(amigosAceptados.map((a) => a.id)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los amigos.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [grupoId, backendUserId]);

  useEffect(() => {
    void cargarAmigos();
  }, [cargarAmigos]);

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
        if (!grupoId) return;
        try {
          const userId = resolveBackendUserId(backendUserId);
          const resultados = await buscarUsuariosParaInvitar(grupoId, q, userId);
          setResultadosBusqueda(resultados);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'No se pudo buscar usuarios.';
          setError(msg);
        } finally {
          setBuscando(false);
        }
      })();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busqueda, grupoId, backendUserId]);

  const marcarComoInvitado = (usuarioId: string) => {
    const actualizar = (lista: UsuarioParaInvitarApi[]) =>
      lista.map((u) => (u.id === usuarioId ? { ...u, ya_es_miembro: true } : u));

    setAmigos((prev) => actualizar(prev));
    setResultadosBusqueda((prev) => actualizar(prev));
  };

  const ejecutarInvitacion = async (usuario: UsuarioParaInvitarApi) => {
    if (!grupoId || usuario.ya_es_miembro) return;

    setInvitandoId(usuario.id);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await invitarUsuarios(grupoId, [usuario.id], userId);
      marcarComoInvitado(usuario.id);
      setToastVisible(true);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la invitación.');
    } finally {
      setInvitandoId(null);
    }
  };

  const ejecutarSolicitudAmistad = async (usuario: UsuarioParaInvitarApi) => {
    setSolicitandoAmistadId(usuario.id);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await solicitarAmistad(usuario.id, userId);
      Alert.alert('Listo', `Solicitud de amistad enviada a ${usuario.nombre}.`);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSolicitandoAmistadId(null);
    }
  };

  const enModoBusqueda = busqueda.trim().length >= 2;
  const listaActual = enModoBusqueda ? resultadosBusqueda : amigos;
  const listaCargando = enModoBusqueda ? buscando : loading;

  const renderFila = ({ item }: { item: UsuarioParaInvitarApi }) => {
    const invitando = invitandoId === item.id;
    const solicitando = solicitandoAmistadId === item.id;
    const esAmigo = idsAmigos.has(item.id);

    return (
      <View style={styles.fila}>
        <AvatarFallback nombre={item.nombre} />
        <View style={styles.filaContenido}>
          <Text style={styles.nombre}>{item.nombre}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
        <View style={styles.acciones}>
          {enModoBusqueda && !esAmigo && (
            <TouchableOpacity
              style={[styles.botonSecundario, solicitando && styles.botonDeshabilitado]}
              onPress={() => void ejecutarSolicitudAmistad(item)}
              disabled={solicitando || invitando}
            >
              {solicitando ? (
                <ActivityIndicator color="#4a9eff" size="small" />
              ) : (
                <Text style={styles.botonSecundarioTexto}>Agregar amigo</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.botonInvitarFila,
              (item.ya_es_miembro || invitando) && styles.botonInvitarDeshabilitado,
            ]}
            onPress={() => void ejecutarInvitacion(item)}
            disabled={item.ya_es_miembro || invitando}
          >
            {invitando ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.botonInvitarFilaTexto}>
                {item.ya_es_miembro ? 'Ya es miembro' : 'Invitar'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Agregar integrante' }} />
      <View style={styles.container}>
        <TextInput
          style={styles.buscador}
          placeholder="Buscar por nombre..."
          placeholderTextColor="#666"
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {!enModoBusqueda && (
          <Text style={styles.descripcion}>
            Tus amigos aceptados. Usá el buscador para encontrar otros usuarios de la plataforma.
          </Text>
        )}

        {listaCargando ? (
          <ActivityIndicator color="#4a9eff" size="large" style={styles.centrado} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={listaActual}
            keyExtractor={(item) => item.id}
            style={styles.lista}
            contentContainerStyle={listaActual.length === 0 ? styles.listaVacia : undefined}
            renderItem={renderFila}
            ListEmptyComponent={
              <Text style={styles.vacio}>
                {enModoBusqueda
                  ? 'No se encontraron usuarios con ese nombre.'
                  : 'No tenés amigos todavía. Buscá usuarios y enviá solicitudes de amistad.'}
              </Text>
            }
          />
        )}

        <Toast
          message="Invitación enviada correctamente"
          visible={toastVisible}
          onHide={() => setToastVisible(false)}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 24, paddingBottom: 32 },
  buscador: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 12,
  },
  descripcion: { color: '#888', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  lista: { flex: 1 },
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
  acciones: { alignItems: 'flex-end', gap: 8 },
  botonInvitarFila: {
    backgroundColor: '#4a9eff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 110,
    alignItems: 'center',
  },
  botonInvitarDeshabilitado: { backgroundColor: '#333' },
  botonInvitarFilaTexto: { color: '#fff', fontSize: 13, fontWeight: '600' },
  botonSecundario: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#4a9eff',
    minWidth: 110,
    alignItems: 'center',
  },
  botonSecundarioTexto: { color: '#4a9eff', fontSize: 12, fontWeight: '600' },
  botonDeshabilitado: { opacity: 0.5 },
  centrado: { marginTop: 48 },
  vacio: { color: '#666', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  error: { color: '#ff6b6b', fontSize: 15, textAlign: 'center', marginTop: 24 },
});
