import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform, 
  ScrollView,
  Pressable,
} from 'react-native';
import { meshAlert } from '@/lib/meshAlert';
import { router } from 'expo-router';
import { useAuth, ActividadPreferida } from '@/context/AuthContext';
import { Btn, Field, TopBar, ActivityTile, useTheme } from '@/components/MeshUI';
import { Feather } from '@expo/vector-icons';

function telefonoArgentinoValido(tel: string): boolean {
  const soloDigitos = tel.replace(/\D/g, '');
  const sinPrefijo = soloDigitos.startsWith('54')
    ? soloDigitos.slice(2).replace(/^9/, '')
    : soloDigitos.replace(/^0/, '');
  return /^\d{10}$/.test(sinPrefijo);
}

const ACTIVIDADES: { id: ActividadPreferida; label: string }[] = [
  { id: 'moto', label: 'Motociclismo' },
  { id: 'bici', label: 'Ciclismo' },
  { id: 'running', label: 'Running' },
  { id: 'trekking', label: 'Trekking' },
];

export default function RegisterScreen() {
  const { register, updateUserProfile } = useAuth();
  const theme = useTheme();

  const [step, setStep] = useState(0);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [activity, setActivity] = useState<ActividadPreferida>('bici');
  const [loading, setLoading] = useState(false);

  const handleNextStep = () => {
    if (!nombre.trim() || !apellido.trim() || !telefono.trim() || !email.trim() || !password || !confirm) {
      meshAlert('Campos requeridos', 'Completá todos los campos.');
      return;
    }
    if (!telefonoArgentinoValido(telefono)) {
      meshAlert('Teléfono inválido', 'Ingresá un número de teléfono argentino válido.\nEj: 351 123-4567 o +54 9 11 4567-8901');
      return;
    }
    if (password.length < 8) {
      meshAlert('Contraseña corta', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      meshAlert('Contraseñas distintas', 'Las contraseñas no coinciden.');
      return;
    }
    setStep(1);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      // 1. Registrar al usuario en Firebase y sincronizar backend
      await register({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        password,
      });
      
      // 2. Guardar la actividad preferida en su perfil de manera secundaria
      if (activity) {
        try {
          await updateUserProfile({ actividadPreferida: activity });
        } catch {
          // Ignorar error menor si la actualización del perfil secundario falla en red
        }
      }

      router.replace('/(tabs)');
    } catch (e: any) {
      meshAlert('Error al registrarse', mensajeFirebase(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TopBar
        title="Crear cuenta"
        onBack={step === 1 ? () => setStep(0) : () => router.back()}
        bordered={false}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {/* Barra de progreso */}
          <View style={[styles.progressTrack, { backgroundColor: theme.surface3 }]}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: theme.accent,
                  width: step === 0 ? '50%' : '100%',
                },
              ]}
            />
          </View>

          {step === 0 ? (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: theme.text }]}>Tus datos</Text>
              <Text style={[styles.subtitle, { color: theme.textDim }]}>
                Así te reconocen en el grupo.
              </Text>

              <View style={styles.form}>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Field
                      label="Nombre"
                      placeholder="Tomás"
                      autoCapitalize="words"
                      value={nombre}
                      onChangeText={setNombre}
                    />
                  </View>
                  <View style={styles.half}>
                    <Field
                      label="Apellido"
                      placeholder="Rivero"
                      autoCapitalize="words"
                      value={apellido}
                      onChangeText={setApellido}
                    />
                  </View>
                </View>

                <Field
                  label="Teléfono"
                  leading="phone"
                  placeholder="351 123-4567"
                  keyboardType="phone-pad"
                  value={telefono}
                  onChangeText={setTelefono}
                />

                <Field
                  label="Email"
                  leading="mail"
                  placeholder="tomas.rivero@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <Field
                  label="Contraseña"
                  leading="lock"
                  placeholder="Mínimo 8 caracteres"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                <Field
                  label="Confirmar contraseña"
                  leading="lock"
                  placeholder="Repetí la contraseña"
                  secureTextEntry
                  value={confirm}
                  onChangeText={setConfirm}
                />

                <Btn
                  variant="primary"
                  size="lg"
                  block
                  iconRight="arrow-right"
                  onPress={handleNextStep}
                  style={styles.actionBtn}
                >
                  Continuar
                </Btn>
              </View>
            </View>
          ) : (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: theme.text }]}>¿Qué te gusta rodar?</Text>
              <Text style={[styles.subtitle, { color: theme.textDim }]}>
                Lo usamos para sugerirte viajes y grupos.
              </Text>

              <View style={styles.activityList}>
                {ACTIVIDADES.map((act) => {
                  const isActive = activity === act.id;
                  return (
                    <Pressable
                      key={act.id}
                      onPress={() => setActivity(act.id)}
                      style={[
                        styles.activityItem,
                        {
                          backgroundColor: isActive ? theme.accentWeak : theme.surface,
                          borderColor: isActive ? theme.accentLine : theme.border,
                        },
                      ]}
                    >
                      <ActivityTile activity={act.id} />
                      <Text style={[styles.activityLabel, { color: theme.text }]}>
                        {act.label}
                      </Text>
                      {isActive && (
                        <Feather name="check" size={20} color={theme.accent} style={styles.checkIcon} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Btn
                variant="primary"
                size="lg"
                block
                onPress={handleRegister}
                loading={loading}
                style={styles.actionBtn}
              >
                Crear mi cuenta
              </Btn>
            </View>
          )}

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: theme.textDim }]}>¿Ya tenés cuenta? </Text>
            <Btn
              variant="ghost"
              size="sm"
              style={styles.loginBtn}
              onPress={() => router.push('/(auth)/login')}
            >
              Ingresá
            </Btn>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function mensajeFirebase(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ese email ya está registrado.';
    case 'auth/invalid-email':
      return 'El email no es válido.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil.';
    default:
      return 'Ocurrió un error. Intentá de nuevo.';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    width: '100%',
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 999,
  },
  stepContainer: {
    width: '100%',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14.5,
    marginTop: 6,
    marginBottom: 24,
  },
  form: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  actionBtn: {
    marginTop: 18,
  },
  activityList: {
    gap: 11,
    marginBottom: 10,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.2,
  },
  activityLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 14,
  },
  checkIcon: {
    marginRight: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 13.5,
  },
  loginBtn: {
    paddingHorizontal: 4,
  },
});

