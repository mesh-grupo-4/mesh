import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ActivityTile, useTheme } from '@/components/MeshUI';
import { RouteMapView } from '@/components/route-config/RouteMapView';
import type { RouteWaypoint } from '@/components/route-config/routeTypes';

type Props = {
  /** Trazado simplificado del listado, en coordenadas GeoJSON [lng, lat]. */
  coordenadas: [number, number][];
  tamano?: number;
  /**
   * Sin trazado, el cuadro muestra el ícono grande de esta actividad (en lugar de un ícono
   * de mapa genérico), así las tarjetas con y sin recorrido mantienen la misma forma.
   */
  actividad?: string;
  /** Texto chico debajo del ícono cuando no hay trazado (p. ej. "Sin recorrido"). */
  textoSinTrazado?: string;
  /**
   * Banner de borde a borde arriba de la tarjeta (alto `ALTO_BANNER`, sin esquinas propias:
   * las recorta la tarjeta), en lugar del cuadro de `tamano`. Es el formato de Rutas
   * guardadas, parecido a la foto de Explorar.
   */
  banner?: boolean;
};

const ALTO_BANNER = 150;

/** Margen del encuadre: deja aire para los puntos de inicio y fin en los bordes. */
const MARGEN_ENCUADRE = { top: 14, right: 14, bottom: 14, left: 14 };

/**
 * Por debajo de esta extensión (en grados, ~10 m) el trazado es un punto: el encuadre se
 * iría al zoom máximo y no se vería nada útil, así que cuenta como sin recorrido.
 */
const EXTENSION_MINIMA_GRADOS = 0.0001;

function tieneExtension(coords: [number, number][]): boolean {
  const lngs = coords.map(([lng]) => lng);
  const lats = coords.map(([, lat]) => lat);
  return (
    Math.max(Math.max(...lngs) - Math.min(...lngs), Math.max(...lats) - Math.min(...lats)) >=
    EXTENSION_MINIMA_GRADOS
  );
}

/**
 * El logo de Google tiene tamaño fijo y no se puede ocultar (términos de Google Maps): por
 * eso el cuadro no baja de ~136, para que el logo no tape media miniatura.
 *
 * Mapa cuadrado de una ruta para las tarjetas de lista: el mismo mapa que el detalle (capa
 * elegida por el usuario, trazado y marcadores de inicio y fin), en modo lite y sin gestos.
 * El toque lo maneja la tarjeta: el mapa no recibe eventos, así en Android tampoco abre la
 * app de Google Maps, que es lo que hace el modo lite al tocarlo.
 */
function MiniaturaRutaBase({
  coordenadas,
  tamano = 136,
  actividad,
  textoSinTrazado,
  banner = false,
}: Props) {
  const theme = useTheme();

  const mapa = useMemo(() => {
    if (coordenadas.length < 2 || !tieneExtension(coordenadas)) return null;
    const routeLine = coordenadas.map(([lng, lat]) => [lat, lng] as [number, number]);
    const [oLat, oLng] = routeLine[0]!;
    const [dLat, dLng] = routeLine[routeLine.length - 1]!;
    const waypoints: RouteWaypoint[] = [
      { id: 'origen', type: 'ORIGIN', lat: oLat, lon: oLng, name: '', order: 0 },
      { id: 'destino', type: 'DESTINATION', lat: dLat, lon: dLng, name: '', order: 1 },
    ];
    return {
      routeLine,
      waypoints,
      region: { latitude: oLat, longitude: oLng, latitudeDelta: 0.08, longitudeDelta: 0.08 },
    };
  }, [coordenadas]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.caja,
        banner ? styles.banner : { width: tamano, height: tamano },
        { backgroundColor: theme.surface2 },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {mapa ? (
        <RouteMapView
          waypoints={mapa.waypoints}
          routeLineLatLng={mapa.routeLine}
          initialRegion={mapa.region}
          cameraTarget={null}
          fitPadding={MARGEN_ENCUADRE}
          miniatura
        />
      ) : (
        <>
          {actividad ? (
            <ActivityTile activity={actividad} size={44} />
          ) : (
            <Feather name="map" size={26} color={theme.textMute} />
          )}
          {textoSinTrazado ? (
            <Text style={[styles.sinTrazado, { color: theme.textMute }]} numberOfLines={2}>
              {textoSinTrazado}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function mismasCoordenadas(a: [number, number][], b: [number, number][]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every(([lng, lat], i) => lng === b[i]![0] && lat === b[i]![1]);
}

/**
 * Cada recarga del listado trae arrays nuevos con el mismo trazado: sin esta comparación por
 * valor, cada mapa lite se volvía a encuadrar y a redibujar al volver a la pestaña.
 */
export const MiniaturaRuta = memo(
  MiniaturaRutaBase,
  (prev, next) =>
    prev.tamano === next.tamano &&
    prev.actividad === next.actividad &&
    prev.textoSinTrazado === next.textoSinTrazado &&
    prev.banner === next.banner &&
    mismasCoordenadas(prev.coordenadas, next.coordenadas)
);

const styles = StyleSheet.create({
  caja: {
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  banner: { width: '100%', height: ALTO_BANNER, borderRadius: 0 },
  sinTrazado: { fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
});
