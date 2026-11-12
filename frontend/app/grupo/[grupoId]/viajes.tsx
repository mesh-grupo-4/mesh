import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable } from '@/components/Pressable';
import { ActivityTile, Badge, TopBar, useTheme } from '@/components/MeshUI';
import { EstadoVacio } from '@/components/EstadoVacio';
import { Esqueleto } from '@/components/Esqueleto';
import { meshAlert } from '@/lib/meshAlert';
import { listarViajesGrupo, obtenerGrupo, type ViajeDeGrupoApi } from '@/lib/gruposApi';
import { resolveBackendUserId } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { etiquetaActividad } from '@/lib/activityDefaults';
import { colorModo, ETIQUETA_MODO, TONO_MODO } from '@/lib/modoViaje';
import { formatDurationHm, formatKm } from '@/lib/format';
import { aCamposArg, desdeCamposArg, formatearEnArg } from '@/lib/tiempoArg';

// Fin del día programado en hora argentina (RN-105): hasta ahí un planificado sigue
// siendo "próximo"; después, quedó sin hacerse.
function finDelDiaArg(iso: string): number {
  const campos = aCamposArg(new Date(iso));
  campos.setHours(23, 59, 59, 999);
  return desdeCamposArg(campos).getTime();
}

function fechaCorta(iso: string): string {
  return formatearEnArg(iso, { day: 'numeric', month: 'short', year: 'numeric' });
}

function fechaConHora(iso: string): string {
  return formatearEnArg(iso, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Separa los viajes del grupo en en curso / próximos / pasados, cada uno en su orden natural. */
function agrupar(viajes: ViajeDeGrupoApi[]) {
  const ahora = Date.now();
  const enCurso = viajes.filter((v) => v.estado === 'en_curso');
  const proximos = viajes
    .filter((v) => v.estado === 'planificado' && finDelDiaArg(v.fecha_programada) >= ahora)
    .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));
  const pasados = viajes
    .filter(
      (v) =>
        v.estado === 'finalizado' ||
        (v.estado === 'planificado' && finDelDiaArg(v.fecha_programada) < ahora)
    )
    .sort((a, b) =>
      (b.fecha_fin_real ?? b.fecha_programada).localeCompare(a.fecha_fin_real ?? a.fecha_programada)
    );
  return { enCurso, proximos, pasados };
}

export default function ViajesGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [viajes, setViajes] = useState<ViajeDeGrupoApi[]>([]);
  const [grupoNombre, setGrupoNombre] = useState<string | null>(null);
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
          listarViajesGrupo(grupoId),
        ]);
        setGrupoNombre(detalle.nombre);
        setViajes(lista);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudieron cargar los viajes.';
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

  const { enCurso, proximos, pasados } = useMemo(() => agrupar(viajes), [viajes]);

  const abrir = (v: ViajeDeGrupoApi) => {
    if (!v.participe) {
      meshAlert(
        'No fuiste parte de este viaje',
        'Lo hizo el grupo antes de que te sumaras o no participaste, así que no podés ver su detalle.'
      );
      return;
    }
    router.push({ pathname: '/viaje/[viajeId]', params: { viajeId: v.id } });
  };

  const seccion = (titulo: string, lista: ViajeDeGrupoApi[]) =>
    lista.length === 0 ? null : (
      <View style={styles.seccion}>
        <Text style={[styles.eyebrow, { color: theme.textDim }]}>
          {titulo} ({lista.length})
        </Text>
        {lista.map((v) => (
          <TarjetaViajeGrupo key={v.id} v={v} onPress={() => abrir(v)} />
        ))}
      </View>
    );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Viajes del grupo"
        sub={grupoNombre ?? undefined}
        onBack={() => router.back()}
        bordered={false}
      />

      {loading ? (
        <View style={styles.lista}>
          <Esqueleto ancho={90} alto={11} />
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} alto={110} radio={14} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void cargar(true)}
              tintColor={theme.accent}
            />
          }
        >
          <View style={styles.lista}>
            {viajes.length === 0 ? (
              <EstadoVacio
                icono="map"
                titulo="Todavía no hay viajes"
                texto="Cuando armen un viaje con este grupo, va a aparecer acá."
              />
            ) : (
              <>
                {seccion('EN CURSO', enCurso)}
                {seccion('PRÓXIMOS', proximos)}
                {seccion('PASADOS', pasados)}
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function TarjetaViajeGrupo({ v, onPress }: { v: ViajeDeGrupoApi; onPress: () => void }) {
  const theme = useTheme();
  const nombre = v.nombre ?? etiquetaActividad(v.tipo_actividad);
  const noRealizado = v.estado === 'planificado' && finDelDiaArg(v.fecha_programada) < Date.now();
  const atenuada = v.estado === 'finalizado' || noRealizado || !v.participe;

  const badge =
    v.estado === 'en_curso' ? (
      <Badge tone="live" pulse>
        En vivo
      </Badge>
    ) : v.estado === 'planificado' ? (
      noRealizado ? (
        <Badge tone="mute">No realizado</Badge>
      ) : (
        <Badge tone="accent">Planificado</Badge>
      )
    ) : (
      <Badge tone="mute">Finalizado</Badge>
    );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}${v.participe ? '' : ', no participaste'}`}
      style={({ pressed }) => [
        styles.tarjeta,
        { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[styles.tarjetaCuerpo, atenuada && styles.atenuada]}>
        <View style={styles.tarjetaHeader}>
          <ActivityTile activity={v.tipo_actividad} size={22} color={colorModo(v.modo, theme)} />
          <Text
            style={[styles.tarjetaTitulo, { color: atenuada ? theme.textDim : theme.text }]}
            numberOfLines={1}
          >
            {nombre}
          </Text>
          {badge}
        </View>

        <View style={styles.tarjetaInfo}>
          <Badge tone={TONO_MODO[v.modo]}>{ETIQUETA_MODO[v.modo]}</Badge>
        </View>

        <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
          <Feather name="calendar" size={12} />
          {'  '}
          {v.estado === 'planificado' ? fechaConHora(v.fecha_programada) : fechaCorta(v.fecha_programada)}
        </Text>
        <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
          <Feather name="user" size={12} />
          {'  '}Organizó {v.creador.nombre}
          {v.cantidad_participantes > 0
            ? ` · ${v.cantidad_participantes} ${v.cantidad_participantes === 1 ? 'participante' : 'participantes'}`
            : ''}
        </Text>

        {v.estado === 'finalizado' && (v.distancia_m != null || v.duracion_segundos != null) ? (
          <View style={[styles.tarjetaMetricas, { borderTopColor: theme.border }]}>
            <View style={styles.tarjetaMetrica}>
              <Text style={[styles.tarjetaMetricaValor, { color: theme.text }]}>
                {formatKm(v.distancia_m)}
              </Text>
              <Text style={[styles.tarjetaMetricaLabel, { color: theme.textMute }]}>Distancia</Text>
            </View>
            <View style={styles.tarjetaMetrica}>
              <Text style={[styles.tarjetaMetricaValor, { color: theme.text }]}>
                {formatDurationHm(v.duracion_segundos)}
              </Text>
              <Text style={[styles.tarjetaMetricaLabel, { color: theme.textMute }]}>Duración</Text>
            </View>
          </View>
        ) : null}

        {!v.participe ? (
          <Text style={[styles.tarjetaRol, { color: theme.textMute }]}>No participaste</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 15, textAlign: 'center', fontWeight: '600' },
  lista: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 22 },
  seccion: { gap: 10 },
  eyebrow: { fontSize: 11, fontFamily: 'SpaceMono', fontWeight: '700', letterSpacing: 1.2 },
  tarjeta: { borderRadius: 14, borderWidth: 1.2 },
  tarjetaCuerpo: { padding: 14, gap: 6 },
  atenuada: { opacity: 0.75 },
  tarjetaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tarjetaTitulo: { flex: 1, fontSize: 15.5, fontWeight: '700' },
  tarjetaInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tarjetaMeta: { fontSize: 13, lineHeight: 18 },
  tarjetaRol: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  tarjetaMetricas: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  tarjetaMetrica: { flex: 1, gap: 2 },
  tarjetaMetricaValor: { fontSize: 15, fontWeight: '800' },
  tarjetaMetricaLabel: { fontSize: 11, fontWeight: '600' },
});
