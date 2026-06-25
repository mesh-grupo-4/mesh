import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform, 
  ScrollView,
} from 'react-native';
import { meshAlert } from '@/lib/meshAlert';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Btn, Field, TopBar, useTheme } from '@/components/MeshUI';
import { Feather } from '@expo/vector-icons';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      meshAlert('Email requerido', 'Ingresá tu email para continuar.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      meshAlert('Error', mensajeFirebase(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TopBar title="Recuperar acceso" onBack={() => router.back()} bordered={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {!sent ? (
            <View style={styles.content}>
              <Text style={[styles.title, { color: theme.text }]}>¿Olvidaste tu contraseña?</Text>
              <Text style={[styles.subtitle, { color: theme.textDim }]}>
                Te enviamos un enlace para restablecerla.
              </Text>

              <View style={styles.form}>
                <Field
                  label="Email"
                  leading="mail"
                  placeholder="tu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                />

                <Btn
                  variant="primary"
                  size="lg"
                  block
                  onPress={handleReset}
                  loading={loading}
                  style={styles.actionBtn}
                >
                  Enviar enlace
                </Btn>
              </View>
            </View>
          ) : (
            <View style={styles.successContainer}>
              <View style={[styles.iconOuterCircle, { backgroundColor: theme.accentWeak }]}>
                <Feather name="mail" size={34} color={theme.accent} />
              </View>
              
              <Text style={[styles.title, styles.centerText, { color: theme.text }]}>
                Revisá tu correo
              </Text>
              
              <Text style={[styles.subtitle, styles.centerText, { color: theme.textDim }]}>
                Enviamos un enlace a tu email para que vuelvas a entrar. El mismo expira en 24 horas.
              </Text>

              <Btn
                variant="secondary"
                size="lg"
                block
                onPress={() => router.replace('/(auth)/login')}
                style={styles.actionBtn}
              >
                Volver a ingresar
              </Btn>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function mensajeFirebase(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'No encontramos una cuenta con ese email.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Esperá unos minutos.';
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
  },
  successContainer: {
    alignItems: 'center',
    width: '100%',
  },
  iconOuterCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  centerText: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14.5,
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 22,
  },
  form: {
    gap: 14,
  },
  actionBtn: {
    marginTop: 6,
    width: '100%',
  },
});

