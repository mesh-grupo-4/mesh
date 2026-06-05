import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { useAuth, ActividadPreferida } from '@/context/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import { resolveBackendUserId } from '@/lib/apiClient';
import { listarSolicitudesAmistadPendientes } from '@/lib/amistadesApi';
import { Btn, Field, Chip, ChipRow, Avatar, TopBar, useTheme } from '@/components/MeshUI';
import { Feather } from '@expo/vector-icons';

const ACTIVIDADES: { valor: ActividadPreferida; etiqueta: string; icono: keyof typeof Feather.glyphMap }[] = [
  { valor: 'moto', etiqueta: 'Moto', icono: 'compass' },
  { valor: 'bici', etiqueta: 'Bici', icono: 'git-commit' },
  { valor: 'running', etiqueta: 'Running', icono: 'zap' },
  { valor: 'trekking', etiqueta: 'Trekking', icono: 'map' },
];

export default function PerfilScreen() {
  const { user, profile, updateUserProfile, logout, backendUserId } = useAuth();
  const theme = useTheme();

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

  const meDummy = {
    nombre: nombre || profile?.nombre || 'U',
    apellido: apellido || profile?.apellido || '',
    color: theme.accent,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar title="Perfil" bordered={false} />
      
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Cabecera del perfil */}
        <View style={styles.profileHeader}>
          <Avatar person={meDummy} size="lg" ring />
          <View style={styles.profileMeta}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {`${nombre} ${apellido}`.trim() || 'Cargando...'}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.textDim }]} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>

        {/* Bloque de estadísticas del mockup */}
        <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: theme.text }]}>--</Text>
            <Text style={[styles.statLabel, { color: theme.textMute }]}>Viajes</Text>
          </View>
          <View style={[styles.statBox, styles.borderLeft, { borderLeftColor: theme.border }]}>
            <Text style={[styles.statValue, { color: theme.text }]}>--</Text>
            <Text style={[styles.statLabel, { color: theme.textMute }]}>Grupos</Text>
          </View>
          <View style={[styles.statBox, styles.borderLeft, { borderLeftColor: theme.border }]}>
            <Text style={[styles.statValue, { color: theme.text }]}>1.2k</Text>
            <Text style={[styles.statLabel, { color: theme.textMute }]}>Km</Text>
          </View>
        </View>

        {/* Datos Personales */}
        <View style={styles.section}>
          <Text style={[styles.eyebrow, { color: theme.textDim }]}>DATOS PERSONALES</Text>
          <View style={styles.row}>
            <View style={styles.half}>
              <Field
                label="Nombre"
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="words"
                placeholderTextColor={theme.textMute}
              />
            </View>
            <View style={styles.half}>
              <Field
                label="Apellido"
                value={apellido}
                onChangeText={setApellido}
                autoCapitalize="words"
                placeholderTextColor={theme.textMute}
              />
            </View>
          </View>

          <Field
            label="Teléfono"
            leading="phone"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            placeholderTextColor={theme.textMute}
            placeholder="ej: 351 123-4567"
          />
        </View>

        {/* Actividad Preferida */}
        <View style={styles.section}>
          <Text style={[styles.eyebrow, { color: theme.textDim }]}>ACTIVIDAD PREFERIDA</Text>
          <ChipRow>
            {ACTIVIDADES.map(({ valor, etiqueta, icono }) => (
              <Chip
                key={valor}
                icon={icono}
                active={actividad === valor}
                onPress={() => setActividad(valor === actividad ? '' : valor)}
              >
                {etiqueta}
              </Chip>
            ))}
          </ChipRow>
        </View>

        {/* Amigos */}
        <Pressable
          style={({ pressed }) => [
            styles.linkAmigos,
            {
              backgroundColor: pressed ? theme.surface2 : theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => router.push('/amigos')}
        >
          <View style={styles.linkAmigosContent}>
            <Feather name="users" size={18} color={theme.accent} style={styles.amigosIcon} />
            <Text style={[styles.linkAmigosText, { color: theme.text }]}>Mis Amigos</Text>
            {solicitudesPendientes > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <Text style={styles.badgeText}>{solicitudesPendientes}</Text>
              </View>
            )}
          </View>
          <Feather name="chevron-right" size={20} color={theme.textMute} />
        </Pressable>

        {/* Botones de acción */}
        <View style={styles.actions}>
          <Btn
            variant={guardado ? 'outline' : 'primary'}
            size="lg"
            block
            onPress={guardar}
            loading={loading}
            icon={guardado ? 'check' : undefined}
          >
            {guardado ? 'Cambios guardados' : 'Guardar cambios'}
          </Btn>

          <Btn
            variant="danger-outline"
            size="lg"
            block
            onPress={cerrarSesion}
            disabled={loggingOut}
            icon="log-out"
          >
            Cerrar sesión
          </Btn>
        </View>

        <Text style={[styles.footerText, { color: theme.textMute }]}>
          Mesh · v1.0 — Córdoba, AR
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    padding: 20,
    gap: 20,
    paddingBottom: 48,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 3,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderLeft: {
    borderLeftWidth: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  linkAmigos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.2,
    marginTop: 8,
  },
  linkAmigosContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  amigosIcon: {
    marginRight: 10,
  },
  linkAmigosText: {
    fontSize: 15.5,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  actions: {
    gap: 11,
    marginTop: 10,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11.5,
    fontFamily: 'SpaceMono',
    marginTop: 8,
  },
});

