import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { useCallback, useState, type ReactNode } from 'react';
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
import { HerramientasLista } from '@/components/BarraFiltros';
import { ActivityTile, Btn, useTheme } from '@/components/MeshUI';
import {
  OpcionFiltro,
  OpcionesFiltro,
  PantallaFiltros,
  SeccionFiltro,
} from '@/components/PantallaFiltros';
import { ACTIVIDADES } from '@/lib/activityDefaults';
import type { TipoActividadApi } from '@/lib/viajesApi';
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

type FiltrosGuardadas = { autor: FiltroAutor; actividad: TipoActividadApi | null };
const SIN_FILTROS: FiltrosGuardadas = { autor: 'todas', actividad: null };

function cantidadFiltros(f: FiltrosGuardadas): number {
  return (f.autor !== 'todas' ? 1 : 0) + (f.actividad ? 1 : 0);
}

export function RutasGuardadasPanel({ encabezado }: { encabezado: ReactNode }) {
  const espacioTabBar = useEspacioTabBar()
  const theme = useTheme();
  const { backendUserId } = useAuth();
  const [items, setItems] = useState<RutaPlantillaResumenApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosGuardadas>(SIN_FILTROS);
  const [borrador, setBorrador] = useState<FiltrosGuardadas>(SIN_FILTROS);
  const [pantallaFiltros, setPantallaFiltros] = useState(false);
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

  const consulta = normalizarBusqueda(textoBusqueda);
  const filtrar = (f: FiltrosGuardadas) =>
    items.filter(
      (item) =>
        (f.autor === 'todas' || item.creada_por_mi === (f.autor === 'mias')) &&
        (f.actividad === null || item.tipo_actividad === f.actividad) &&
        coincideBusqueda(consulta, [item.nombre, item.origen_nombre, item.destino_nombre])
    );
  const visibles = filtrar(filtros);
  const hayFiltros = cantidadFiltros(filtros) > 0;
  const cantidadBorrador = pantallaFiltros ? filtrar(borrador).length : 0;

  const cabecera = (
    <>
      {encabezado}
      <HerramientasLista
        resumen={
          loading
            ? undefined
            : consulta || hayFiltros
              ? `Mostrando ${visibles.length} de ${items.length}`
              : `${items.length} ${items.length === 1 ? 'ruta' : 'rutas'}`
        }
        busqueda={{
          value: textoBusqueda,
          onChangeText: setTextoBusqueda,
          placeholder: 'Buscar por nombre, origen o destino',
          accessibilityLabel: 'Buscar rutas guardadas',
          maxLength: 60,
        }}
        filtros={{
          cantidad: cantidadFiltros(filtros),
          onPress: () => {
            setBorrador(filtros);
            setPantallaFiltros(true);
          },
          onLimpiar: () => setFiltros(SIN_FILTROS),
        }}
      />
    </>
  );

  return (
    <View style={styles.root}>
    <FlatList
      data={loading ? [] : visibles}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, { paddingBottom: espacioTabBar }]}
      // Encabezado, búsqueda y filtros scrollean con la lista: nada queda fijo.
      ListHeaderComponent={cabecera}
      renderItem={({ item }) => (
        // Toda la tarjeta abre el detalle; los botones de abajo capturan su propio toque.
        <Pressable
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() =>
            router.push({ pathname: '/rutas-guardadas/[plantillaId]', params: { plantillaId: item.id } })
          }
          accessibilityRole="button"
          accessibilityLabel={`Ver ruta ${item.nombre}`}
        >
          <View>
            <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
              {item.nombre}
            </Text>
            <Text style={[styles.meta, { color: theme.textDim }]}>
              {item.tipo_actividad}
              {item.distancia_planeada_m != null ? ` · ${formatKm(item.distancia_planeada_m)}` : ''}
              {item.tiempo_estimado_seg != null ? ` · ${formatDurationHm(item.tiempo_estimado_seg)}` : ''}
              {item.con_checklist ? ' · con checklist' : ''}
            </Text>
          </View>
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
        </Pressable>
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={theme.accent} style={styles.cargando} />
        ) : (
          <Text style={[styles.empty, { color: theme.textDim }]}>
            {items.length === 0
              ? 'Todavía no guardaste rutas. Tocá el corazón de una en la pestaña Explorar o guardala desde un viaje compartido.'
              : consulta
                ? 'Ninguna ruta guardada coincide con la búsqueda.'
                : 'Ninguna ruta guardada coincide con los filtros.'}
          </Text>
        )
      }
    />

    <PantallaFiltros
      visible={pantallaFiltros}
      titulo="Filtrar rutas"
      onCerrar={() => setPantallaFiltros(false)}
      onLimpiar={() => setBorrador(SIN_FILTROS)}
      puedeLimpiar={cantidadFiltros(borrador) > 0}
      textoAplicar={
        cantidadBorrador === 0
          ? 'Sin resultados con estos filtros'
          : cantidadBorrador === 1
            ? 'Ver 1 ruta'
            : `Ver ${cantidadBorrador} rutas`
      }
      onAplicar={() => {
        setFiltros(borrador);
        setPantallaFiltros(false);
      }}
    >
      <SeccionFiltro titulo="Quién la creó">
        <OpcionesFiltro>
          {FILTROS_AUTOR.map((f) => (
            <OpcionFiltro
              key={f.id}
              etiqueta={f.label}
              activa={borrador.autor === f.id}
              onPress={() => setBorrador((b) => ({ ...b, autor: f.id }))}
            />
          ))}
        </OpcionesFiltro>
      </SeccionFiltro>

      <SeccionFiltro titulo="Actividad">
        <OpcionesFiltro>
          <OpcionFiltro
            etiqueta="Todas"
            activa={borrador.actividad === null}
            onPress={() => setBorrador((b) => ({ ...b, actividad: null }))}
          />
          {ACTIVIDADES.map((a) => (
            <OpcionFiltro
              key={a.id}
              etiqueta={a.label}
              activa={borrador.actividad === a.id}
              onPress={() => setBorrador((b) => ({ ...b, actividad: a.id }))}
              icono={<ActivityTile activity={a.id} size={24} />}
            />
          ))}
        </OpcionesFiltro>
      </SeccionFiltro>
    </PantallaFiltros>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cargando: { marginTop: 48 },
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
