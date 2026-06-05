import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  RefreshControl,
  Pressable,
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
import { Btn, Field, TopBar, useTheme } from '@/components/MeshUI';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getGroupColor(nombre: string): string {
  const colors = ['#d76655', '#4a9eff', '#2f9e63', '#7a5ae0', '#c98a3e'];
  const charSum = nombre.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[charSum % colors.length];
}

export default function GruposScreen() {
  const { backendUserId, backendSyncing } = useAuth();
  const theme = useTheme();

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
        router.push({ pathname: '/grupo/[grupoId]', params: { grupoId: resultado.grupo_id } });
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
      router.push({ pathname: '/grupo/[grupoId]', params: { grupoId: grupo.id } });
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
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={[styles.hint, { color: theme.textDim }]}>Sincronizando usuario…</Text>
      </View>
    );
  }

  if (!backendUserId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.titulo, { color: theme.text }]}>Sin conexión al servidor</Text>
        <Text style={[styles.subtitulo, { color: theme.textDim }]}>
          No pudimos sincronizar tu usuario con la base de datos. Cerrá sesión e iniciá de nuevo con
          el backend corriendo en tu PC.
        </Text>
      </View>
    );
  }

  const rightHeader = (
    <Pressable
      onPress={() => router.push('/escanear-qr')}
      style={({ pressed }) => [
        styles.headerIconBtn,
        { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
      ]}
    >
      <MaterialCommunityIcons name="qrcode" size={18} color={theme.text} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TopBar title="Grupos" bordered={false} right={rightHeader} />

      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargarGrupos(true)}
            tintColor={theme.accent}
          />
        }
      >
        {mostrarFormulario ? (
          <View style={styles.formulario}>
            <Text style={[styles.formularioTitle, { color: theme.text }]}>Nuevo grupo</Text>
            <Text style={[styles.formularioSubtitle, { color: theme.textDim }]}>
              Creá tu grupo para organizar salidas y coordinar en tiempo real.
            </Text>
            
            <Field
              label="Nombre del grupo *"
              placeholder="Ej: Trail Riders Córdoba"
              placeholderTextColor={theme.textMute}
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
              maxLength={80}
              editable={!loading}
            />

            <View style={styles.formActions}>
              <Btn variant="primary" size="lg" block onPress={handleCrear} loading={loading}>
                Crear grupo
              </Btn>
              <Btn
                variant="ghost"
                size="lg"
                block
                onPress={() => {
                  setMostrarFormulario(false);
                  setNombre('');
                }}
                disabled={loading}
              >
                Cancelar
              </Btn>
            </View>
          </View>
        ) : (
          <>
            {/* Botón Escanear QR */}
            <Pressable
              style={({ pressed }) => [
                styles.qrBtn,
                {
                  backgroundColor: pressed ? theme.accentWeak : theme.surface,
                  borderColor: theme.accentLine,
                },
              ]}
              onPress={() => router.push('/escanear-qr')}
            >
              <Feather name="camera" size={16} color={theme.accent} style={styles.qrIcon} />
              <Text style={[styles.qrBtnText, { color: theme.accent }]}>
                Escanear QR para unirme
              </Text>
            </Pressable>

            {/* Invitaciones pendientes */}
            {invitaciones.length > 0 && (
              <View style={styles.seccionInvitaciones}>
                <Text style={[styles.seccionEyebrow, { color: theme.textDim }]}>
                  INVITACIONES PENDIENTES
                </Text>
                {invitaciones.map((inv) => {
                  const procesando = respondiendoId === inv.id;
                  const origenTexto = inv.grupo_origen
                    ? `desde ${inv.grupo_origen.nombre}`
                    : 'directamente';
                  return (
                    <View
                      key={inv.id}
                      style={[
                        styles.tarjetaInvitacion,
                        { backgroundColor: theme.surface, borderColor: theme.accentLine },
                      ]}
                    >
                      <View style={styles.invitacionRow}>
                        <View
                          style={[
                            styles.groupIconWrapper,
                            { backgroundColor: theme.accentWeak },
                          ]}
                        >
                          <Feather name="users" size={18} color={theme.accent} />
                        </View>
                        <View style={styles.invitacionText}>
                          <Text style={[styles.invitacionTitle, { color: theme.text }]}>
                            {inv.grupo.nombre}
                          </Text>
                          <Text style={[styles.invitacionMeta, { color: theme.textDim }]}>
                            {inv.invitado_por.nombre} te invitó {origenTexto}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.invitacionAcciones}>
                        <Btn
                          variant="primary"
                          size="sm"
                          style={styles.invBtn}
                          onPress={() => void ejecutarRespuesta(inv.id, 'aceptar')}
                          disabled={procesando}
                          loading={procesando}
                        >
                          Aceptar
                        </Btn>
                        <Btn
                          variant="secondary"
                          size="sm"
                          style={styles.invBtn}
                          onPress={() => void ejecutarRespuesta(inv.id, 'rechazar')}
                          disabled={procesando}
                        >
                          Rechazar
                        </Btn>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Listado de grupos */}
            <View style={styles.seccionGrupos}>
              <View style={styles.gruposHeaderRow}>
                <Text style={[styles.seccionEyebrow, { color: theme.textDim }]}>
                  TUS GRUPOS ({grupos.length})
                </Text>
              </View>

              {cargandoLista ? (
                <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />
              ) : grupos.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={[styles.subtitulo, { color: theme.textDim }]}>
                    Todavía no tenés grupos. Creá uno para organizar viajes e invitar personas.
                  </Text>
                  <Btn variant="primary" size="lg" block onPress={() => setMostrarFormulario(true)}>
                    Crear grupo
                  </Btn>
                </View>
              ) : (
                <View style={styles.lista}>
                  {grupos.map((g) => {
                    const groupColor = getGroupColor(g.nombre);
                    return (
                      <Pressable
                        key={g.id}
                        style={({ pressed }) => [
                          styles.tarjetaGrupo,
                          {
                            backgroundColor: pressed ? theme.surface2 : theme.surface,
                            borderColor: theme.border,
                          },
                        ]}
                        onPress={() => router.push({ pathname: '/grupo/[grupoId]', params: { grupoId: g.id } })}
                      >
                        <View
                          style={[
                            styles.groupIconWrapper,
                            { backgroundColor: `${groupColor}20` },
                          ]}
                        >
                          <Feather name="users" size={20} color={groupColor} />
                        </View>

                        <View style={styles.grupoText}>
                          <Text style={[styles.tarjetaNombre, { color: theme.text }]} numberOfLines={1}>
                            {g.nombre}
                          </Text>
                          <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
                            {`Creado el ${formatearFecha(g.fecha_creacion)}`}
                            {g.mi_rol === 'lider' ? ' · Líder' : ' · Participante'}
                          </Text>
                        </View>

                        <Feather name="chevron-right" size={18} color={theme.textMute} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Botón flotante FAB para crear grupo (solo visible si no se muestra el formulario) */}
      {!mostrarFormulario && (
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: theme.accent,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
          onPress={() => setMostrarFormulario(true)}
        >
          <Feather name="plus" size={20} color={theme.onAccent} />
          <Text style={[styles.fabText, { color: theme.onAccent }]}>Crear grupo</Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    padding: 20,
    paddingBottom: 100, // Espacio para el FAB flotante
    gap: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  hint: {
    fontSize: 14.5,
  },
  empty: {
    gap: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  formulario: {
    gap: 16,
  },
  formularioTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  formularioSubtitle: {
    fontSize: 14.5,
    marginTop: -8,
    lineHeight: 22,
    marginBottom: 8,
  },
  formActions: {
    gap: 10,
    marginTop: 14,
  },
  lista: {
    gap: 11,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitulo: {
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  qrIcon: {
    marginRight: 8,
  },
  qrBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  seccionInvitaciones: {
    gap: 12,
  },
  seccionGrupos: {
    gap: 12,
  },
  gruposHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  seccionEyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tarjetaInvitacion: {
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 16,
    gap: 14,
  },
  invitacionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invitacionText: {
    flex: 1,
  },
  invitacionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  invitacionMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  invitacionAcciones: {
    flexDirection: 'row',
    gap: 10,
  },
  invBtn: {
    flex: 1,
  },
  tarjetaGrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 14,
  },
  groupIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grupoText: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  tarjetaNombre: {
    fontSize: 16,
    fontWeight: '700',
  },
  tarjetaMeta: {
    fontSize: 13,
    marginTop: 3,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    gap: 8,
  },
  fabText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});

