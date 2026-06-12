import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { TopBar, Avatar, Btn, Field, useTheme } from '@/components/MeshUI';
import { Feather } from '@expo/vector-icons';

export default function AgregarIntegranteScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [amigos, setAmigos] = useState<UsuarioParaInvitarApi[]>([]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<UsuarioParaInvitarApi[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [invitandoId, setInvitandoId] = useState<string | null>(null);
  const [solicitandoAmistadId, setSolicitandoAmistadId] = useState<string | null>(null);
  const [idsInvitadosEnSesion, setIdsInvitadosEnSesion] = useState<Set<string>>(new Set());
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

  const ejecutarInvitacion = async (usuario: UsuarioParaInvitarApi) => {
    if (
      !grupoId ||
      usuario.ya_es_miembro ||
      usuario.invitacion_pendiente ||
      idsInvitadosEnSesion.has(usuario.id)
    )
      return;

    setInvitandoId(usuario.id);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await invitarUsuarios(grupoId, [usuario.id], userId);
      setIdsInvitadosEnSesion((prev) => new Set([...prev, usuario.id]));
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
    const yaInvitado = idsInvitadosEnSesion.has(item.id);

    const dummyPerson = {
      nombre: item.nombre,
      apellido: '',
    };

    return (
      <View style={[styles.fila, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Avatar person={dummyPerson} size="sm" />
        
        <View style={styles.filaContenido}>
          <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={1}>
            {item.nombre}
          </Text>
          <Text style={[styles.email, { color: theme.textDim }]} numberOfLines={1}>
            {item.email}
          </Text>
        </View>

        <View style={styles.acciones}>
          {enModoBusqueda && !esAmigo && (
            <Btn
              variant="outline"
              size="sm"
              onPress={() => void ejecutarSolicitudAmistad(item)}
              disabled={solicitando || invitando}
              loading={solicitando}
              style={styles.addBtn}
            >
              Agregar amigo
            </Btn>
          )}
          
          <Btn
            variant={
              item.ya_es_miembro || item.invitacion_pendiente || yaInvitado ? 'secondary' : 'primary'
            }
            size="sm"
            onPress={() => void ejecutarInvitacion(item)}
            disabled={item.ya_es_miembro || item.invitacion_pendiente || yaInvitado || invitando}
            loading={invitando}
            style={styles.inviteBtn}
          >
            {item.ya_es_miembro
              ? 'Ya es miembro'
              : item.invitacion_pendiente || yaInvitado
                ? 'Invitación enviada'
                : 'Invitar'}
          </Btn>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Invitar personas" onBack={() => router.back()} bordered={false} />

      <View style={styles.searchSection}>
        <Field
          label=""
          leading="search"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {!enModoBusqueda && (
        <Text style={[styles.descripcion, { color: theme.textDim }]}>
          Tus amigos aceptados. Usá el buscador para encontrar otros usuarios de la plataforma.
        </Text>
      )}

      {listaCargando ? (
        <ActivityIndicator color={theme.accent} size="large" style={styles.centrado} />
      ) : error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : (
        <FlatList
          data={listaActual}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          contentContainerStyle={[
            styles.listaContent,
            listaActual.length === 0 ? styles.listaVacia : undefined,
          ]}
          renderItem={renderFila}
          ListEmptyComponent={
            <Text style={[styles.vacio, { color: theme.textMute }]}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  descripcion: {
    fontSize: 13.5,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  lista: {
    flex: 1,
  },
  listaContent: {
    padding: 20,
    gap: 11,
  },
  listaVacia: {
    flexGrow: 1,
    justifyContent: 'center',
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
    gap: 2,
  },
  nombre: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  email: {
    fontSize: 13,
  },
  acciones: {
    alignItems: 'flex-end',
    gap: 6,
  },
  addBtn: {
    minWidth: 110,
  },
  inviteBtn: {
    minWidth: 110,
  },
  centrado: {
    marginTop: 48,
  },
  vacio: {
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
  },
  error: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },
});

