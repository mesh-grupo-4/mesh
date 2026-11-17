import { Image, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { CorazonGuardar } from '@/components/CorazonGuardar';
import {
  coloresValoracion,
  etiquetaValoracion,
  nivelValoracion,
} from '@/components/tabs/coloresValoracion';
import { MedidorValoracion } from '@/components/tabs/MedidorValoracion';
import { ActivityTile, Avatar, useTheme } from '@/components/MeshUI';
import { Pressable } from '@/components/Pressable';
import { formatDurationHm, formatKm } from '@/lib/format';
import { nombreCompleto } from '@/lib/nombres';
import {
  fotosDe,
  textoAntiguedad,
  type RecorridoComunidadApi,
} from '@/lib/recorridosPublicadosApi';
import { nivelRacha } from '@/lib/rachasApi';
import { formatearEnArg } from '@/lib/tiempoArg';

type Props = {
  recorrido: RecorridoComunidadApi;
  onPress: () => void;
  /** Toque en el corazón: guardar la ruta o quitarla de guardadas. */
  onAlternarGuardado: () => void;
  guardando?: boolean;
};

/**
 * Tarjeta de un recorrido de la comunidad, a modo de publicación. El marco y el medidor
 * del pie hablan solo de la valoración de la ruta, en escalones (RN-082); la reputación de
 * quien publicó se ve en su avatar y su sello. El orden lo decide el backend; nada de esto
 * usa velocidad (RN-070).
 */
export function RecorridoComunidadCard({
  recorrido: r,
  onPress,
  onAlternarGuardado,
  guardando,
}: Props) {
  const theme = useTheme();
  const { autor, valoracion, reputacion_autor: reputacion } = r;
  const muyRecomendado = valoracion.muy_recomendado;
  const esLeyenda = reputacion.nivel === 'leyenda';
  const esDestacado = reputacion.nivel === 'destacado';
  const rachaEncendida = nivelRacha(reputacion.racha_semanas) > 0;
  const insigniasOcultas = reputacion.insignias_total - reputacion.insignias_destacadas.length;
  const nombreAutor = nombreCompleto(autor.nombre, autor.apellido);
  const nombreRecorrido = r.nombre?.trim() || 'Recorrido sin nombre';
  const cantidadFotos = fotosDe(r).length;
  const nivel = nivelValoracion(valoracion);
  const colores = coloresValoracion(nivel, theme);

  // El marco crece con la valoración de la ruta y con nada más: sin votos o poco
  // recomendado, neutro; después naranja, verde y dorado, cada vez más grueso.
  const borde = !colores.borde
    ? { borderColor: theme.border, borderWidth: 1 }
    : { borderColor: colores.borde, borderWidth: muyRecomendado ? 2 : nivel === 'buena' ? 1.5 : 1 };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombreRecorrido}, publicado por ${nombreAutor}. ${etiquetaValoracion(nivel)}`}
      style={[styles.card, borde, { backgroundColor: theme.surface }]}
    >
      {muyRecomendado ? (
        <View style={[styles.cinta, { backgroundColor: theme.gold }]}>
          <Feather name="star" size={15} color={theme.onGold} />
          <Text style={[styles.cintaTexto, { color: theme.onGold }]}>Muy recomendado</Text>
        </View>
      ) : null}

      {r.foto ? (
        <View>
          <Image
            source={{ uri: r.foto }}
            style={[styles.foto, { backgroundColor: theme.surface2 }]}
            resizeMode="cover"
            accessibilityLabel={`Foto de ${nombreRecorrido}`}
          />
          {cantidadFotos > 1 ? (
            <View style={styles.masFotos} accessibilityLabel={`${cantidadFotos} fotos`}>
              <Feather name="image" size={13} color="#ffffff" />
              <Text style={styles.masFotosTexto}>{cantidadFotos}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.cuerpo}>
        <View style={styles.autorFila}>
          <Avatar
            person={{ nombre: autor.nombre, apellido: autor.apellido ?? undefined }}
            usuarioId={autor.id}
            size={esLeyenda ? 'md' : 'sm'}
            ring={esLeyenda || esDestacado}
            style={esLeyenda ? { borderColor: theme.gold } : undefined}
          />
          <View style={styles.autorTexto}>
            <Text style={[styles.autorNombre, { color: theme.text }]} numberOfLines={1}>
              {nombreAutor}
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
                  ? [styles.rachaEncendida, { color: theme.text }]
                  : { color: theme.textDim },
              ]}
            >
              {reputacion.racha_semanas === 1
                ? 'Racha de 1 semana'
                : `Racha de ${reputacion.racha_semanas} semanas`}
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
          <CorazonGuardar
            guardada={r.mi_plantilla_id !== null}
            cargando={guardando}
            nombre={nombreRecorrido}
            onPress={onAlternarGuardado}
          />
        </View>

        <View style={styles.pie}>
          <MedidorValoracion
            valoracion={valoracion}
            guardados={r.guardados}
            style={styles.medidor}
          />
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
  foto: { width: '100%', aspectRatio: 4 / 3 },
  // Sobre la foto el fondo no depende del tema: oscuro translúcido y texto blanco.
  masFotos: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  masFotosTexto: { color: '#ffffff', fontSize: 12.5, fontWeight: '700' },
  medidor: { flex: 1 },
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
  pie: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
