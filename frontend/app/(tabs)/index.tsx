import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Text as ThemedText, View as ThemedView } from '@/components/Themed';

export default function TabOneScreen() {
  const router = useRouter();
  const [viajeId, setViajeId] = useState('');
  const [userId, setUserId] = useState('');

  const abrirConfigurarRuta = async () => {
    const id = viajeId.trim();
    if (!id) return;
    if (userId.trim()) await AsyncStorage.setItem('mesh:activeUserId', userId.trim());
    const q = userId.trim() ? `?userId=${encodeURIComponent(userId.trim())}` : '';
    router.push(`/configurar-ruta/${id}${q}` as never);
  };

  const abrirViaje = async () => {
    const id = viajeId.trim();
    if (!id) return;
    if (userId.trim()) await AsyncStorage.setItem('mesh:activeUserId', userId.trim());
    const q = userId.trim() ? `?userId=${encodeURIComponent(userId.trim())}` : '';
    router.push(`/viaje/${id}${q}` as never);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Mesh</ThemedText>
      <ThemedView style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />

      <View style={styles.form}>
        <Text style={styles.label}>ID del viaje (UUID)</Text>
        <TextInput
          value={viajeId}
          onChangeText={setViajeId}
          placeholder="ej. uuid del viaje creado en backend"
          placeholderTextColor="#888"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>ID usuario (opcional, header x-user-id)</Text>
        <TextInput
          value={userId}
          onChangeText={setUserId}
          placeholder="UUID o usar EXPO_PUBLIC_DEV_USER_ID"
          placeholderTextColor="#888"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {viajeId.trim().length > 0 ? (
          <>
            <Pressable style={styles.btn} onPress={() => void abrirConfigurarRuta()}>
              <Text style={styles.btnTxt}>Configurar ruta y paradas</Text>
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={() => void abrirViaje()}>
              <Text style={styles.btnSecondaryTxt}>Detalle / iniciar viaje (GPS)</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.muted}>Completá el ID del viaje para continuar.</Text>
        )}
      </View>

      <EditScreenInfo path="app/(tabs)/index.tsx" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
  },
  form: {
    width: '100%',
    maxWidth: 420,
    gap: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  btn: {
    marginTop: 16,
    backgroundColor: '#15803d',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSecondary: {
    marginTop: 10,
    backgroundColor: '#1d4ed8',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondaryTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  muted: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
