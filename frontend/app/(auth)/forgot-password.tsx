import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Email requerido', 'Ingresá tu email para continuar.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      Alert.alert('Error', mensajeFirebase(e.code));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.sentTitle}>Revisá tu correo</Text>
        <Text style={styles.sentText}>
          Te enviamos un link para restablecer tu contraseña. El link expira en 24 horas.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.buttonText}>Volver al login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Recuperar contraseña</Text>
        <Text style={styles.subtitle}>
          Ingresá tu email y te enviamos un link para restablecer tu contraseña.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Enviar link</Text>
          )}
        </TouchableOpacity>
      </View>
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
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  backRow: { position: 'absolute', top: 56, left: 28 },
  backText: { color: '#4a9eff', fontSize: 16 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#aaa',
    lineHeight: 22,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  button: {
    backgroundColor: '#4a9eff',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  checkmark: { fontSize: 64, color: '#4a9eff', marginBottom: 16 },
  sentTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 12 },
  sentText: { fontSize: 15, color: '#aaa', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
});
