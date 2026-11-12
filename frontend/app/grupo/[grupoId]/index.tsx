import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCopilot } from 'react-native-copilot';
import { Pressable } from '@/components/Pressable';
import { meshAlert } from '@/lib/meshAlert';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  listarMiembrosGrupo,
  obtenerGrupo,
  type GrupoDetalleApi,
  type GrupoMiembroApi,
} from '@/lib/gruposApi';
import { formatearEnArg } from '@/lib/tiempoArg';
import { Btn, TopBar, useTheme } from '@/components/MeshUI';
import { inicialesDe } from '@/components/AvatarFallback';
import { Esqueleto } from '@/components/Esqueleto';
import { PasoAyuda } from '@/components/ayuda/PasoAyuda';
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda';
import { AYUDA_GRUPO_DETALLE } from '@/components/ayuda/contenidoAyuda';
import { colorDeGrupo } from '@/components/grupos/TarjetaGrupo';
import { FilaMiembro, ordenarMiembros } from '@/components/grupos/FilaMiembro';
import { abrirNuevoViaje } from '@/lib/nuevoViaje';

/** Cuántos integrantes se muestran en el detalle; el resto, en "Ver todos". */
const MIEMBROS_PREVIEW = 5;

export default function GrupoDetalleScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();
  const { start } = useCopilot();

  const [grupo, setGrupo] = useState<GrupoDetalleApi | null>(null);
  const [miembros, setMiembros] = useState<GrupoMiembroApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setGrupo(detalle);
        setMiembros(ordenarMiembros(lista));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo cargar el grupo.';
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

  const esLider = grupo?.mi_rol === 'lider';
  const color = grupo ? colorDeGrupo(grupo.nombre) : theme.accent;
  const preview = miembros.slice(0, MIEMBROS_PREVIEW);

  const verMiembros = () =>
    router.push({ pathname: '/grupo/[grupoId]/miembros', params: { grupoId } });
  const invitar = () =>
    router.push({ pathname: '/grupo/[grupoId]/invitar-desde-grupos', params: { grupoId } });
  const verPerfil = (usuarioId: string) =>
    router.push({ pathname: '/usuario/[usuarioId]', params: { usuarioId } });

  const ajustes = grupo ? (
    <Pressable
      onPress={() => router.push({ pathname: '/grupo/[grupoId]/editar', params: { grupoId } })}
      accessibilityRole="button"
      accessibilityLabel="Ajustes del grupo"
      style={({ pressed }) => [
        styles.botonRedondo,
        { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
      ]}
    >
      <Feather name="settings" size={17} color={theme.text} />
    </Pressable>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <TopBar
        title=""
        onBack={() => router.back()}
        bordered={false}
        right={ajustes}
        onAyuda={() => start()}
      />

      <ScrollViewAyuda
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargar(true)}
            tintColor={theme.accent}
          />
        }
      >
        {loading ? (
          <DetalleEsqueleto />
        ) : error || !grupo ? (
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
        ) : (
          <>
            {/* Identidad del grupo + estadísticas */}
            <PasoAyuda {...AYUDA_GRUPO_DETALLE[0]!}>
              <View style={styles.hero}>
                <View
                  style={[
                    styles.avatarGrupo,
                    { backgroundColor: `${color}22`, borderColor: `${color}66` },
                  ]}
                >
                  <Text style={[styles.avatarGrupoTexto, { color }]}>
                    {inicialesDe(grupo.nombre)}
                  </Text>
                </View>

                <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
                  {grupo.nombre}
                </Text>

                <View
                  style={[
                    styles.miRol,
                    { backgroundColor: esLider ? theme.goldWeak : theme.surface2 },
                  ]}
                >
                  {esLider ? (
                    <MaterialCommunityIcons name="crown" size={14} color={theme.gold} />
                  ) : (
                    <Feather name="user" size={13} color={theme.textDim} />
                  )}
                  <Text style={[styles.miRolTexto, { color: esLider ? theme.gold : theme.textDim }]}>
                    {esLider ? 'Sos el líder' : 'Sos participante'}
                  </Text>
                </View>

                <View style={styles.stats}>
                  <Stat
                    icono="users"
                    valor={String(grupo.cantidad_miembros)}
                    etiqueta={grupo.cantidad_miembros === 1 ? 'Miembro' : 'Miembros'}
                  />
                  <Stat
                    icono="map"
                    valor={String(grupo.cantidad_viajes)}
                    etiqueta={grupo.cantidad_viajes === 1 ? 'Viaje' : 'Viajes'}
                  />
                  <Stat
                    icono="calendar"
                    valor={formatearEnArg(grupo.fecha_creacion, { month: 'short', year: '2-digit' })}
                    etiqueta="Desde"
                  />
                </View>
              </View>
            </PasoAyuda>

            {/* Acciones principales */}
            <View style={styles.acciones}>
              <PasoAyuda {...AYUDA_GRUPO_DETALLE[1]!} estilo={styles.flex}>
                <Btn
                  variant="primary"
                  size="lg"
                  block
                  icon="plus"
                  onPress={() => abrirNuevoViaje({ grupo: grupo.id })}
                >
                  Nuevo viaje
                </Btn>
              </PasoAyuda>
              {esLider ? (
                <PasoAyuda {...AYUDA_GRUPO_DETALLE[3]!}>
                  <Btn variant="secondary" size="lg" icon="user-plus" onPress={invitar}>
                    Invitar
                  </Btn>
                </PasoAyuda>
              ) : null}
            </View>

            {/* Miembros */}
            <PasoAyuda {...AYUDA_GRUPO_DETALLE[2]!}>
              <View style={styles.seccion}>
                <View style={styles.seccionHeader}>
                  <Text style={[styles.eyebrow, { color: theme.textDim }]}>
                    MIEMBROS ({miembros.length})
                  </Text>
                  <Pressable onPress={verMiembros} hitSlop={8} accessibilityRole="button">
                    <Text style={[styles.verTodos, { color: theme.accent }]}>Ver todos</Text>
                  </Pressable>
                </View>

                <View
                  style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  {preview.map((m, i) => {
                    const esYo = m.id === backendUserId;
                    return (
                      <FilaMiembro
                        key={m.id}
                        miembro={m}
                        esYo={esYo}
                        separador={i > 0}
                        onPress={esYo ? undefined : () => verPerfil(m.id)}
                      />
                    );
                  })}

                  {miembros.length > MIEMBROS_PREVIEW ? (
                    <Pressable
                      onPress={verMiembros}
                      style={({ pressed }) => [
                        styles.filaExtra,
                        { borderTopColor: theme.border },
                        pressed && { backgroundColor: theme.surface2 },
                      ]}
                    >
                      <Text style={[styles.filaExtraTexto, { color: theme.text }]}>
                        Ver los {miembros.length} miembros
                      </Text>
                      <Feather name="chevron-right" size={18} color={theme.textMute} />
                    </Pressable>
                  ) : null}

                  {esLider ? (
                    <Pressable
                      onPress={invitar}
                      style={({ pressed }) => [
                        styles.filaExtra,
                        { borderTopColor: theme.border },
                        pressed && { backgroundColor: theme.surface2 },
                      ]}
                    >
                      <View style={[styles.iconoInvitar, { backgroundColor: theme.accentWeak }]}>
                        <Feather name="user-plus" size={18} color={theme.accent} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={[styles.filaExtraTexto, { color: theme.accent }]}>
                          Invitar personas
                        </Text>
                        <Text style={[styles.filaExtraSub, { color: theme.textDim }]}>
                          Por usuario o desde otros grupos
                        </Text>
                      </View>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </PasoAyuda>
          </>
        )}
      </ScrollViewAyuda>
    </View>
  );
}

function Stat({
  icono,
  valor,
  etiqueta,
}: {
  icono: keyof typeof Feather.glyphMap;
  valor: string;
  etiqueta: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Feather name={icono} size={15} color={theme.textMute} />
      <Text style={[styles.statValor, { color: theme.text }]} numberOfLines={1}>
        {valor}
      </Text>
      <Text style={[styles.statEtiqueta, { color: theme.textDim }]}>{etiqueta}</Text>
    </View>
  );
}

function DetalleEsqueleto() {
  return (
    <View style={styles.hero}>
      <Esqueleto ancho={88} alto={88} radio={26} />
      <Esqueleto ancho="55%" alto={24} />
      <Esqueleto ancho={120} alto={24} radio={12} />
      <View style={styles.stats}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.flex}>
            <Esqueleto alto={84} radio={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 22,
  },
  botonRedondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 10,
  },
  avatarGrupo: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGrupoTexto: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  nombre: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginTop: 4,
  },
  miRol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  miRolTexto: {
    fontSize: 13,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    alignSelf: 'stretch',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  statValor: {
    fontSize: 19,
    fontWeight: '800',
    fontFamily: 'SpaceMono',
  },
  statEtiqueta: {
    fontSize: 10.5,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  acciones: {
    flexDirection: 'row',
    gap: 10,
  },
  seccion: {
    gap: 10,
  },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  verTodos: {
    fontSize: 14,
    fontWeight: '700',
  },
  tarjeta: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filaExtra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  filaExtraTexto: {
    fontSize: 15,
    fontWeight: '700',
  },
  filaExtraSub: {
    fontSize: 13,
    marginTop: 2,
  },
  // Mismo ancho que el avatar con anillo de `FilaMiembro`: los textos quedan alineados.
  iconoInvitar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },
});
