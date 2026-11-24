import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/components/MeshUI';

type Props = {
  /** Trazado simplificado del listado, en coordenadas GeoJSON [lng, lat]. */
  coordenadas: [number, number][];
  alto?: number;
};

const MARGEN = 14;
const RADIO_PUNTO = 5;

/**
 * Banner con el dibujo del trazado de una ruta, sin mapa de fondo: en una lista no conviene
 * montar un mapa nativo por tarjeta. Encuadra la ruta en el ancho disponible respetando sus
 * proporciones (corrige la longitud por la latitud para que no se vea estirada). Inicio en
 * verde y final en rojo; si la ruta vuelve al punto de partida se ve un solo punto.
 */
export function TrazadoMiniatura({ coordenadas, alto = 96 }: Props) {
  const theme = useTheme();
  const [ancho, setAncho] = useState(0);

  const dibujo = useMemo(() => {
    if (ancho <= 0 || coordenadas.length < 2) return null;
    const latMedia =
      (coordenadas.reduce((s, [, lat]) => s + lat, 0) / coordenadas.length) * (Math.PI / 180);
    // Proyección equirectangular: suficiente para una ruta de unos cientos de km.
    const planos = coordenadas.map(([lng, lat]) => [lng * Math.cos(latMedia), lat] as const);
    const xs = planos.map(([x]) => x);
    const ys = planos.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxY = Math.max(...ys);
    const anchoRuta = Math.max(...xs) - minX;
    const altoRuta = maxY - Math.min(...ys);
    const escala = Math.min(
      (ancho - MARGEN * 2) / (anchoRuta || 1e-9),
      (alto - MARGEN * 2) / (altoRuta || 1e-9)
    );
    // Centra el dibujo en el espacio que sobra en el eje que no limita la escala.
    const dx = (ancho - anchoRuta * escala) / 2;
    const dy = (alto - altoRuta * escala) / 2;
    const puntos = planos.map(([x, y]) => [dx + (x - minX) * escala, dy + (maxY - y) * escala]);
    const d = puntos
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ');
    const inicio = puntos[0];
    const fin = puntos[puntos.length - 1];
    const circuito = Math.hypot(fin[0] - inicio[0], fin[1] - inicio[1]) < RADIO_PUNTO * 2;
    return { d, inicio, fin, circuito };
  }, [ancho, alto, coordenadas]);

  const alMedir = (e: LayoutChangeEvent) => setAncho(Math.round(e.nativeEvent.layout.width));

  return (
    <View
      onLayout={alMedir}
      style={[styles.caja, { height: alto, backgroundColor: theme.surface2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {coordenadas.length < 2 ? (
        <Feather name="map" size={26} color={theme.textMute} />
      ) : dibujo ? (
        <Svg width={ancho} height={alto}>
          <Path
            d={dibujo.d}
            fill="none"
            stroke={theme.accent}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {dibujo.circuito ? null : (
            <Circle
              cx={dibujo.fin[0]}
              cy={dibujo.fin[1]}
              r={RADIO_PUNTO}
              fill={theme.danger}
              stroke={theme.surface2}
              strokeWidth={2}
            />
          )}
          <Circle
            cx={dibujo.inicio[0]}
            cy={dibujo.inicio[1]}
            r={RADIO_PUNTO}
            fill={theme.good}
            stroke={theme.surface2}
            strokeWidth={2}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { width: '100%', alignItems: 'center', justifyContent: 'center' },
});
