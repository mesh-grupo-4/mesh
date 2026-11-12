import { StyleSheet, Text, View } from 'react-native';
import { AvatarFallback } from '@/components/AvatarFallback';
import { Esqueleto } from '@/components/Esqueleto';
import { useTheme } from '@/components/MeshUI';
import { SelectableCard } from '@/components/SelectableCard';
import type { AmigoApi } from '@/lib/amistadesApi';

type Props = {
  amigo: AmigoApi;
  ancho: number;
  selectionActive: boolean;
  selected: boolean;
  onEnterSelection: (id: string) => void;
  onToggle: (id: string) => void;
  onPress: () => void;
};

/** Cuadrado de la grilla de amigos: avatar grande y nombre. El email queda para el perfil. */
export function TarjetaAmigo({
  amigo,
  ancho,
  selectionActive,
  selected,
  onEnterSelection,
  onToggle,
  onPress,
}: Props) {
  const theme = useTheme();

  return (
    <SelectableCard
      itemId={amigo.id}
      selectionActive={selectionActive}
      selected={selected}
      onEnterSelection={onEnterSelection}
      onToggle={onToggle}
      onPress={onPress}
      checkEnEsquina
      style={[
        styles.tarjeta,
        { width: ancho, backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.contenido}>
        <AvatarFallback
          nombre={amigo.nombre}
          size={Math.min(64, Math.round(ancho * 0.5))}
          usuarioId={amigo.id}
        />
        <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
          {amigo.nombre}
        </Text>
      </View>
    </SelectableCard>
  );
}

export function TarjetaAmigoEsqueleto({ ancho }: { ancho: number }) {
  const theme = useTheme();
  const circulo = Math.min(64, Math.round(ancho * 0.5));

  return (
    <View
      style={[
        styles.tarjeta,
        styles.centrado,
        { width: ancho, backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Esqueleto ancho={circulo} alto={circulo} radio={circulo / 2} />
      <Esqueleto ancho="70%" alto={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    aspectRatio: 0.9,
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 10,
  },
  contenido: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  // Para la celda exterior: sin `flex`, que en la fila de la grilla la estiraría a lo ancho.
  centrado: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  nombre: {
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});
