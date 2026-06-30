import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform, 
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { meshAlert } from '@/lib/meshAlert';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Btn, Field, MeshMark, useTheme } from '@/components/MeshUI';

export default function LoginScreen() {
  const { login } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      meshAlert('Campos requeridos', 'Completá el email y la contraseña.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      meshAlert('Error al ingresar', mensajeFirebase(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Botón superior de volver mediante barra vacía */}
      <View style={{ height: insets.top }} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <View style={styles.logoWrapper}>
            <MeshMark size={52} />
          </View>
          
          <Text style={[styles.title, { color: theme.text }]}>Hola de nuevo</Text>
          <Text style={[styles.subtitle, { color: theme.textDim }]}>
            Ingresá para ver tus grupos y viajes.
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

            <Field
              label="Contraseña"
              leading="lock"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

            <Btn
              variant="ghost"
              size="sm"
              style={styles.forgotBtn}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              ¿Olvidaste tu contraseña?
            </Btn>

            <Btn
              variant="primary"
              size="lg"
              block
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
            >
              Ingresar
            </Btn>
          </View>

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: theme.textDim }]}>¿No tenés cuenta? </Text>
            <Btn
              variant="ghost"
              size="sm"
              style={styles.signUpBtn}
              onPress={() => router.push('/(auth)/register')}
            >
              Registrate
            </Btn>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function mensajeFirebase(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Intentá más tarde.';
    case 'auth/invalid-email':
      return 'El email no es válido.';
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
    paddingTop: 40,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  logoWrapper: {
    alignSelf: 'flex-start',
    marginBottom: 22,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 6,
    marginBottom: 28,
  },
  form: {
    gap: 14,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  loginBtn: {
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  footerText: {
    fontSize: 13.5,
  },
  signUpBtn: {
    paddingHorizontal: 4,
  },
});

