import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTheme } from '@/components/MeshUI';

type Props = {
  pendientes: number;
  /** Qué abre, para el lector de pantalla: "Invitaciones a grupos", "Solicitudes de amistad". */
  etiqueta: string;
  onPress: () => void;
};

/** Botón de campanita para el `TopBar`. Muestra un punto rojo mientras haya pendientes sin responder. */
export function CampanitaNotificaciones({ pendientes, etiqueta, onPress }: Props) {
  const theme = useTheme();
  const conPendientes = pendientes > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        conPendientes
          ? `${etiqueta}, ${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}`
          : `${etiqueta}, sin pendientes`
      }
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: pressed ? theme.surface2 : theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <Feather name="bell" size={19} color={conPendientes ? theme.text : theme.textDim} />
      {conPendientes ? (
        <View
          style={[styles.punto, { backgroundColor: theme.danger, borderColor: theme.surface }]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  punto: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
