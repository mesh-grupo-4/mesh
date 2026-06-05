import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import { crearViajeGrupal, type TipoActividadApi } from '@/lib/viajesApi';
import {
  listarViajesPlanificadosGrupo,
  obtenerGrupo,
  type GrupoDetalleApi,
  type ViajePlanificadoApi,
} from '@/lib/gruposApi';

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function etiquetaActividad(tipo: string): string {
  const map: Record<string, string> = {
    moto: 'Moto',
    bici: 'Bici',
    running: 'Running',
    trekking: 'Trekking',
  };
  return map[tipo] ?? tipo;
}

export default function GrupoDetalleScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const [grupo, setGrupo] = useState<GrupoDetalleApi | null>(null);
  const [viajes, setViajes] = useState<ViajePlanificadoApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = async (esRefresh = false) => {
    if (!grupoId) return;
    if (esRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const userId = resolveBackendUserId(backendUserId);
      const [detalle, planificados] = await Promise.all([
        obtenerGrupo(grupoId, userId),
        listarViajesPlanificadosGrupo(grupoId, userId),
      ]);
      setGrupo(detalle);
      setViajes(planificados);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo cargar el grupo.';
      setError(msg);
      if (!esRefresh) Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [grupoId, backendUserId]);

  const crearViaje = (tipoActividad: TipoActividadApi) => {
    if (!grupoId) return;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 7);
    fecha.setHours(9, 0, 0, 0);

    void (async () => {
      try {
        const userId = resolveBackendUserId(backendUserId);
        await crearViajeGrupal(grupoId, tipoActividad, fecha, userId);
        await cargar(true);
        Alert.alert('Listo', 'Viaje planificado creado. Ya podés generar el QR de invitación.');
      } catch (e: unknown) {
        Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo crear el viaje.');
      }
    })();
  };

  const mostrarCrearViaje = () => {
    Alert.alert('Nuevo viaje planificado', 'Elegí la actividad:', [
      { text: 'Moto', onPress: () => crearViaje('moto') },
      { text: 'Bici', onPress: () => crearViaje('bici') },
      { text: 'Running', onPress: () => crearViaje('running') },
      { text: 'Trekking', onPress: () => crearViaje('trekking') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: grupo?.nombre ?? 'Grupo' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargar(true)}
            tintColor="#4a9eff"
          />
        }
      >
        {loading ? (
          <ActivityIndicator color="#4a9eff" size="large" style={{ marginTop: 48 }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : grupo ? (
          <>
            <Text style={styles.nombre}>{grupo.nombre}</Text>
            <Text style={styles.meta}>Creado el {formatearFecha(grupo.fecha_creacion)}</Text>
            {grupo.mi_rol === 'lider' && (
              <View style={styles.badge}>
                <Text style={styles.badgeTexto}>Sos el líder</Text>
              </View>
            )}

            <Text style={styles.seccionTitulo}>Invitar por QR</Text>
            <Text style={styles.seccionHint}>
              Código único por viaje planificado (RN-015). Expira al iniciar el viaje.
            </Text>

            {grupo.mi_rol === 'lider' && (
              <TouchableOpacity style={styles.botonCrear} onPress={mostrarCrearViaje}>
                <Text style={styles.botonCrearTexto}>+ Crear viaje planificado</Text>
              </TouchableOpacity>
            )}

            {viajes.length === 0 ? (
              <Text style={styles.vacio}>
                No hay viajes planificados. Creá un viaje grupal para generar un QR de invitación.
              </Text>
            ) : (
              viajes.map((v) => (
                <View key={v.id} style={styles.tarjetaViaje}>
                  <Text style={styles.viajeTitulo}>{etiquetaActividad(v.tipo_actividad)}</Text>
                  <Text style={styles.viajeMeta}>{formatearFecha(v.fecha_programada)}</Text>
                  <TouchableOpacity
                    style={styles.botonQr}
                    onPress={() => router.push(`/grupo/${grupoId}/qr/${v.id}`)}
                  >
                    <Text style={styles.botonQrTexto}>Ver QR / Invitar</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 24, paddingBottom: 40, gap: 12 },
  nombre: { color: '#fff', fontSize: 26, fontWeight: '700' },
  meta: { color: '#888', fontSize: 14 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a3a5c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  badgeTexto: { color: '#4a9eff', fontSize: 13, fontWeight: '600' },
  seccionTitulo: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 20 },
  seccionHint: { color: '#888', fontSize: 14, lineHeight: 20 },
  botonCrear: {
    backgroundColor: '#1a3a5c',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4a9eff',
  },
  botonCrearTexto: { color: '#4a9eff', fontSize: 15, fontWeight: '600' },
  vacio: { color: '#666', fontSize: 14, lineHeight: 20, marginTop: 8 },
  tarjetaViaje: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 8,
    gap: 6,
  },
  viajeTitulo: { color: '#fff', fontSize: 16, fontWeight: '600' },
  viajeMeta: { color: '#888', fontSize: 13 },
  botonQr: {
    backgroundColor: '#4a9eff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  botonQrTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  error: { color: '#ff6b6b', fontSize: 15, textAlign: 'center', marginTop: 24 },
});
