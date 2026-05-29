import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import { obtenerGrupo, type GrupoDetalleApi } from '@/lib/gruposApi';

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function GrupoDetalleScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const [grupo, setGrupo] = useState<GrupoDetalleApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!grupoId) return;

    let cancelado = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = resolveBackendUserId(backendUserId);
        const data = await obtenerGrupo(grupoId, userId);
        if (!cancelado) setGrupo(data);
      } catch (e: unknown) {
        if (!cancelado) {
          const msg = e instanceof Error ? e.message : 'No se pudo cargar el grupo.';
          setError(msg);
          Alert.alert('Error', msg);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [grupoId, backendUserId]);

  return (
    <>
      <Stack.Screen options={{ title: grupo?.nombre ?? 'Grupo' }} />
      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator color="#4a9eff" size="large" />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : grupo ? (
          <View style={styles.content}>
            <Text style={styles.exito}>Grupo creado correctamente</Text>
            <Text style={styles.nombre}>{grupo.nombre}</Text>
            <Text style={styles.meta}>Creado el {formatearFecha(grupo.fecha_creacion)}</Text>
            {grupo.mi_rol === 'lider' && (
              <View style={styles.badge}>
                <Text style={styles.badgeTexto}>Sos el líder</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: { alignItems: 'center', gap: 12, width: '100%' },
  exito: { color: '#4caf50', fontSize: 14, fontWeight: '600' },
  nombre: { color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  meta: { color: '#888', fontSize: 14 },
  badge: {
    marginTop: 8,
    backgroundColor: '#1a3a5c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeTexto: { color: '#4a9eff', fontSize: 13, fontWeight: '600' },
  error: { color: '#ff6b6b', fontSize: 15, textAlign: 'center' },
});
