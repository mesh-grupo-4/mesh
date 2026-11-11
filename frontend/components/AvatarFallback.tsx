import { useState } from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import { useFotoPerfil } from '@/lib/fotosPerfilStore';

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

export function colorFromName(nombre: string): string {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.charAt(0).toUpperCase();
  return (partes[0]!.charAt(0) + partes[partes.length - 1]!.charAt(0)).toUpperCase();
}

type Props = {
  nombre: string;
  size?: number;
  /**
   * Con id, muestra la foto de perfil si la persona tiene. Sin id, solo
   * iniciales: así quedan a propósito el mapa y la barra del viaje en vivo.
   */
  usuarioId?: string | null;
};

export function AvatarFallback({ nombre, size = 44, usuarioId }: Props) {
  const backgroundColor = colorFromName(nombre);
  const fontSize = size * 0.38;
  const foto = useFotoPerfil(usuarioId);
  const [fotoRota, setFotoRota] = useState<string | null>(null);

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
      {/* La foto tapa las iniciales: mientras carga o si falla, se ven ellas. */}
      {foto && foto !== fotoRota ? (
        <Image
          source={{ uri: foto }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          onError={() => setFotoRota(foto)}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iniciales: {
    color: '#fff',
    fontWeight: '700',
  },
});
