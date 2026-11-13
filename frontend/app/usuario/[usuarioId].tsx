import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { ActivityTile, Avatar, TopBar, useTheme } from '@/components/MeshUI';
import { DetalleInsigniaModal } from '@/components/perfil/DetalleInsigniaModal';
import { FondoMesh, FundidoMesh } from '@/components/perfil/FondoMesh';
import { FueguitosRacha } from '@/components/perfil/FueguitosRacha';
import { InsigniaChip, ordenarPorRareza } from '@/components/perfil/InsigniaChip';
import { TarjetaRacha } from '@/components/perfil/TarjetaRacha';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  cancelarSolicitudAmistad,
  eliminarAmigo,
  solicitarAmistad,
  type RelacionAmistad,
} from '@/lib/amistadesApi';
import type { InsigniaObtenidaApi } from '@/lib/insigniasApi';
import { intensidadRacha, nivelRacha } from '@/lib/rachasApi';
import { obtenerPerfilPublico, type PerfilPublicoApi } from '@/lib/usuariosApi';
import { formatDurationHm, formatKmCompact } from '@/lib/format';
import { meshAlert, meshConfirmDestructive } from '@/lib/meshAlert';
import { nombreCompleto } from '@/lib/nombres';

const ETIQUETA_ACTIVIDAD: Record<string, string> = {
  moto: 'Moto',
  auto: 'Auto',
  bici: 'Bici',
  running: 'Running',
  trekking: 'Trekking',
  otro: 'Otro',
};

const ALTO_FONDO = 420;
const ALTO_FUEGUITOS = 320;

/**
 * Perfil de otra persona de la comunidad: datos básicos y botón de amistad siempre;
 * estadísticas, racha e insignias solo si las comparte con quien mira (RN-077).
 */
export default function PerfilUsuarioScreen() {
  const { usuarioId } = useLocalSearchParams<{ usuarioId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [perfil, setPerfil] = useState<PerfilPublicoApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Una sola acción de amistad en curso a la vez (enviar, deshacer o dejar de ser amigos).
  const [procesandoAmistad, setProcesandoAmistad] = useState(false);
  // Relación tras una acción local; `undefined` = usar la que vino con el perfil.
  const [relacionLocal, setRelacionLocal] = useState<RelacionAmistad | undefined>(undefined);
  const [insigniaAbierta, setInsigniaAbierta] = useState<InsigniaObtenidaApi | null>(null);
  // Cambia cada vez que llega el perfil: remonta los fueguitos y repite la ráfaga.
  const [rafagaFueguitos, setRafagaFueguitos] = useState(0);

  const cargar = useCallback(async () => {
    if (!usuarioId) return;
    setCargando(true);
    setError(null);
    try {
      setPerfil(await obtenerPerfilPublico(usuarioId));
      setRelacionLocal(undefined);
      setRafagaFueguitos((n) => n + 1);
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
    setProcesandoAmistad(true);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await solicitarAmistad(usuarioId, userId);
      setRelacionLocal('solicitud_enviada');
    } catch (e: unknown) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setProcesandoAmistad(false);
    }
  };

  const deshacerSolicitud = () => {
    if (!usuarioId || !perfil) return;
    meshConfirmDestructive({
      title: 'Deshacer solicitud',
      message: `¿Querés cancelar la solicitud de amistad que le enviaste a ${perfil.nombre}?`,
      confirmLabel: 'Deshacer solicitud',
      onConfirm: async () => {
        setProcesandoAmistad(true);
        try {
          await cancelarSolicitudAmistad(usuarioId);
          setRelacionLocal(null);
        } catch (e: unknown) {
          meshAlert('Error', e instanceof Error ? e.message : 'No se pudo deshacer la solicitud.');
          // Puede que ya la haya aceptado o rechazado: se trae el estado real.
          void cargar();
        } finally {
          setProcesandoAmistad(false);
        }
      },
    });
  };

  const quitarAmigo = () => {
    if (!usuarioId || !perfil) return;
    meshConfirmDestructive({
      title: 'Dejar de ser amigos',
      message: `¿Querés dejar de ser amigo de ${perfil.nombre}? Lo vas a quitar de tu lista de amigos.`,
      confirmLabel: 'Dejar de ser amigos',
      onConfirm: async () => {
        setProcesandoAmistad(true);
        try {
          await eliminarAmigo(usuarioId, resolveBackendUserId(backendUserId));
          setRelacionLocal(null);
          // Si solo comparte sus logros con amigos, dejan de ser visibles: se recarga.
          if (perfil.visibilidad_logros === 'amigos') void cargar();
        } catch (e: unknown) {
          meshAlert('Error', e instanceof Error ? e.message : 'No se pudo eliminar al amigo.');
        } finally {
          setProcesandoAmistad(false);
        }
      },
    });
  };

  const relacion: RelacionAmistad =
    relacionLocal !== undefined ? relacionLocal : perfil?.relacion_amistad ?? null;

  // Todo lo de amistad vive en un solo control, arriba a la derecha.
  const controlAmistad = (() => {
    if (!perfil || perfil.es_yo) return null;
    const conf =
      relacion === 'amigo'
        ? {
            icono: 'user-check' as const,
            texto: 'Amigos',
            color: theme.good,
            relleno: false,
            accion: quitarAmigo,
            a11y: 'Son amigos. Tocá para dejar de ser amigos',
          }
        : relacion === 'solicitud_enviada'
          ? {
              icono: 'clock' as const,
              texto: 'Solicitud enviada',
              color: theme.textDim,
              relleno: false,
              accion: deshacerSolicitud,
              a11y: 'Solicitud enviada. Tocá para deshacerla',
            }
          : relacion === 'solicitud_recibida'
            ? {
                icono: 'user-plus' as const,
                texto: 'Responder solicitud',
                color: theme.accent,
                relleno: false,
                accion: () => router.push('/amigos/solicitudes'),
                a11y: 'Te envió una solicitud de amistad. Tocá para responderla',
              }
            : {
                icono: 'user-plus' as const,
                texto: 'Agregar amigo',
                color: theme.accent,
                relleno: true,
                accion: () => void agregarAmigo(),
                a11y: 'Enviar solicitud de amistad',
              };
    const colorContenido = conf.relleno ? theme.onAccent : conf.color;
    return (
      <Pressable
        onPress={conf.accion}
        disabled={procesandoAmistad}
        accessibilityRole="button"
        accessibilityLabel={conf.a11y}
        style={({ pressed }) => [
          styles.amistadBtn,
          conf.relleno
            ? { backgroundColor: conf.color, borderColor: conf.color }
            : { backgroundColor: theme.surface, borderColor: `${conf.color}66` },
          { opacity: pressed || procesandoAmistad ? 0.7 : 1 },
        ]}
      >
        {procesandoAmistad ? (
          <ActivityIndicator color={colorContenido} size="small" />
        ) : (
          <>
            <Feather name={conf.icono} size={16} color={colorContenido} />
            <Text style={[styles.amistadTxt, { color: colorContenido }]} numberOfLines={1}>
              {conf.texto}
            </Text>
            {relacion === 'solicitud_enviada' ? (
              <Feather name="x" size={16} color={colorContenido} />
            ) : relacion === 'amigo' ? (
              <Feather name="chevron-down" size={16} color={colorContenido} />
            ) : null}
          </>
        )}
      </Pressable>
    );
  })();

  const semanas = perfil?.logros_visibles ? (perfil.racha?.semanas_consecutivas ?? 0) : 0;
  const nivel = nivelRacha(semanas);
  const insignias = perfil?.insignias ? ordenarPorRareza(perfil.insignias) : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Recién con el perfil cargado: sin la cabecera encima, el patrón quedaba cortado en seco. */}
      {perfil ? (
        <FondoMesh
          color={theme.text}
          alto={ALTO_FONDO}
          colorRacha={theme.fire}
          intensidadRacha={intensidadRacha(semanas)}
          animado
        />
      ) : null}
      <TopBar
        title=""
        onBack={() => router.back()}
        bordered={false}
        transparente
        right={controlAmistad}
      />

      {cargando && !perfil ? (
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
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.cabecera}>
            <View style={styles.fundido}>
              <FundidoMesh color={theme.background} />
            </View>
            <Avatar
              person={{
                nombre: perfil.nombre,
                apellido: perfil.apellido ?? '',
                color: theme.accent,
                foto: perfil.foto_perfil,
              }}
              size="xl"
              ring={nivel >= 2}
              style={nivel >= 2 ? { borderColor: theme.fire } : undefined}
            />
            <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
              {nombreCompleto(perfil.nombre, perfil.apellido)}
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

          {/* Fondo liso: tapa el patrón de la cabecera, que queda fijo detrás del scroll. */}
          <View style={[styles.cuerpo, { backgroundColor: theme.background }]}>
            {perfil.logros_visibles && perfil.estadisticas ? (
              <>
                <View
                  style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
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
                  <TarjetaRacha racha={perfil.racha} propia={perfil.es_yo} />
                </View>

                <View style={styles.section}>
                  <Text style={[styles.eyebrow, { color: theme.textDim }]}>
                    INSIGNIAS{insignias.length > 0 ? ` · ${insignias.length}` : ''}
                  </Text>
                  {insignias.length === 0 ? (
                    <Text style={[styles.vacio, { color: theme.textMute }]}>
                      Todavía no consiguió ninguna.
                    </Text>
                  ) : (
                    <View style={styles.insigniasGrid}>
                      {insignias.map((ins) => (
                        <InsigniaChip key={ins.id} insignia={ins} onPress={setInsigniaAbierta} />
                      ))}
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View
                style={[styles.privadoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[styles.privadoIcono, { backgroundColor: theme.surface2 }]}>
                  <Feather name="lock" size={22} color={theme.textDim} />
                </View>
                <Text style={[styles.privadoTitulo, { color: theme.text }]}>Logros privados</Text>
                <Text style={[styles.privadoTexto, { color: theme.textDim }]}>
                  {perfil.visibilidad_logros === 'amigos'
                    ? relacion === null
                      ? `${perfil.nombre} solo comparte sus estadísticas, racha e insignias con sus amigos. Mandale una solicitud para verlos.`
                      : `${perfil.nombre} solo comparte sus estadísticas, racha e insignias con sus amigos.`
                    : `${perfil.nombre} prefiere mantener sus estadísticas, racha e insignias en privado.`}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {rafagaFueguitos > 0 && semanas > 0 ? (
        <FueguitosRacha key={rafagaFueguitos} semanas={semanas} alto={ALTO_FUEGUITOS} />
      ) : null}

      <DetalleInsigniaModal insignia={insigniaAbierta} onClose={() => setInsigniaAbierta(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 15, textAlign: 'center', fontWeight: '600' },
  scroll: { flexGrow: 1 },
  cabecera: { alignItems: 'center', gap: 8, paddingTop: 4, paddingBottom: 20, paddingHorizontal: 20 },
  fundido: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 170 },
  nombre: { fontSize: 26, fontWeight: '600', letterSpacing: -0.3, marginTop: 12, textAlign: 'center' },
  actividadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  actividadTxt: { fontSize: 14, fontWeight: '600' },
  // Misma altura que el botón de volver.
  amistadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    minWidth: 40,
    flexShrink: 1,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  amistadTxt: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  cuerpo: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  statsCard: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, paddingVertical: 16 },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  borderLeft: { borderLeftWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  section: { gap: 10 },
  eyebrow: { fontSize: 11, fontFamily: 'SpaceMono', fontWeight: '700', letterSpacing: 1.2 },
  vacio: { fontSize: 13.5, lineHeight: 19 },
  insigniasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  privadoCard: { alignItems: 'center', gap: 8, padding: 22, borderRadius: 16, borderWidth: 1 },
  privadoIcono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privadoTitulo: { fontSize: 16, fontWeight: '800' },
  privadoTexto: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
