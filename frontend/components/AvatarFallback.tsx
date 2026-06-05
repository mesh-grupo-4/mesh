import { Text, View, StyleSheet } from 'react-native';

const AVATAR_COLORS = [
  '#4a9eff',
  '#6bcb77',
  '#ffd93d',
  '#ff6b6b',
  '#c77dff',
  '#ff922b',
  '#20c997',
  '#748ffc',
];

function colorFromName(nombre: string): string {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.charAt(0).toUpperCase();
  return (partes[0]!.charAt(0) + partes[partes.length - 1]!.charAt(0)).toUpperCase();
}

type Props = {
  nombre: string;
  size?: number;
};

export function AvatarFallback({ nombre, size = 44 }: Props) {
  const backgroundColor = colorFromName(nombre);
  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      <Text style={[styles.iniciales, { fontSize }]}>{inicialesDe(nombre)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciales: {
    color: '#fff',
    fontWeight: '700',
  },
});
