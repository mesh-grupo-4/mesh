import type { ReactNode } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AvatarFallback } from '@/components/AvatarFallback';
import { useTheme } from '@/components/MeshUI';
import { Pressable } from '@/components/Pressable';
import type { GrupoMiembroApi } from '@/lib/gruposApi';
import { formatearEnArg } from '@/lib/tiempoArg';

const AVATAR = 44;

/** Líder primero; el resto por antigüedad en el grupo. */
export function ordenarMiembros(miembros: GrupoMiembroApi[]): GrupoMiembroApi[] {
  return [...miembros].sort((a, b) => {
    if (a.rol !== b.rol) return a.rol === 'lider' ? -1 : 1;
    return a.fecha_union.localeCompare(b.fecha_union);
  });
}

type Props = {
  miembro: GrupoMiembroApi;
  esYo: boolean;
  /** Línea divisoria arriba: las filas van apiladas dentro de una misma tarjeta. */
  separador?: boolean;
  /** Acción a la derecha (ej. menú del líder). */
  derecha?: ReactNode;
  atenuada?: boolean;
  onPress?: () => void;
};

/** Integrante de un grupo: avatar con anillo dorado si es líder, nombre y rol o antigüedad. */
export function FilaMiembro({ miembro, esYo, separador = false, derecha, atenuada, onPress }: Props) {
  const theme = useTheme();
  const esLider = miembro.rol === 'lider';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${miembro.nombre}${esYo ? ', vos' : ''}, ${esLider ? 'líder' : 'participante'}`}
      style={({ pressed }) => [
        styles.fila,
        separador && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
        pressed && onPress ? { backgroundColor: theme.surface2 } : null,
        atenuada && styles.atenuada,
      ]}
    >
      <View
        style={[
          styles.anillo,
          { borderColor: esLider ? theme.gold : 'transparent' },
        ]}
      >
        <AvatarFallback nombre={miembro.nombre} size={AVATAR} usuarioId={miembro.id} />
      </View>

      <View style={styles.cuerpo}>
        <View style={styles.titulo}>
          <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={1}>
            {miembro.nombre}
          </Text>
          {esYo ? (
            <View style={[styles.vos, { backgroundColor: theme.surface3 }]}>
              <Text style={[styles.vosTexto, { color: theme.textDim }]}>Vos</Text>
            </View>
          ) : null}
        </View>
        {esLider ? (
          <View style={styles.rol}>
            <MaterialCommunityIcons name="crown" size={14} color={theme.gold} />
            <Text style={[styles.sub, styles.subLider, { color: theme.gold }]}>Líder del grupo</Text>
          </View>
        ) : (
          <Text style={[styles.sub, { color: theme.textDim }]} numberOfLines={1}>
            Se unió el{' '}
            {formatearEnArg(miembro.fecha_union, { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        )}
      </View>

      {derecha}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  atenuada: {
    opacity: 0.6,
  },
  anillo: {
    borderWidth: 2,
    borderRadius: AVATAR / 2 + 3,
    padding: 1,
  },
  cuerpo: {
    flex: 1,
    gap: 3,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  vos: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vosTexto: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  rol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sub: {
    fontSize: 13.5,
  },
  subLider: {
    fontWeight: '700',
  },
});
