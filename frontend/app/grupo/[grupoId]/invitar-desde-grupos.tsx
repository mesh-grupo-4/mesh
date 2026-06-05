import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AvatarFallback } from '@/components/AvatarFallback';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  invitarUsuarios,
  listarUsuariosParaInvitar,
  type UsuarioInvitableApi,
} from '@/lib/gruposApi';

export default function InvitarPersonasScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioInvitableApi[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!grupoId) return;
    setLoading(true);
    setError(null);

    try {
      const userId = resolveBackendUserId(backendUserId);
      const lista = await listarUsuariosParaInvitar(grupoId, userId);
      setUsuarios(lista);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar las personas.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [grupoId, backendUserId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ejecutarInvitacion = async () => {
    if (!grupoId || seleccionados.size === 0) return;

    setEnviando(true);
    try {
      const userId = resolveBackendUserId(backendUserId);
      const resultado = await invitarUsuarios(grupoId, [...seleccionados], userId);

      const nombres = resultado.invitados.map((u) => u.nombre);
      const mensaje =
        resultado.invitaciones_creadas > 0
          ? `Invitaciones enviadas a ${nombres.join(', ')}.`
          : 'Las personas seleccionadas ya tenían una invitación pendiente.';

      router.back();
      Alert.alert('Listo', mensaje);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudieron enviar las invitaciones.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Invitar personas' }} />
      <View style={styles.container}>
        <Text style={styles.descripcion}>
          Personas de tus otros grupos que podés invitar. Próximamente también desde amigos.
        </Text>

        {loading ? (
          <ActivityIndicator color="#4a9eff" size="large" style={styles.centrado} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={usuarios}
            keyExtractor={(item) => item.id}
            style={styles.lista}
            contentContainerStyle={usuarios.length === 0 ? styles.listaVacia : undefined}
            renderItem={({ item }) => {
              const seleccionado = seleccionados.has(item.id);
              const gruposTexto = item.grupos_origen.map((g) => g.nombre).join(', ');
              return (
                <TouchableOpacity
                  style={[styles.fila, seleccionado && styles.filaSeleccionada]}
                  onPress={() => toggleSeleccion(item.id)}
                  disabled={enviando}
                >
                  <AvatarFallback nombre={item.nombre} />
                  <View style={styles.filaContenido}>
                    <Text style={styles.nombre}>{item.nombre}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                    <Text style={styles.meta}>Grupo: {gruposTexto}</Text>
                  </View>
                  <View style={[styles.checkbox, seleccionado && styles.checkboxActivo]}>
                    {seleccionado && <Text style={styles.check}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.vacio}>
                No hay personas para invitar. Unite a otros grupos o esperá a que más integrantes se
                sumen a los tuyos.
              </Text>
            }
          />
        )}

        <TouchableOpacity
          style={[
            styles.botonInvitar,
            (seleccionados.size === 0 || enviando || loading) && styles.botonDeshabilitado,
          ]}
          onPress={() => void ejecutarInvitacion()}
          disabled={seleccionados.size === 0 || enviando || loading}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonInvitarTexto}>
              Invitar{seleccionados.size > 0 ? ` (${seleccionados.size})` : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 24, paddingBottom: 32 },
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
  filaSeleccionada: { borderColor: '#4a9eff', backgroundColor: '#1a2a3a' },
  filaContenido: { flex: 1, gap: 2 },
  nombre: { color: '#fff', fontSize: 16, fontWeight: '600' },
  email: { color: '#888', fontSize: 13 },
  meta: { color: '#666', fontSize: 12, marginTop: 2 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActivo: { borderColor: '#4a9eff', backgroundColor: '#4a9eff' },
  check: { color: '#fff', fontSize: 16, fontWeight: '700' },
  botonInvitar: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  botonDeshabilitado: { opacity: 0.5 },
  botonInvitarTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  centrado: { marginTop: 48 },
  vacio: { color: '#666', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  error: { color: '#ff6b6b', fontSize: 15, textAlign: 'center', marginTop: 24 },
});
