import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  crearGrupo,
  listarGrupos,
  listarInvitacionesPendientes,
  responderInvitacion,
  type GrupoListItemApi,
  type InvitacionPendienteApi,
} from '@/lib/gruposApi';

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function GruposScreen() {
  const { backendUserId, backendSyncing } = useAuth();
  const [grupos, setGrupos] = useState<GrupoListItemApi[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionPendienteApi[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null);

  const cargarGrupos = useCallback(async (esRefresh = false) => {
    if (backendSyncing) return;

    let userId: string;
    try {
      userId = resolveBackendUserId(backendUserId);
    } catch {
      setGrupos([]);
      setInvitaciones([]);
      setCargandoLista(false);
      setRefreshing(false);
      return;
    }

    if (esRefresh) setRefreshing(true);
    else setCargandoLista(true);

    try {
      const [data, pendientes] = await Promise.all([
        listarGrupos(userId),
        listarInvitacionesPendientes(userId),
      ]);
      setGrupos(data);
      setInvitaciones(pendientes);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los grupos.';
      if (!esRefresh) {
        Alert.alert('Error', msg);
      }
    } finally {
      setCargandoLista(false);
      setRefreshing(false);
    }
  }, [backendUserId, backendSyncing]);

  const ejecutarRespuesta = async (invitacionId: string, accion: 'aceptar' | 'rechazar') => {
    let userId: string;
    try {
      userId = resolveBackendUserId(backendUserId);
    } catch {
      Alert.alert('Error', 'No se pudo identificar tu usuario.');
      return;
    }

    setRespondiendoId(invitacionId);
    try {
      const resultado = await responderInvitacion(invitacionId, accion, userId);
      await cargarGrupos(true);

      if (accion === 'aceptar') {
        Alert.alert('Listo', `Te uniste al grupo "${resultado.grupo_nombre}".`);
        router.push(`/grupo/${resultado.grupo_id}`);
      } else {
        Alert.alert('Listo', `Rechazaste la invitación a "${resultado.grupo_nombre}".`);
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo responder la invitación.');
    } finally {
      setRespondiendoId(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void cargarGrupos();
    }, [cargarGrupos])
  );

  const handleCrear = async () => {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre del grupo es obligatorio.');
      return;
    }

    let userId: string;
    try {
      userId = resolveBackendUserId(backendUserId);
    } catch {
      Alert.alert('Error', 'No se pudo identificar tu usuario. Volvé a iniciar sesión.');
      return;
    }

    setLoading(true);
    try {
      const grupo = await crearGrupo(nombre.trim(), userId);
      setNombre('');
      setMostrarFormulario(false);
      await cargarGrupos();
      router.push(`/grupo/${grupo.id}`);
      Alert.alert('Listo', 'Grupo creado correctamente.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      const esRed = msg.includes('Network') || msg.includes('Failed to fetch');
      Alert.alert(
        'Error',
        esRed || !msg
          ? 'Hubo un error al crear el grupo. Inténtalo más tarde.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  if (backendSyncing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4a9eff" />
        <Text style={styles.hint}>Sincronizando usuario…</Text>
      </View>
    );
  }

  if (!backendUserId) {
    return (
      <View style={styles.center}>
        <Text style={styles.titulo}>Sin conexión al servidor</Text>
        <Text style={styles.subtitulo}>
          No pudimos sincronizar tu usuario con la base de datos. Cerrá sesión e iniciá de nuevo con
          el backend corriendo en tu PC.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargarGrupos(true)}
            tintColor="#4a9eff"
          />
        }
      >
        {mostrarFormulario ? (
          <View style={styles.formulario}>
            <Text style={styles.titulo}>Nuevo grupo</Text>
            <Text style={styles.label}>Nombre del grupo *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Trail Riders Córdoba"
              placeholderTextColor="#888"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
              maxLength={80}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.botonPrimario, loading && styles.botonDisabled]}
              onPress={handleCrear}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botonPrimarioTexto}>Crear</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.botonSecundario}
              onPress={() => {
                setMostrarFormulario(false);
                setNombre('');
              }}
              disabled={loading}
            >
              <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.titulo}>Tus grupos</Text>
              <TouchableOpacity
                style={styles.botonPrimarioCompacto}
                onPress={() => setMostrarFormulario(true)}
              >
                <Text style={styles.botonPrimarioTexto}>+ Crear</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.botonEscanearQr}
              onPress={() => router.push('/escanear-qr')}
            >
              <Text style={styles.botonEscanearQrTexto}>Escanear QR para unirse</Text>
            </TouchableOpacity>

            {invitaciones.length > 0 && (
              <View style={styles.seccionInvitaciones}>
                <Text style={styles.seccionTitulo}>Invitaciones pendientes</Text>
                {invitaciones.map((inv) => {
                  const procesando = respondiendoId === inv.id;
                  return (
                    <View key={inv.id} style={styles.tarjetaInvitacion}>
                      <Text style={styles.invitacionTitulo}>{inv.grupo.nombre}</Text>
                      <Text style={styles.invitacionMeta}>
                        {inv.invitado_por.nombre} te invitó desde {inv.grupo_origen.nombre}
                      </Text>
                      <View style={styles.invitacionAcciones}>
                        <TouchableOpacity
                          style={[styles.botonAceptar, procesando && styles.botonDisabled]}
                          onPress={() => void ejecutarRespuesta(inv.id, 'aceptar')}
                          disabled={procesando}
                        >
                          {procesando ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={styles.botonAceptarTexto}>Aceptar</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.botonRechazar, procesando && styles.botonDisabled]}
                          onPress={() => void ejecutarRespuesta(inv.id, 'rechazar')}
                          disabled={procesando}
                        >
                          <Text style={styles.botonRechazarTexto}>Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {cargandoLista ? (
              <ActivityIndicator color="#4a9eff" style={{ marginTop: 32 }} />
            ) : grupos.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.subtitulo}>
                  Todavía no tenés grupos. Creá uno para organizar viajes e invitar personas.
                </Text>
                <TouchableOpacity
                  style={styles.botonPrimario}
                  onPress={() => setMostrarFormulario(true)}
                >
                  <Text style={styles.botonPrimarioTexto}>Crear grupo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.lista}>
                {grupos.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.tarjeta}
                    onPress={() => router.push(`/grupo/${g.id}`)}
                  >
                    <Text style={styles.tarjetaNombre}>{g.nombre}</Text>
                    <Text style={styles.tarjetaMeta}>
                      {formatearFecha(g.fecha_creacion)}
                      {g.mi_rol === 'lider' ? ' · Líder' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  inner: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  hint: { color: '#888', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  empty: { gap: 16, marginTop: 8 },
  formulario: { gap: 12 },
  lista: { gap: 10 },
  titulo: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitulo: { color: '#888', fontSize: 15, lineHeight: 22 },
  label: { color: '#aaa', fontSize: 14, marginTop: 8 },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tarjeta: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tarjetaNombre: { color: '#fff', fontSize: 17, fontWeight: '600' },
  tarjetaMeta: { color: '#888', fontSize: 13, marginTop: 4 },
  botonPrimario: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  botonPrimarioCompacto: {
    backgroundColor: '#4a9eff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  botonEscanearQr: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a9eff',
    marginBottom: 16,
  },
  botonEscanearQrTexto: { color: '#4a9eff', fontSize: 15, fontWeight: '600' },
  seccionInvitaciones: { gap: 10, marginBottom: 20 },
  seccionTitulo: { color: '#fff', fontSize: 18, fontWeight: '600' },
  tarjetaInvitacion: {
    backgroundColor: '#1a2a1a',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a4a2a',
    gap: 8,
  },
  invitacionTitulo: { color: '#fff', fontSize: 16, fontWeight: '600' },
  invitacionMeta: { color: '#888', fontSize: 13, lineHeight: 18 },
  invitacionAcciones: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
  botonPrimarioTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  botonSecundario: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  botonSecundarioTexto: { color: '#888', fontSize: 15 },
  botonDisabled: { opacity: 0.6 },
});
