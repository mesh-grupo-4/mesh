import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { inicialesDe } from '@/components/AvatarFallback';

const COLORES_GRUPO = ['#d76655', '#4a9eff', '#2f9e63', '#7a5ae0', '#c98a3e'];

/** Color estable por nombre: el mismo en la lista y en el detalle del grupo. */
export function colorDeGrupo(nombre: string): string {
  const suma = nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLORES_GRUPO[suma % COLORES_GRUPO.length]!;
}

type Props = {
  nombre: string;
  foto?: string | null;
  size: number;
  /** Radio de las esquinas: los grupos usan cuadrados redondeados, no círculos. */
  radio: number;
  /** Borde del color del grupo (detalle). */
  conBorde?: boolean;
};

/** Foto del grupo o, si no tiene (o no carga), sus iniciales sobre su color. */
export function AvatarGrupo({ nombre, foto, size, radio, conBorde = false }: Props) {
  const color = colorDeGrupo(nombre);
  const [fotoRota, setFotoRota] = useState<string | null>(null);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radio,
          backgroundColor: `${color}22`,
          borderColor: `${color}66`,
          borderWidth: conBorde ? 1.5 : 0,
        },
      ]}
    >
      <Text style={[styles.iniciales, { color, fontSize: size * 0.36 }]}>{inicialesDe(nombre)}</Text>
      {/* La foto tapa las iniciales: mientras carga o si falla, se ven ellas. */}
      {foto && foto !== fotoRota ? (
        <Image
          source={{ uri: foto }}
          style={StyleSheet.absoluteFill}
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
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
