import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Pressable } from '@/components/Pressable';
import { meshAlert } from '@/lib/meshAlert';
import { useAuth } from '@/context/AuthContext';
import { nombreCompleto } from '@/lib/nombres';
import { router, useFocusEffect } from 'expo-router';
import { resolveBackendUserId } from '@/lib/apiClient';
import { listarSolicitudesAmistadPendientes } from '@/lib/amistadesApi';
import { listarMisInsignias, type InsigniaObtenidaApi } from '@/lib/insigniasApi';
import { intensidadRacha, nivelRacha, obtenerMiRacha, type RachaApi } from '@/lib/rachasApi';
import { usePreferenciaTema } from '@/lib/temaApp';
import { elegirVibracionAvisos, useVibracionAvisos } from '@/lib/vibracionPrefs';
import { Avatar, TopBar, useTheme } from '@/components/MeshUI';
import { BotonAyuda } from '@/components/ayuda/BotonAyuda';
import { PasoAyuda } from '@/components/ayuda/PasoAyuda';
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda'
import { AYUDA_PERFIL } from '@/components/ayuda/contenidoAyuda';
import { FilaOpcion } from '@/components/perfil/FilaOpcion';
import { FondoMesh, FundidoMesh } from '@/components/perfil/FondoMesh';
import { FueguitosRacha } from '@/components/perfil/FueguitosRacha';
import { DetalleInsigniaModal } from '@/components/perfil/DetalleInsigniaModal';
import { InsigniaChip, ordenarPorRareza } from '@/components/perfil/InsigniaChip';
import { TarjetaRacha } from '@/components/perfil/TarjetaRacha';
import { etiquetaTema } from '@/components/SelectorTema';
import { Feather } from '@expo/vector-icons';

const ALTO_FONDO = 460;
const ALTO_FUEGUITOS = 340;

export default function PerfilScreen() {
  const espacioTabBar = useEspacioTabBar()
  const { user, profile, logout, backendUserId, esSuperadmin } = useAuth();
  const theme = useTheme();
  const preferenciaTema = usePreferenciaTema();
  const vibracionAvisos = useVibracionAvisos();

  const [loggingOut, setLoggingOut] = useState(false);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  const [insignias, setInsignias] = useState<InsigniaObtenidaApi[]>([]);
  const [cargandoInsignias, setCargandoInsignias] = useState(true);
  const [racha, setRacha] = useState<RachaApi | null>(null);
  const [cargandoRacha, setCargandoRacha] = useState(true);
  // Cambia cada vez que llega la racha al entrar: remonta los fueguitos y repite la ráfaga.
  const [rafagaFueguitos, setRafagaFueguitos] = useState(0);
  const [insigniaAbierta, setInsigniaAbierta] = useState<InsigniaObtenidaApi | null>(null);

  const cargarInsignias = useCallback(async () => {
    try {
      resolveBackendUserId(backendUserId);
    } catch {
      setInsignias([]);
      setCargandoInsignias(false);
      return;
    }
    setCargandoInsignias(true);
    try {
      setInsignias(ordenarPorRareza(await listarMisInsignias()));
    } catch {
      setInsignias([]);
    } finally {
      setCargandoInsignias(false);
    }
  }, [backendUserId]);

  const cargarRacha = useCallback(async () => {
    try {
      resolveBackendUserId(backendUserId);
    } catch {
      setRacha(null);
      setCargandoRacha(false);
      return;
    }
    setCargandoRacha(true);
    try {
      setRacha(await obtenerMiRacha());
      setRafagaFueguitos((n) => n + 1);
    } catch {
      setRacha(null);
    } finally {
      setCargandoRacha(false);
    }
  }, [backendUserId]);

  const cargarSolicitudes = useCallback(async () => {
    let userId: string;
    try {
      userId = resolveBackendUserId(backendUserId);
    } catch {
      setSolicitudesPendientes(0);
      return;
    }
    const solicitudes = await listarSolicitudesAmistadPendientes(userId).catch(() => null);
    setSolicitudesPendientes(solicitudes?.length ?? 0);
  }, [backendUserId]);

  useFocusEffect(
    useCallback(() => {
      void cargarSolicitudes();
      void cargarInsignias();
      void cargarRacha();
    }, [cargarSolicitudes, cargarInsignias, cargarRacha])
  );

  const cerrarSesion = () => {
    meshAlert('Cerrar sesión', '¿Estás seguro que querés cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            router.replace('/(auth)/login');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const persona = {
    nombre: profile?.nombre || 'U',
    apellido: profile?.apellido || '',
    color: theme.accent,
    foto: profile?.photoUri,
  };

  const semanasRacha = racha?.semanas_consecutivas ?? 0;
  const nivel = nivelRacha(semanasRacha);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FondoMesh
        color={theme.text}
        alto={ALTO_FONDO}
        colorRacha={theme.fire}
        intensidadRacha={intensidadRacha(semanasRacha)}
      />

      <TopBar
        title=""
        raiz
        bordered={false}
        transparente
        right={
          <View style={styles.acciones}>
            <BotonAyuda />
            <PasoAyuda {...AYUDA_PERFIL[0]!}>
              <Pressable
                onPress={() => router.push('/editar-perfil')}
                accessibilityRole="button"
                accessibilityLabel="Ver y editar datos personales"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.botonLapiz,
                  {
                    backgroundColor: pressed ? theme.surface2 : theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Feather name="edit-2" size={19} color={theme.text} />
              </Pressable>
            </PasoAyuda>
          </View>
        }
      />

      <ScrollViewAyuda contentContainerStyle={styles.scroll}>
        <View style={styles.cabecera}>
          <View style={styles.fundido}>
            <FundidoMesh color={theme.background} />
          </View>
          <Avatar
            person={persona}
            size="xl"
            ring={nivel >= 2}
            style={nivel >= 2 ? { borderColor: theme.fire } : undefined}
          />
          <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={1}>
            {nombreCompleto(profile?.nombre, profile?.apellido) || 'Cargando...'}
          </Text>
          <Text style={[styles.email, { color: theme.textDim }]} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>

        <View style={[styles.cuerpo, { backgroundColor: theme.background, paddingBottom: espacioTabBar }]}>
          <View style={styles.resumen}>
            {/* Racha (RN-075, E09) */}
            <View style={styles.section}>
              <Text style={[styles.eyebrow, { color: theme.textDim }]}>RACHA</Text>
              {cargandoRacha ? (
                <Text style={[styles.insigniasVacio, { color: theme.textMute }]}>Cargando...</Text>
              ) : (
                <TarjetaRacha racha={racha} propia />
              )}
            </View>

            {/* Insignias (RN-074, E09) */}
            <View style={styles.section}>
              <Text style={[styles.eyebrow, { color: theme.textDim }]}>INSIGNIAS</Text>
              {cargandoInsignias ? (
                <Text style={[styles.insigniasVacio, { color: theme.textMute }]}>Cargando...</Text>
              ) : insignias.length === 0 ? (
                <Text style={[styles.insigniasVacio, { color: theme.textMute }]}>
                  Todavía no conseguiste ninguna. Completá un viaje para empezar a ganarlas.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.insigniasRow}
                >
                  {insignias.map((ins) => (
                    <InsigniaChip key={ins.id} insignia={ins} onPress={setInsigniaAbierta} />
                  ))}
                </ScrollView>
              )}
            </View>
          </View>

          <PasoAyuda {...AYUDA_PERFIL[1]!}>
            <FilaOpcion
              icono="bar-chart"
              titulo="Estadísticas"
              subtitulo="Viajes, grupos, amigos y kilómetros"
              onPress={() => router.push('/estadisticas')}
            />
          </PasoAyuda>
          <FilaOpcion
            icono="users"
            titulo="Mis amigos"
            subtitulo="Tu lista y solicitudes de amistad"
            badge={solicitudesPendientes}
            onPress={() => router.push('/(tabs)/grupos?tab=amigos')}
          />
          <FilaOpcion
            icono="map"
            titulo="Mis rutas"
            subtitulo="Tus recorridos guardados"
            onPress={() => router.push('/(tabs)/rutas')}
          />
          <FilaOpcion
            icono="bar-chart-2"
            titulo="Tabla de posiciones"
            subtitulo="Rankings de actividades sin motor"
            onPress={() => router.push('/ranking')}
          />
          <PasoAyuda {...AYUDA_PERFIL[2]!}>
            <FilaOpcion
              icono="shield"
              titulo="Privacidad"
              subtitulo="Tu ubicación en viajes y quién ve tus logros"
              onPress={() => router.push('/privacidad')}
            />
          </PasoAyuda>
          <FilaOpcion
            icono="sun"
            titulo="Apariencia"
            subtitulo={etiquetaTema(preferenciaTema)}
            onPress={() => router.push('/apariencia')}
          />
          <FilaOpcion
            icono="smartphone"
            titulo="Vibración de avisos"
            subtitulo={
              vibracionAvisos
                ? 'Activada · tocá para apagarla'
                : 'Apagada · las alertas críticas vibran igual'
            }
            onPress={() => elegirVibracionAvisos(!vibracionAvisos)}
          />
          {/* RN-120: entrada al backoffice, solo para superadmins (el backend valida igual). */}
          {esSuperadmin && (
            <FilaOpcion
              icono="sliders"
              titulo="Administración"
              subtitulo="Backoffice de la plataforma"
              onPress={() => router.push('/admin')}
            />
          )}
          <FilaOpcion
            icono="log-out"
            titulo="Cerrar sesión"
            peligro
            disabled={loggingOut}
            onPress={cerrarSesion}
          />

          <Text style={[styles.footerText, { color: theme.textMute }]}>
            Mesh · v1.0 — Córdoba, AR
          </Text>
        </View>
      </ScrollViewAyuda>

      {rafagaFueguitos > 0 ? (
        <FueguitosRacha key={rafagaFueguitos} semanas={semanasRacha} alto={ALTO_FUEGUITOS} />
      ) : null}

      <DetalleInsigniaModal insignia={insigniaAbierta} onClose={() => setInsigniaAbierta(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  botonLapiz: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
  },
  cabecera: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  fundido: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 170,
  },
  nombre: {
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.3,
    marginTop: 16,
  },
  email: {
    fontSize: 15,
    marginTop: 4,
  },
  cuerpo: {
    flexGrow: 1,
  },
  resumen: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  insigniasVacio: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  insigniasRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
    paddingRight: 4,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11.5,
    fontFamily: 'SpaceMono',
    marginTop: 12,
  },
});
