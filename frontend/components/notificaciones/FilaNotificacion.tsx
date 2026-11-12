import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { AvatarFallback } from '@/components/AvatarFallback';
import { Pressable } from '@/components/Pressable';
import { useTheme } from '@/components/MeshUI';

type Props = {
  /** Quien invita o solicita: define el avatar. */
  nombre: string;
  usuarioId: string;
  /** Texto principal; los nombres van envueltos en `Destacado`. */
  mensaje: ReactNode;
  meta: string;
  etiquetaAceptar: string;
  procesando: boolean;
  onAceptar: () => void;
  onRechazar: () => void;
  onPressAvatar?: () => void;
};

/** Tramo en negrita dentro del `mensaje`. */
export function Destacado({ children }: { children: ReactNode }) {
  return <Text style={styles.destacado}>{children}</Text>;
}

/** Ítem de invitación o solicitud en la pantalla de la campanita. Sale con un fundido al responderlo. */
export function FilaNotificacion({
  nombre,
  usuarioId,
  mensaje,
  meta,
  etiquetaAceptar,
  procesando,
  onAceptar,
  onRechazar,
  onPressAvatar,
}: Props) {
  const theme = useTheme();

  return (
    <Animated.View
      exiting={FadeOut.duration(180)}
      layout={LinearTransition.duration(200)}
      style={[styles.fila, { backgroundColor: theme.surface2, borderColor: theme.border }]}
    >
      <Pressable onPress={onPressAvatar} disabled={!onPressAvatar} hitSlop={4}>
        <AvatarFallback nombre={nombre} size={42} usuarioId={usuarioId} />
      </Pressable>

      <View style={styles.cuerpo}>
        <Text style={[styles.texto, { color: theme.text }]}>{mensaje}</Text>
        <Text style={[styles.meta, { color: theme.textMute }]}>{meta}</Text>

        <View style={styles.acciones}>
          <Pressable
            onPress={onAceptar}
            disabled={procesando}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.aceptar,
              { backgroundColor: theme.accent, opacity: procesando ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            {procesando ? (
              <ActivityIndicator size="small" color={theme.onAccent} />
            ) : (
              <Text style={[styles.aceptarTexto, { color: theme.onAccent }]}>{etiquetaAceptar}</Text>
            )}
          </Pressable>
          <Pressable
            onPress={onRechazar}
            disabled={procesando}
            accessibilityRole="button"
            accessibilityLabel="Rechazar"
            hitSlop={6}
            style={({ pressed }) => [
              styles.rechazar,
              {
                borderColor: theme.borderStrong,
                backgroundColor: pressed ? theme.surface3 : 'transparent',
                opacity: procesando ? 0.5 : 1,
              },
            ]}
          >
            <Feather name="x" size={18} color={theme.textDim} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  cuerpo: {
    flex: 1,
    gap: 2,
  },
  texto: {
    fontSize: 15,
    lineHeight: 21,
  },
  destacado: {
    fontWeight: '700',
  },
  meta: {
    fontSize: 12.5,
  },
  acciones: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  aceptar: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aceptarTexto: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  rechazar: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
