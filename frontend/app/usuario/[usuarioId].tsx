import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { ActivityTile, Avatar, Badge, Btn, TopBar, useTheme } from '@/components/MeshUI';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import { solicitarAmistad } from '@/lib/amistadesApi';
import { obtenerPerfilPublico, type PerfilPublicoApi } from '@/lib/usuariosApi';
import { formatDurationHm, formatKmCompact } from '@/lib/format';
import { meshAlert } from '@/lib/meshAlert';

const ETIQUETA_ACTIVIDAD: Record<string, string> = {
  moto: 'Moto',
  bici: 'Bici',
  running: 'Running',
  trekking: 'Trekking',
  otro: 'Otro',
};

export default function PerfilUsuarioScreen() {
  const { usuarioId } = useLocalSearchParams<{ usuarioId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [perfil, setPerfil] = useState<PerfilPublicoApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solicitando, setSolicitando] = useState(false);
  const [solicitudEnviadaLocal, setSolicitudEnviadaLocal] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuarioId) return;
    setCargando(true);
    setError(null);
    try {
      setPerfil(await obtenerPerfilPublico(usuarioId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil.');
    } finally {
      setCargando(false);
    }
  }, [usuarioId]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  const agregarAmigo = async () => {
    if (!usuarioId) return;
    setSolicitando(true);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await solicitarAmistad(usuarioId, userId);
      setSolicitudEnviadaLocal(true);
    } catch (e: unknown) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSolicitando(false);
    }
  };

  const relacion = solicitudEnviadaLocal ? 'solicitud_enviada' : perfil?.relacion_amistad ?? null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title={perfil ? perfil.nombre : 'Perfil'}
        onBack={() => router.back()}
        bordered={false}
      />

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : error || !perfil ? (
        <View style={styles.centrado}>
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {error ?? 'No se pudo cargar el perfil.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.inner}>
          <View style={styles.header}>
            <Avatar
              person={{ nombre: perfil.nombre, apellido: perfil.apellido ?? '', color: theme.accent }}
              size="lg"
              ring
            />
            <Text style={[styles.nombre, { color: theme.text }]}>
              {perfil.nombre} {perfil.apellido ?? ''}
              {perfil.es_yo ? ' (Vos)' : ''}
            </Text>
            {perfil.actividad_preferida ? (
              <View style={styles.actividadRow}>
                <ActivityTile activity={perfil.actividad_preferida} size={30} />
                <Text style={[styles.actividadTxt, { color: theme.textDim }]}>
                  {ETIQUETA_ACTIVIDAD[perfil.actividad_preferida] ?? perfil.actividad_preferida}
                </Text>
              </View>
            ) : null}
          </View>

          {!perfil.es_yo ? (
            <View style={styles.amistadRow}>
              {relacion === 'amigo' ? (
                <Badge tone="good">
                  <Feather name="check" size={10} color={theme.good} style={{ marginRight: 3 }} />
                  Son amigos
                </Badge>
              ) : relacion === 'solicitud_enviada' ? (
                <Badge tone="mute">Solicitud enviada</Badge>
              ) : relacion === 'solicitud_recibida' ? (
                <Badge tone="accent">Te envió una solicitud — respondé desde Amigos</Badge>
              ) : (
                <Btn
                  variant="secondary"
                  size="sm"
                  icon="user-plus"
                  onPress={() => void agregarAmigo()}
                  loading={solicitando}
                  disabled={solicitando}
                >
                  Agregar amigo
                </Btn>
              )}
            </View>
          ) : null}

          <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {perfil.estadisticas.viajes_finalizados}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMute }]}>Viajes</Text>
            </View>
            <View style={[styles.statBox, styles.borderLeft, { borderLeftColor: theme.border }]}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatKmCompact(perfil.estadisticas.distancia_total_m)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMute }]}>Km</Text>
            </View>
            <View style={[styles.statBox, styles.borderLeft, { borderLeftColor: theme.border }]}>
              <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
                {formatDurationHm(perfil.estadisticas.tiempo_total_seg)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMute }]}>En marcha</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.eyebrow, { color: theme.textDim }]}>RACHA</Text>
            <View style={[styles.rachaCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.rachaEmoji}>🔥</Text>
              <View style={styles.rachaTexto}>
                <Text style={[styles.rachaValor, { color: theme.text }]}>
                  {perfil.racha.semanas_consecutivas > 0
                    ? `${perfil.racha.semanas_consecutivas} semana${perfil.racha.semanas_consecutivas === 1 ? '' : 's'} seguidas`
                    : 'Sin racha activa'}
                </Text>
                {perfil.racha.en_riesgo ? (
                  <Text style={[styles.rachaHint, { color: theme.danger }]}>En riesgo esta semana</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.eyebrow, { color: theme.textDim }]}>INSIGNIAS</Text>
            {perfil.insignias.length === 0 ? (
              <Text style={[styles.vacio, { color: theme.textMute }]}>
                Todavía no consiguió ninguna.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.insigniasRow}
              >
                {perfil.insignias.map((ins) => (
                  <View
                    key={ins.id}
                    style={[styles.insigniaChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View style={[styles.insigniaIconWrap, { backgroundColor: theme.accentWeak }]}>
                      <Feather
                        name={ins.icono as keyof typeof Feather.glyphMap}
                        size={20}
                        color={theme.accent}
                      />
                    </View>
                    <Text style={[styles.insigniaNombre, { color: theme.text }]} numberOfLines={2}>
                      {ins.nombre}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 15, textAlign: 'center', fontWeight: '600' },
  inner: { padding: 20, paddingBottom: 40, gap: 20 },
  header: { alignItems: 'center', gap: 8 },
  nombre: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  actividadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  actividadTxt: { fontSize: 14, fontWeight: '600' },
  amistadRow: { alignItems: 'center' },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  borderLeft: { borderLeftWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  section: { gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  vacio: { fontSize: 13.5, lineHeight: 19 },
  rachaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rachaEmoji: { fontSize: 28 },
  rachaTexto: { flex: 1, gap: 2 },
  rachaValor: { fontSize: 15.5, fontWeight: '800' },
  rachaHint: { fontSize: 12.5, fontWeight: '600' },
  insigniasRow: { flexDirection: 'row', gap: 10, paddingVertical: 2, paddingRight: 4 },
  insigniaChip: {
    width: 92,
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  insigniaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insigniaNombre: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
