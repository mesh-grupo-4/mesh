import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Btn, useTheme } from '@/components/MeshUI';

type Props = {
  icono: keyof typeof Feather.glyphMap;
  titulo: string;
  texto?: string;
  accion?: { label: string; onPress: () => void };
  compacto?: boolean;
};

/** Estado vacío: ícono, título corto y, si corresponde, la acción que lo resuelve. */
export function EstadoVacio({ icono, titulo, texto, accion, compacto = false }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, compacto && styles.wrapCompacto]}>
      <View style={[styles.icono, { backgroundColor: theme.accentWeak }]}>
        <Feather name={icono} size={24} color={theme.accent} />
      </View>
      <Text style={[styles.titulo, { color: theme.text }]}>{titulo}</Text>
      {texto ? <Text style={[styles.texto, { color: theme.textDim }]}>{texto}</Text> : null}
      {accion ? (
        <Btn variant="primary" size="md" onPress={accion.onPress} style={styles.accion}>
          {accion.label}
        </Btn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 12,
    gap: 6,
  },
  wrapCompacto: {
    paddingVertical: 20,
  },
  icono: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  titulo: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  texto: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  accion: {
    marginTop: 12,
  },
});
