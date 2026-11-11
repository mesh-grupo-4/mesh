import { ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/components/MeshUI';
import { Pressable } from '@/components/Pressable';

type Props = {
  guardada: boolean;
  onPress: () => void;
  /** Mientras se guarda o se quita: muestra un spinner y no responde al toque. */
  cargando?: boolean;
  /** Nombre de la ruta, para el lector de pantalla. */
  nombre?: string;
};

/** Corazón para guardar una ruta o quitarla de guardadas (RN-084). */
export function CorazonGuardar({ guardada, onPress, cargando = false, nombre }: Props) {
  const theme = useTheme();
  const accion = guardada ? 'Quitar de guardadas' : 'Guardar en mis rutas';
  return (
    <Pressable
      onPress={onPress}
      disabled={cargando}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: guardada, busy: cargando }}
      accessibilityLabel={nombre ? `${accion}: ${nombre}` : accion}
      style={styles.boton}
    >
      {cargando ? (
        <ActivityIndicator color={theme.danger} size="small" />
      ) : (
        <Ionicons
          name={guardada ? 'heart' : 'heart-outline'}
          size={26}
          color={guardada ? theme.danger : theme.textDim}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
