import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AvatarFallback, inicialesDe } from '@/components/AvatarFallback';
import { Esqueleto } from '@/components/Esqueleto';
import { Badge, useTheme } from '@/components/MeshUI';
import { Pressable } from '@/components/Pressable';
import { SelectableCard } from '@/components/SelectableCard';
import type { GrupoListItemApi } from '@/lib/gruposApi';
import { formatearEnArg } from '@/lib/tiempoArg';

const COLORES_GRUPO = ['#d76655', '#4a9eff', '#2f9e63', '#7a5ae0', '#c98a3e'];
const AVATAR_MIEMBRO = 24;

function colorDeGrupo(nombre: string): string {
  const suma = nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLORES_GRUPO[suma % COLORES_GRUPO.length]!;
}

/** En curso primero, después por próximo viaje (el más cercano antes) y el resto por nombre. */
export function ordenarGrupos(grupos: GrupoListItemApi[]): GrupoListItemApi[] {
  const peso = (g: GrupoListItemApi) => (g.viaje_en_curso ? 0 : g.proximo_viaje ? 1 : 2);
  return [...grupos].sort((a, b) => {
    const diff = peso(a) - peso(b);
    if (diff !== 0) return diff;
    if (a.proximo_viaje && b.proximo_viaje && !a.viaje_en_curso && !b.viaje_en_curso) {
      return a.proximo_viaje.fecha_programada.localeCompare(b.proximo_viaje.fecha_programada);
    }
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

type Props = {
  grupo: GrupoListItemApi;
  selectionActive: boolean;
  selected: boolean;
  onEnterSelection: (id: string) => void;
  onToggle: (id: string) => void;
  onDisabledPress: () => void;
};

export function TarjetaGrupo({
  grupo,
  selectionActive,
  selected,
  onEnterSelection,
  onToggle,
  onDisabledPress,
}: Props) {
  const theme = useTheme();
  const color = colorDeGrupo(grupo.nombre);
  const esLider = grupo.mi_rol === 'lider';
  // `miembros_preview` excluye al usuario: el resto se resume en "+N".
  const restantes = Math.max(0, grupo.cantidad_miembros - 1 - grupo.miembros_preview.length);
  const { viaje_en_curso: enCurso, proximo_viaje: proximo } = grupo;

  const abrirViaje = (viajeId: string) =>
    router.push({ pathname: '/viaje/[viajeId]', params: { viajeId } });

  return (
    <SelectableCard
      itemId={grupo.id}
      selectionActive={selectionActive}
      selected={selected}
      disabled={!esLider}
      onEnterSelection={onEnterSelection}
      onToggle={onToggle}
      onPress={() => router.push({ pathname: '/grupo/[grupoId]', params: { grupoId: grupo.id } })}
      onDisabledPress={onDisabledPress}
      style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.fila}>
        <View style={[styles.avatar, { backgroundColor: `${color}20` }]}>
          <Text style={[styles.avatarTexto, { color }]}>{inicialesDe(grupo.nombre)}</Text>
        </View>

        <View style={styles.cuerpo}>
          <View style={styles.titulo}>
            <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={1}>
              {grupo.nombre}
            </Text>
            {esLider ? (
              <MaterialCommunityIcons
                name="crown"
                size={16}
                color={theme.gold}
                accessibilityLabel="Sos líder"
              />
            ) : null}
          </View>

          <View style={styles.miembros}>
            {grupo.miembros_preview.length > 0 ? (
              <View style={styles.pila}>
                {grupo.miembros_preview.map((m, i) => (
                  <View
                    key={m.id}
                    style={[
                      styles.avatarMiembro,
                      { borderColor: theme.surface, marginLeft: i === 0 ? 0 : -8 },
                    ]}
                  >
                    <AvatarFallback nombre={m.nombre} size={AVATAR_MIEMBRO} usuarioId={m.id} />
                  </View>
                ))}
                {restantes > 0 ? (
                  <View
                    style={[
                      styles.avatarMiembro,
                      styles.mas,
                      { borderColor: theme.surface, backgroundColor: theme.surface3 },
                    ]}
                  >
                    <Text style={[styles.masTexto, { color: theme.textDim }]}>+{restantes}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <Text style={[styles.meta, { color: theme.textDim }]}>
              {grupo.cantidad_miembros} {grupo.cantidad_miembros === 1 ? 'miembro' : 'miembros'}
            </Text>
          </View>
        </View>

        {!selectionActive ? (
          <Feather name="chevron-right" size={18} color={theme.textMute} />
        ) : null}
      </View>

      <View style={[styles.estado, { borderTopColor: theme.border }]}>
        {enCurso ? (
          <Pressable
            style={styles.estadoFila}
            onPress={() => abrirViaje(enCurso.id)}
            disabled={selectionActive}
            accessibilityRole="button"
            accessibilityLabel={`Ver viaje en curso${enCurso.nombre ? ` ${enCurso.nombre}` : ''}`}
            hitSlop={6}
          >
            <Badge tone="live" pulse>
              En curso
            </Badge>
            <Text style={[styles.estadoTexto, { color: theme.text }]} numberOfLines={1}>
              {enCurso.nombre ?? 'Viaje sin nombre'}
            </Text>
            <Text style={[styles.estadoAccion, { color: theme.accent }]}>Ver</Text>
          </Pressable>
        ) : proximo ? (
          <Pressable
            style={styles.estadoFila}
            onPress={() => abrirViaje(proximo.id)}
            disabled={selectionActive}
            accessibilityRole="button"
            hitSlop={6}
          >
            <Feather name="calendar" size={14} color={theme.accent} />
            <Text style={[styles.estadoTexto, { color: theme.text }]} numberOfLines={1}>
              {formatearEnArg(proximo.fecha_programada, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {proximo.nombre ? (
                <Text style={{ color: theme.textDim }}>{` · ${proximo.nombre}`}</Text>
              ) : null}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.estadoFila}>
            <Feather name="calendar" size={14} color={theme.textMute} />
            <Text style={[styles.estadoTexto, { color: theme.textMute }]}>
              Sin viajes programados
            </Text>
          </View>
        )}
      </View>
    </SelectableCard>
  );
}

/** Silueta de la tarjeta mientras carga la lista. */
export function TarjetaGrupoEsqueleto() {
  const theme = useTheme();
  return (
    <View style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.fila}>
        <Esqueleto ancho={48} alto={48} radio={12} />
        <View style={styles.cuerpo}>
          <Esqueleto ancho="60%" alto={15} />
          <Esqueleto ancho="40%" alto={12} />
        </View>
      </View>
      <View style={[styles.estado, { borderTopColor: theme.border }]}>
        <Esqueleto ancho="50%" alto={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    borderRadius: 14,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    fontSize: 17,
    fontWeight: '700',
  },
  cuerpo: {
    flex: 1,
    gap: 6,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  miembros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pila: {
    flexDirection: 'row',
  },
  avatarMiembro: {
    borderWidth: 2,
    borderRadius: AVATAR_MIEMBRO / 2 + 2,
  },
  mas: {
    width: AVATAR_MIEMBRO + 4,
    height: AVATAR_MIEMBRO + 4,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masTexto: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
  },
  estado: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingVertical: 11,
  },
  estadoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  estadoTexto: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  estadoAccion: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
