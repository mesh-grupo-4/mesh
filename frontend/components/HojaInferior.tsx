import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/Pressable';
import { useTheme } from '@/components/MeshUI';

type Props = {
  visible: boolean;
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: ReactNode;
};

/** Hoja que sube desde abajo, con el mismo estilo que los modales de la app. Tocar afuera la cierra. */
export function HojaInferior({ visible, titulo, subtitulo, onCerrar, children }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: theme.scrim }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCerrar}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <View
          style={[
            styles.contenedor,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={[styles.asa, { backgroundColor: theme.borderStrong }]} />
          <View style={styles.encabezado}>
            <Text style={[styles.titulo, { color: theme.text }]}>{titulo}</Text>
            {subtitulo ? (
              <Text style={[styles.subtitulo, { color: theme.textDim }]}>{subtitulo}</Text>
            ) : null}
          </View>
          <ScrollView
            style={styles.cuerpo}
            contentContainerStyle={styles.cuerpoContenido}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  contenedor: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '80%',
  },
  asa: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  encabezado: {
    gap: 4,
    marginBottom: 14,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitulo: {
    fontSize: 14,
    lineHeight: 20,
  },
  cuerpo: {
    flexGrow: 0,
  },
  cuerpoContenido: {
    gap: 10,
  },
});
