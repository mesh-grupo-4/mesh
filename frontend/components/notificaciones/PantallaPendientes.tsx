import type { ReactNode } from 'react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Esqueleto } from '@/components/Esqueleto';
import { EstadoVacio } from '@/components/EstadoVacio';
import { TopBar, useTheme } from '@/components/MeshUI';
import { meshError } from '@/lib/meshAlert';

type Props<T extends { id: string }> = {
  titulo: string;
  /** Estado vacío: qué va a aparecer acá cuando llegue algo. */
  textoVacio: string;
  cargar: () => Promise<T[]>;
  /** Avisa el largo de la lista para el puntito de la campanita y el badge de la pestaña. */
  onCantidad: (n: number) => void;
  /** `quitar` saca el ítem respondido de la lista (con su fundido de salida). */
  renderItem: (item: T, quitar: () => void) => ReactNode;
};

/**
 * Pantalla completa de la campanita (invitaciones a grupos, solicitudes de amistad):
 * carga, refresco con tirón, estado vacío y lista de `FilaNotificacion`.
 */
export function PantallaPendientes<T extends { id: string }>({
  titulo,
  textoVacio,
  cargar,
  onCantidad,
  renderItem,
}: Props<T>) {
  const theme = useTheme();
  const [items, setItems] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const traer = useCallback(
    async (esRefresh = false) => {
      if (esRefresh) setRefrescando(true);
      try {
        setItems(await cargar());
      } catch (e: unknown) {
        meshError('Error', e instanceof Error ? e.message : 'No se pudo cargar la lista.');
      } finally {
        setCargando(false);
        setRefrescando(false);
      }
    },
    [cargar]
  );

  useEffect(() => {
    void traer();
  }, [traer]);

  useEffect(() => {
    if (!cargando) onCantidad(items.length);
  }, [items, cargando, onCantidad]);

  const sub = cargando
    ? undefined
    : items.length === 0
      ? 'Sin pendientes'
      : `${items.length} ${items.length === 1 ? 'pendiente' : 'pendientes'}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title={titulo} sub={sub} onBack={() => router.back()} bordered={false} />

      <ScrollView
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => void traer(true)}
            tintColor={theme.accent}
          />
        }
      >
        {cargando ? (
          [0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.esqueleto, { backgroundColor: theme.surface2, borderColor: theme.border }]}
            >
              <Esqueleto ancho={42} alto={42} radio={21} />
              <View style={styles.esqueletoCuerpo}>
                <Esqueleto ancho="80%" alto={14} />
                <Esqueleto ancho="35%" alto={11} />
                <Esqueleto alto={40} radio={10} style={styles.esqueletoBoton} />
              </View>
            </View>
          ))
        ) : items.length === 0 ? (
          <EstadoVacio icono="check" titulo="Estás al día" texto={textoVacio} />
        ) : (
          items.map((item) => (
            <Fragment key={item.id}>
              {renderItem(item, () => setItems((prev) => prev.filter((i) => i.id !== item.id)))}
            </Fragment>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  lista: {
    padding: 20,
    paddingBottom: 40,
    gap: 10,
  },
  esqueleto: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  esqueletoCuerpo: {
    flex: 1,
    gap: 8,
  },
  esqueletoBoton: {
    marginTop: 4,
  },
});
