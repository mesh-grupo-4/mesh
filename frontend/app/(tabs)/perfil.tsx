import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth, ActividadPreferida } from '@/context/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import { resolveBackendUserId } from '@/lib/apiClient';
import { listarSolicitudesAmistadPendientes } from '@/lib/amistadesApi';

const ACTIVIDADES: { valor: ActividadPreferida; etiqueta: string }[] = [
  { valor: 'moto', etiqueta: 'Moto' },
  { valor: 'bici', etiqueta: 'Bici' },
  { valor: 'running', etiqueta: 'Running' },
  { valor: 'trekking', etiqueta: 'Trekking' },
];

export default function PerfilScreen() {
  const { user, profile, updateUserProfile, logout, backendUserId } = useAuth();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [actividad, setActividad] = useState<ActividadPreferida>('');
  const [loading, setLoading] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);

  const cargarSolicitudes = useCallback(async () => {
    try {
      const userId = resolveBackendUserId(backendUserId);
      const solicitudes = await listarSolicitudesAmistadPendientes(userId);
      setSolicitudesPendientes(solicitudes.length);
    } catch {
      setSolicitudesPendientes(0);
    }
  }, [backendUserId]);

  useFocusEffect(
    useCallback(() => {
      void cargarSolicitudes();
    }, [cargarSolicitudes])
  );

  useEffect(() => {
    if (profile) {
      setNombre(profile.nombre);
      setApellido(profile.apellido);
      setTelefono(profile.telefono ?? '');
      setActividad(profile.actividadPreferida);
    }
  }, [profile]);

  const cerrarSesion = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro que querés cerrar sesión?', [
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

  const guardar = () => {
    if (!nombre.trim() || !apellido.trim()) {
      Alert.alert('Campos requeridos', 'El nombre y apellido no pueden estar vacíos.');
      return;
    }
    Alert.alert('Guardar cambios', '¿Estás seguro que querés guardar los cambios?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Guardar',
        onPress: async () => {
          setLoading(true);
          try {
            await updateUserProfile({
              nombre: nombre.trim(),
              apellido: apellido.trim(),
              telefono: telefono.trim(),
              actividadPreferida: actividad,
            });
            setGuardado(true);
            setTimeout(() => setGuardado(false), 2500);
          } catch {
            Alert.alert('Error', 'No se pudieron guardar los cambios. Intentá de nuevo.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
      {/* Email (solo lectura) */}
      <Text style={styles.label}>Email</Text>
      <View style={styles.inputReadonly}>
        <Text style={styles.inputReadonlyText}>{user?.email}</Text>
      </View>

      {/* Nombre y Apellido */}
      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="words"
            placeholderTextColor="#888"
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Apellido</Text>
          <TextInput
            style={styles.input}
            value={apellido}
            onChangeText={setApellido}
            autoCapitalize="words"
            placeholderTextColor="#888"
          />
        </View>
      </View>

      {/* Teléfono */}
      <Text style={styles.label}>Teléfono</Text>
      <TextInput
        style={styles.input}
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
        placeholderTextColor="#888"
        placeholder="ej: 351 123-4567"
      />

      {/* Actividad preferida */}
      <Text style={styles.label}>Actividad preferida</Text>
      <View style={styles.actividadesList}>
        {ACTIVIDADES.map(({ valor, etiqueta }) => (
          <TouchableOpacity
            key={valor}
            style={[styles.actividadItem, actividad === valor && styles.actividadItemActivo]}
            onPress={() => setActividad(valor === actividad ? '' : valor)}
          >
            <Text style={[styles.actividadTexto, actividad === valor && styles.actividadTextoActivo]}>
              {etiqueta}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Mis Amigos */}
      <TouchableOpacity style={styles.linkAmigos} onPress={() => router.push('/amigos')}>
        <View style={styles.linkAmigosContenido}>
          <Text style={styles.linkAmigosTexto}>Mis Amigos</Text>
          {solicitudesPendientes > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{solicitudesPendientes}</Text>
            </View>
          )}
        </View>
        <Text style={styles.linkAmigosFlecha}>›</Text>
      </TouchableOpacity>

      {/* Botón guardar */}
      <TouchableOpacity
        style={[styles.button, guardado && styles.buttonOk]}
        onPress={guardar}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{guardado ? '✓ Guardado' : 'Guardar cambios'}</Text>
        )}
      </TouchableOpacity>

      {/* Botón cerrar sesión */}
      <TouchableOpacity
        style={styles.buttonLogout}
        onPress={cerrarSesion}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#ef4444" />
        ) : (
          <Text style={styles.buttonLogoutText}>Cerrar sesión</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  inner: { padding: 24, gap: 12, paddingBottom: 48 },

  label: { color: '#aaa', fontSize: 13, marginBottom: 4, marginTop: 4 },

  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  inputReadonly: {
    backgroundColor: '#161616',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  inputReadonlyText: { color: '#666', fontSize: 16 },

  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  actividadesList: {
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  actividadItem: {
    backgroundColor: '#1e1e1e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  actividadItemActivo: {
    backgroundColor: '#0d2a4a',
  },
  actividadTexto: { color: '#aaa', fontSize: 15 },
  actividadTextoActivo: { color: '#4a9eff', fontWeight: '600' },

  linkAmigos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    marginTop: 8,
  },
  linkAmigosContenido: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkAmigosTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkAmigosFlecha: { color: '#666', fontSize: 22, fontWeight: '300' },
  badge: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },

  button: {
    backgroundColor: '#4a9eff',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonOk: { backgroundColor: '#22c55e' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  buttonLogout: {
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  buttonLogoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
