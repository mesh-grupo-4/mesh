import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  coloresValoracion,
  etiquetaValoracion,
  nivelValoracion,
} from '@/components/tabs/coloresValoracion';
import { useTheme } from '@/components/MeshUI';
import type { ValoracionRecorridoApi } from '@/lib/recorridosPublicadosApi';

type Props = {
  valoracion: ValoracionRecorridoApi;
  /** Cuántas personas lo guardaron en sus rutas; sin dato o en cero, no se muestra. */
  guardados?: number;
  /** Para ubicarlo en su contenedor (por ejemplo `flex: 1` dentro de una fila). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Valoración de un recorrido (RN-082) como escalón con nombre, porcentaje y barra: cada
 * nivel se distingue por el texto y por cuánto se llena la barra, no solo por el color.
 */
export function MedidorValoracion({ valoracion: v, guardados, style }: Props) {
  const theme = useTheme();
  const nivel = nivelValoracion(v);
  const colores = coloresValoracion(nivel, theme);
  const etiqueta = etiquetaValoracion(nivel);

  const textoGuardados =
    guardados && guardados > 0
      ? `${guardados} ${guardados === 1 ? 'persona lo guardó' : 'personas lo guardaron'} en sus rutas`
      : null;
  const lineaGuardados = textoGuardados ? (
    <View style={styles.fila}>
      <Feather name="heart" size={13} color={theme.textDim} />
      <Text style={[styles.guardados, { color: theme.textDim }]} numberOfLines={1}>
        {textoGuardados}
      </Text>
    </View>
  ) : null;

  if (nivel === 'sin' || v.porcentaje_recomienda === null) {
    return (
      <View style={[styles.medidor, style]}>
        <View style={styles.fila}>
          <Feather name={colores.icono} size={14} color={colores.color} />
          <Text style={[styles.sinVotos, { color: theme.textMute }]}>{etiqueta}</Text>
        </View>
        {lineaGuardados}
      </View>
    );
  }

  const votos = `${v.total} ${v.total === 1 ? 'valoración' : 'valoraciones'}`;

  return (
    <View
      style={[styles.medidor, style]}
      accessible
      accessibilityLabel={`${etiqueta}: ${v.porcentaje_recomienda} % lo recomienda, ${votos}${
        textoGuardados ? `. ${textoGuardados}` : ''
      }`}
    >
      <View style={styles.fila}>
        <Feather name={colores.icono} size={15} color={colores.color} />
        <Text
          style={[styles.etiqueta, nivel === 'muy_buena' && styles.etiquetaFuerte, { color: theme.text }]}
          numberOfLines={1}
        >
          {etiqueta}
        </Text>
        <Text style={[styles.cifras, { color: theme.textDim }]} numberOfLines={1}>
          {v.porcentaje_recomienda} % · {votos}
        </Text>
      </View>
      <View style={[styles.riel, { backgroundColor: theme.surface2 }]}>
        <View
          style={[
            styles.avance,
            { backgroundColor: colores.color, width: `${v.porcentaje_recomienda}%` },
          ]}
        />
      </View>
      {lineaGuardados}
    </View>
  );
}

const styles = StyleSheet.create({
  medidor: { gap: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sinVotos: { fontSize: 13 },
  etiqueta: { flex: 1, fontSize: 14, fontWeight: '700' },
  etiquetaFuerte: { fontWeight: '800' },
  cifras: { fontSize: 13 },
  guardados: { flexShrink: 1, fontSize: 12.5 },
  riel: { height: 6, borderRadius: 3, overflow: 'hidden' },
  avance: { height: 6, borderRadius: 3 },
});
