import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pressable } from '@/components/Pressable';
import { router, useFocusEffect } from 'expo-router';

import { CorazonGuardar } from '@/components/CorazonGuardar';
import {
  BarraFiltros,
  BuscadorFiltros,
  ChipFiltro,
  FilaChipsFiltro,
} from '@/components/BarraFiltros';
import { Btn, useTheme } from '@/components/MeshUI';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import { formatDurationHm, formatKm } from '@/lib/format';
import { meshAlert } from '@/lib/meshAlert';
import { abrirNuevoViaje } from '@/lib/nuevoViaje';
import { listarRutasPlantilla, type RutaPlantillaResumenApi } from '@/lib/rutasCompartidasApi';
import { coincideBusqueda, normalizarBusqueda } from '@/lib/busqueda';
import { confirmarQuitarGuardada } from '@/lib/rutasGuardadas';

type FiltroAutor = 'todas' | 'mias' | 'otros';

const FILTROS_AUTOR: { id: FiltroAutor; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'mias', label: 'Creadas por mí' },
  { id: 'otros', label: 'De otros usuarios' },
];

export function RutasGuardadasPanel() {
  const espacioTabBar = useEspacioTabBar()
  const theme = useTheme();
  const { backendUserId } = useAuth();
  const [items, setItems] = useState<RutaPlantillaResumenApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [filtroAutor, setFiltroAutor] = useState<FiltroAutor>('todas');
  const [textoBusqueda, setTextoBusqueda] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const userId = resolveBackendUserId(backendUserId);
      const data = await listarRutasPlantilla(userId);
      setItems(data);
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudieron cargar tus rutas');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [backendUserId]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  // Desmarcar el corazón pide confirmación y saca la ruta de la lista.
  const quitar = (item: RutaPlantillaResumenApi) => {
    confirmarQuitarGuardada({
      nombre: item.nombre,
      plantillaId: item.id,
      onInicio: () => setQuitandoId(item.id),
      onFin: () => setQuitandoId(null),
      onQuitada: () => setItems((prev) => prev.filter((p) => p.id !== item.id)),
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const consulta = normalizarBusqueda(textoBusqueda);
  const visibles = items.filter(
    (item) =>
      (filtroAutor === 'todas' || item.creada_por_mi === (filtroAutor === 'mias')) &&
      coincideBusqueda(consulta, [item.nombre, item.origen_nombre, item.destino_nombre])
  );

  return (
    <View style={styles.root}>
    <FlatList
      data={visibles}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, { paddingBottom: espacioTabBar }]}
      // Búsqueda y filtros scrollean con la lista para dejarle más lugar.
      ListHeaderComponent={
        <BarraFiltros>
          <BuscadorFiltros
            value={textoBusqueda}
            onChangeText={setTextoBusqueda}
            placeholder="Buscar por nombre, origen o destino"
            accessibilityLabel="Buscar rutas guardadas"
            maxLength={60}
          />
          <FilaChipsFiltro>
            {FILTROS_AUTOR.map((f) => (
              <ChipFiltro
                key={f.id}
                label={f.label}
                activo={filtroAutor === f.id}
                onPress={() => setFiltroAutor(f.id)}
              />
            ))}
          </FilaChipsFiltro>
        </BarraFiltros>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/rutas-guardadas/[plantillaId]', params: { plantillaId: item.id } })
            }
            accessibilityRole="button"
            accessibilityLabel={`Ver ruta ${item.nombre}`}
          >
            <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
              {item.nombre}
            </Text>
            <Text style={[styles.meta, { color: theme.textDim }]}>
              {item.tipo_actividad}
              {item.distancia_planeada_m != null ? ` · ${formatKm(item.distancia_planeada_m)}` : ''}
              {item.tiempo_estimado_seg != null ? ` · ${formatDurationHm(item.tiempo_estimado_seg)}` : ''}
              {item.con_checklist ? ' · con checklist' : ''}
            </Text>
          </Pressable>
          <View style={styles.row}>
            <Btn
              variant="primary"
              size="sm"
              icon="plus"
              onPress={() =>
                abrirNuevoViaje({ plantillaId: item.id, tipoActividad: item.tipo_actividad })
              }
            >
              Usar en viaje
            </Btn>
            <CorazonGuardar
              guardada
              cargando={quitandoId === item.id}
              nombre={item.nombre}
              onPress={() => quitar(item)}
            />
          </View>
        </View>
      )}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: theme.textDim }]}>
          {items.length === 0
            ? 'Todavía no guardaste rutas. Tocá el corazón de una en la pestaña Explorar o guardala desde un viaje compartido.'
            : consulta
              ? 'Ninguna ruta guardada coincide con la búsqueda.'
              : filtroAutor === 'mias'
              ? 'No tenés rutas guardadas creadas por vos.'
              : 'No tenés rutas guardadas de otros usuarios.'}
        </Text>
      }
    />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { flexGrow: 1, gap: 12 },
  empty: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 22,
    paddingHorizontal: 24,
    marginTop: 36,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  nombre: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
