import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Btn, useTheme } from '@/components/MeshUI';
import { parseRouteShareToken } from '@/lib/inviteLinks';
import { meshAlert } from '@/lib/meshAlert';

export function RutasExplorarPanel() {
  const theme = useTheme();
  const router = useRouter();
  const [link, setLink] = useState('');

  const abrirRuta = () => {
    const token = parseRouteShareToken(link);
    if (!token) {
      meshAlert(
        'Link inválido',
        'Pegá un link de ruta compartida de Mesh (mesh://ruta?token=...) o el código del link.'
      );
      return;
    }

    router.push({ pathname: '/ruta', params: { token } });
  };

  const crearViajeConRuta = () => {
    router.push('/viaje/crear');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Feather name="link-2" size={20} color={theme.accent} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Importar ruta compartida</Text>
        </View>
        <Text style={[styles.cardHint, { color: theme.textDim }]}>
          Pegá el link que te compartieron para previsualizarla y guardarla en tus rutas.
        </Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
          ]}
          placeholder="mesh://ruta?token=..."
          placeholderTextColor={theme.textMute}
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Btn block size="lg" icon="search" onPress={abrirRuta}>
          Buscar ruta
        </Btn>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Feather name="map" size={20} color={theme.accent} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Planificar una ruta nueva</Text>
        </View>
        <Text style={[styles.cardHint, { color: theme.textDim }]}>
          Creá un viaje y definí el recorrido desde cero para usarlo con tu grupo.
        </Text>
        <Btn block size="lg" icon="plus" variant="secondary" onPress={crearViajeConRuta}>
          Crear viaje con ruta
        </Btn>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
