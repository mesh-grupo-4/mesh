import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ActivityTile, Avatar, useTheme } from '@/components/MeshUI';
import { Pressable } from '@/components/Pressable';
import { formatDurationHm, formatKm } from '@/lib/format';
import {
  textoAntiguedad,
  textoValoracion,
  type RecorridoComunidadApi,
} from '@/lib/recorridosPublicadosApi';
import { nivelRacha } from '@/lib/rachasApi';
import { formatearEnArg } from '@/lib/tiempoArg';

type Props = {
  recorrido: RecorridoComunidadApi;
  onPress: () => void;
};

/**
 * Tarjeta de un recorrido de la comunidad, a modo de publicación. Cuanto mejor valorado y
 * más constante quien lo publicó, más resalta. El orden lo decide el backend (RN-082);
 * nada de esto usa velocidad (RN-070).
 */
export function RecorridoComunidadCard({ recorrido: r, onPress }: Props) {
  const theme = useTheme();
  const { autor, valoracion, reputacion_autor: reputacion } = r;
  const muyRecomendado = valoracion.muy_recomendado;
  const esLeyenda = reputacion.nivel === 'leyenda';
  const esDestacado = reputacion.nivel === 'destacado';
  const rachaEncendida = nivelRacha(reputacion.racha_semanas) > 0;
  const insigniasOcultas = reputacion.insignias_total - reputacion.insignias_destacadas.length;
  const nombreCompleto = [autor.nombre, autor.apellido].filter(Boolean).join(' ');
  const nombreRecorrido = r.nombre?.trim() || 'Recorrido sin nombre';

  const borde =
    esLeyenda || muyRecomendado
      ? { borderColor: theme.goldLine, borderWidth: 2 }
      : esDestacado
        ? { borderColor: theme.accentLine, borderWidth: 1.5 }
        : { borderColor: theme.border, borderWidth: 1 };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombreRecorrido}, publicado por ${nombreCompleto}`}
      style={[styles.card, borde, { backgroundColor: theme.surface }]}
    >
      {muyRecomendado ? (
        <View style={[styles.cinta, { backgroundColor: theme.gold }]}>
          <Feather name="star" size={15} color={theme.onGold} />
          <Text style={[styles.cintaTexto, { color: theme.onGold }]}>
            Muy recomendado · {valoracion.porcentaje_recomienda} %
          </Text>
        </View>
      ) : null}

      <View style={styles.cuerpo}>
        <View style={styles.autorFila}>
          <Avatar
            person={{ nombre: autor.nombre, apellido: autor.apellido ?? undefined }}
            size={esLeyenda ? 'md' : 'sm'}
            ring={esLeyenda || esDestacado}
            style={esLeyenda ? { borderColor: theme.gold } : undefined}
          />
          <View style={styles.autorTexto}>
            <Text style={[styles.autorNombre, { color: theme.text }]} numberOfLines={1}>
              {nombreCompleto}
            </Text>
            <Text style={[styles.textoChico, { color: theme.textMute }]} numberOfLines={1}>
              {formatearEnArg(r.publicado_at, { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </Text>
          </View>
          {esLeyenda ? (
            <View style={[styles.nivel, { backgroundColor: theme.gold }]}>
              <Feather name="award" size={13} color={theme.onGold} />
              <Text style={[styles.nivelTexto, { color: theme.onGold }]}>Leyenda</Text>
            </View>
          ) : esDestacado ? (
            <View style={[styles.nivel, { backgroundColor: theme.accentWeak }]}>
              <Feather name="trending-up" size={13} color={theme.accent} />
              <Text style={[styles.nivelTexto, { color: theme.accent }]}>Destacado</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.datosAutor}>
          {reputacion.racha_semanas > 0 ? (
            <Text
              style={[
                styles.textoChico,
                rachaEncendida
                  ? [styles.rachaEncendida, { color: theme.fire }]
                  : { color: theme.textDim },
              ]}
            >
              🔥 {reputacion.racha_semanas} {reputacion.racha_semanas === 1 ? 'semana' : 'semanas'}
            </Text>
          ) : null}
          <Text style={[styles.textoChico, { color: theme.textDim }]}>
            {textoAntiguedad(reputacion.miembro_desde)}
          </Text>
        </View>

        {reputacion.insignias_destacadas.length > 0 ? (
          <View style={styles.insignias}>
            {reputacion.insignias_destacadas.map((insignia) => (
              <View
                key={insignia.codigo}
                style={[
                  styles.insignia,
                  insignia.rara
                    ? { backgroundColor: theme.goldWeak, borderColor: theme.goldLine }
                    : { backgroundColor: theme.surface2, borderColor: theme.border },
                ]}
              >
                <Feather
                  name={insignia.icono as keyof typeof Feather.glyphMap}
                  size={13}
                  color={insignia.rara ? theme.gold : theme.textDim}
                />
                <Text
                  style={[
                    styles.textoChico,
                    insignia.rara
                      ? [styles.insigniaRara, { color: theme.gold }]
                      : { color: theme.textDim },
                  ]}
                  numberOfLines={1}
                >
                  {insignia.nombre}
                </Text>
              </View>
            ))}
            {insigniasOcultas > 0 ? (
              <View
                style={[
                  styles.insignia,
                  { backgroundColor: theme.surface2, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.textoChico, { color: theme.textDim }]}>
                  +{insigniasOcultas}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {r.comentario ? (
          <View style={[styles.comentario, { borderLeftColor: theme.accentLine }]}>
            <Text style={[styles.comentarioTexto, { color: theme.text }]} numberOfLines={3}>
              {r.comentario}
            </Text>
          </View>
        ) : null}

        <View style={[styles.ruta, { backgroundColor: theme.surface2 }]}>
          <ActivityTile activity={r.tipo_actividad} size={44} />
          <View style={styles.rutaTexto}>
            <Text style={[styles.rutaNombre, { color: theme.text }]} numberOfLines={1}>
              {nombreRecorrido}
            </Text>
            <Text style={[styles.textoChico, { color: theme.textDim }]} numberOfLines={1}>
              {formatKm(r.distancia_m)} · {formatDurationHm(r.tiempo_seg)}
            </Text>
          </View>
        </View>

        <View style={styles.pie}>
          <Feather
            name="thumbs-up"
            size={muyRecomendado ? 16 : 14}
            color={muyRecomendado ? theme.gold : valoracion.total > 0 ? theme.accent : theme.textMute}
          />
          <Text
            style={[
              styles.valoracion,
              muyRecomendado && styles.valoracionFuerte,
              {
                color: muyRecomendado
                  ? theme.gold
                  : valoracion.total > 0
                    ? theme.textDim
                    : theme.textMute,
              },
            ]}
            numberOfLines={1}
          >
            {textoValoracion(valoracion)}
          </Text>
          {r.tiene_checklist ? (
            <Feather
              name="check-square"
              size={15}
              color={theme.textDim}
              accessibilityLabel="Incluye checklist"
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden' },
  cinta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  cintaTexto: { fontSize: 14, fontWeight: '800' },
  cuerpo: { padding: 14, gap: 10 },
  autorFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  autorTexto: { flex: 1, gap: 1 },
  autorNombre: { fontSize: 15, fontWeight: '700' },
  textoChico: { fontSize: 13 },
  nivel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  nivelTexto: { fontSize: 13, fontWeight: '800' },
  datosAutor: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  rachaEncendida: { fontWeight: '800' },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  insignia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  insigniaRara: { fontWeight: '800' },
  comentario: { borderLeftWidth: 3, paddingLeft: 10 },
  comentarioTexto: { fontSize: 14.5, lineHeight: 20 },
  ruta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 10,
  },
  rutaTexto: { flex: 1, gap: 2 },
  rutaNombre: { fontSize: 15, fontWeight: '700' },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valoracion: { flex: 1, fontSize: 13, fontWeight: '600' },
  valoracionFuerte: { fontSize: 14, fontWeight: '800' },
});
