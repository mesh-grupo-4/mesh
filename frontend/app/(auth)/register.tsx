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
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

function telefonoArgentinoValido(tel: string): boolean {
  // Acepta formatos: 011 4567-8901, +54 9 11 4567-8901, 351 123-4567, etc.
  // Después de limpiar debe tener 10 dígitos locales o 12-13 con prefijo internacional
  const soloDigitos = tel.replace(/\D/g, '');
  const sinPrefijo = soloDigitos.startsWith('54')
    ? soloDigitos.slice(2).replace(/^9/, '')
    : soloDigitos.replace(/^0/, '');
  return /^\d{10}$/.test(sinPrefijo);
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!nombre.trim() || !apellido.trim() || !telefono.trim() || !email.trim() || !password || !confirm) {
      Alert.alert('Campos requeridos', 'Completá todos los campos.');
      return;
    }
    if (!telefonoArgentinoValido(telefono)) {
      Alert.alert('Teléfono inválido', 'Ingresá un número de teléfono argentino válido.\nEj: 351 123-4567 o +54 9 11 4567-8901');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Contraseña corta', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Contraseñas distintas', 'Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await register({ nombre: nombre.trim(), apellido: apellido.trim(), telefono: telefono.trim(), email: email.trim(), password });
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error al registrarse', mensajeFirebase(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Mesh</Text>
        <Text style={styles.subtitle}>Creá tu cuenta</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.inputHalf]}
            placeholder="Nombre"
            placeholderTextColor="#888"
            autoCapitalize="words"
            value={nombre}
            onChangeText={setNombre}
          />
          <TextInput
            style={[styles.input, styles.inputHalf]}
            placeholder="Apellido"
            placeholderTextColor="#888"
            autoCapitalize="words"
            value={apellido}
            onChangeText={setApellido}
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Teléfono (ej: 351 123-4567)"
          placeholderTextColor="#888"
          keyboardType="phone-pad"
          value={telefono}
          onChangeText={setTelefono}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña (mín. 8 caracteres)"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirmá la contraseña"
          placeholderTextColor="#888"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Registrarme</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>¿Ya tenés cuenta? Ingresá</Text>
          </TouchableOpacity>
        </Link>
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
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 14,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 12 },
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
  inputHalf: { flex: 1 },
  button: {
    backgroundColor: '#4a9eff',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  linkRow: { alignItems: 'center', marginTop: 8 },
  linkText: { color: '#aaa', fontSize: 15 },
});
