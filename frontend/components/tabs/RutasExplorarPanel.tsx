import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Pressable } from '@/components/Pressable';
import { HerramientasLista } from '@/components/BarraFiltros';
import { ActivityTile, useTheme } from '@/components/MeshUI';
import {
  OpcionFiltro,
  OpcionesFiltro,
  PantallaFiltros,
  SeccionFiltro,
} from '@/components/PantallaFiltros';
import { PasoAyuda } from '@/components/ayuda/PasoAyuda';
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda';
import { AYUDA_RECORRIDOS_PUBLICADOS } from '@/components/ayuda/contenidoAyuda';
import { RecorridoComunidadCard } from '@/components/tabs/RecorridoComunidadCard';
import { meshError } from '@/lib/meshAlert';
import { useSugerenciasLugares } from '@/hooks/useSugerenciasLugares';
import type { LugarSugerencia } from '@/lib/nominatim';
import {
  importarRecorridoPublicado,
  listarRecorridosPublicados,
  type RecorridoComunidadApi,
} from '@/lib/recorridosPublicadosApi';
import { confirmarQuitarGuardada } from '@/lib/rutasGuardadas';
import type { TipoActividadApi } from '@/lib/viajesApi';

const FILTROS: { id: TipoActividadApi | null; label: string }[] = [
  { id: null, label: 'Todas' },
  { id: 'moto', label: 'Moto' },
  { id: 'auto', label: 'Auto' },
  { id: 'bici', label: 'Bici' },
  { id: 'running', label: 'Running' },
  { id: 'trekking', label: 'Trekking' },
  { id: 'otro', label: 'Otro' },
];

/** SCRUM-62: radios ofrecidos para la zona (el backend acepta de 1 a 200 km). */
const RADIOS_KM = [10, 25, 50, 100] as const;

/** Pausa de tipeo antes de consultar, para no pegarle al backend por cada letra. */
const ESPERA_BUSQUEDA_MS = 350;

type ModoZona = 'todas' | 'cerca' | 'lugar';
type Zona = { lat: number; lng: number; etiqueta: string };

const ETIQUETA_CERCA = 'tu ubicación';

export function RutasExplorarPanel({ encabezado }: { encabezado: ReactNode }) {
  const espacioTabBar = useEspacioTabBar();
  const theme = useTheme();
  const router = useRouter();
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [q, setQ] = useState('');
  // Filtros aplicados (los que consulta el backend).
  const [filtro, setFiltro] = useState<TipoActividadApi | null>(null);
  const [zona, setZona] = useState<Zona | null>(null);
  const [radioKm, setRadioKm] = useState<number>(25);
  // Borrador de la pantalla de filtros: se aplica recién al confirmar.
  const [pantallaFiltros, setPantallaFiltros] = useState(false);
  const [bFiltro, setBFiltro] = useState<TipoActividadApi | null>(null);
  const [modoZona, setModoZona] = useState<ModoZona>('todas');
  const [bZona, setBZona] = useState<Zona | null>(null);
  const [bRadioKm, setBRadioKm] = useState<number>(25);
  const [ubicando, setUbicando] = useState(false);
  const [busquedaLugar, setBusquedaLugar] = useState('');
  // Sugiere mientras se escribe; se apaga cuando el texto es el lugar ya elegido.
  const {
    sugerencias: resultados,
    buscando: buscandoLugar,
    error: errorLugar,
    resolver: resolverLugar,
  } = useSugerenciasLugares(busquedaLugar, {
    activo: pantallaFiltros && modoZona === 'lugar' && busquedaLugar !== bZona?.etiqueta,
  });
  const [recorridos, setRecorridos] = useState<RecorridoComunidadApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Una respuesta lenta de una búsqueda vieja no debe pisar la de la última.
  const ultimaCarga = useRef(0);

  useEffect(() => {
    const espera = setTimeout(() => setQ(textoBusqueda.trim()), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(espera);
  }, [textoBusqueda]);

  const cargar = useCallback(
    async (esRefresh = false) => {
      const carga = ++ultimaCarga.current;
      if (esRefresh) setRefreshing(true);
      else setCargando(true);
      setError(null);
      try {
        const data = await listarRecorridosPublicados({
          q: q || undefined,
          tipoActividad: filtro ?? undefined,
          zona: zona ? { lat: zona.lat, lng: zona.lng, radioKm } : undefined,
        });
        if (carga === ultimaCarga.current) setRecorridos(data);
      } catch (e: unknown) {
        if (carga === ultimaCarga.current) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar los recorridos.');
        }
      } finally {
        if (carga === ultimaCarga.current) {
          setCargando(false);
          setRefreshing(false);
        }
      }
    },
    [q, filtro, zona, radioKm]
  );

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const marcarGuardado = (recorridoId: string, plantillaId: string | null) =>
    setRecorridos((prev) =>
      prev.map((r) => (r.id === recorridoId ? { ...r, mi_plantilla_id: plantillaId } : r))
    );

  // Corazón de la tarjeta: guarda la ruta (con su checklist, si tiene) o, si ya estaba
  // guardada, la quita previa confirmación.
  const alternarGuardado = async (r: RecorridoComunidadApi) => {
    if (r.mi_plantilla_id) {
      confirmarQuitarGuardada({
        nombre: r.nombre?.trim() || 'Recorrido sin nombre',
        plantillaId: r.mi_plantilla_id,
        onInicio: () => setGuardandoId(r.id),
        onFin: () => setGuardandoId(null),
        onQuitada: () => marcarGuardado(r.id, null),
      });
      return;
    }
    setGuardandoId(r.id);
    try {
      const { plantilla } = await importarRecorridoPublicado(r.id, {
        guardarChecklist: r.tiene_checklist,
      });
      marcarGuardado(r.id, plantilla.id);
    } catch (e) {
      meshError('No se pudo guardar la ruta', e instanceof Error ? e.message : undefined);
    } finally {
      setGuardandoId(null);
    }
  };

  const verTodas = () => {
    setModoZona('todas');
    setBZona(null);
  };

  const usarMiUbicacion = async () => {
    setModoZona('cerca');
    setUbicando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        meshError('Ubicación', 'Necesitamos tu ubicación para mostrarte recorridos cerca tuyo.');
        verTodas();
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setBZona({ lat: pos.coords.latitude, lng: pos.coords.longitude, etiqueta: ETIQUETA_CERCA });
    } catch {
      meshError('Ubicación', 'No pudimos obtener tu ubicación. Probá elegir un lugar.');
      verTodas();
    } finally {
      setUbicando(false);
    }
  };

  const elegirLugar = () => {
    setModoZona('lugar');
    setBZona(null);
    setBusquedaLugar('');
  };

  const seleccionarLugar = async (sugerencia: LugarSugerencia) => {
    const lugar = await resolverLugar(sugerencia);
    if (!lugar) return;
    setBZona({ lat: lugar.lat, lng: lugar.lng, etiqueta: lugar.nombre });
    setBusquedaLugar(lugar.nombre);
  };

  const mensajeVacio = q
    ? `No encontramos recorridos para “${q}”.`
    : zona
      ? 'No hay recorridos publicados que arranquen en esta zona. Probá con un radio mayor.'
      : 'Todavía no hay recorridos publicados. Publicá uno desde el resumen de un viaje finalizado.';

  const cantidadFiltros = (filtro ? 1 : 0) + (zona ? 1 : 0);

  const abrirFiltros = () => {
    const esCerca = zona?.etiqueta === ETIQUETA_CERCA;
    setBFiltro(filtro);
    setBZona(zona);
    setBRadioKm(radioKm);
    setModoZona(!zona ? 'todas' : esCerca ? 'cerca' : 'lugar');
    setBusquedaLugar(zona && !esCerca ? zona.etiqueta : '');
    setPantallaFiltros(true);
  };

  const aplicarFiltros = () => {
    setFiltro(bFiltro);
    setZona(modoZona === 'todas' ? null : bZona);
    setRadioKm(bRadioKm);
    setPantallaFiltros(false);
  };

  const limpiarFiltros = () => {
    setFiltro(null);
    setZona(null);
  };

  const limpiarBorrador = () => {
    setBFiltro(null);
    verTodas();
  };

  const resumen = cargando
    ? undefined
    : `${recorridos.length} ${recorridos.length === 1 ? 'recorrido' : 'recorridos'}` +
      (zona ? ` · a ${radioKm} km de ${zona.etiqueta}` : '');

  return (
    <View style={styles.root}>
    <ScrollViewAyuda
      contentContainerStyle={{ paddingBottom: espacioTabBar }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void cargar(true)}
          tintColor={theme.accent}
        />
      }
    >
      {encabezado}

      <PasoAyuda {...AYUDA_RECORRIDOS_PUBLICADOS[0]!}>
        <HerramientasLista
          resumen={resumen}
          busqueda={{
            value: textoBusqueda,
            onChangeText: setTextoBusqueda,
            placeholder: 'Buscar por nombre, autor o comentario',
            accessibilityLabel: 'Buscar recorridos',
            maxLength: 60,
          }}
          filtros={{ cantidad: cantidadFiltros, onPress: abrirFiltros, onLimpiar: limpiarFiltros }}
        />
      </PasoAyuda>

      <View style={styles.content}>
      <PasoAyuda {...AYUDA_RECORRIDOS_PUBLICADOS[1]!}>
        <View style={styles.lista}>
          {cargando ? (
            <ActivityIndicator color={theme.accent} size="large" style={styles.spinner} />
          ) : error ? (
            <Text style={[styles.mensaje, { color: theme.danger }]}>{error}</Text>
          ) : recorridos.length === 0 ? (
            <Text style={[styles.mensaje, { color: theme.textMute }]}>{mensajeVacio}</Text>
          ) : (
            recorridos.map((r) => (
              <RecorridoComunidadCard
                key={r.id}
                recorrido={r}
                guardando={guardandoId === r.id}
                onAlternarGuardado={() => void alternarGuardado(r)}
                onPress={() =>
                  router.push({
                    pathname: '/recorridos-publicados/[recorridoId]',
                    params: { recorridoId: r.id },
                  })
                }
              />
            ))
          )}
        </View>
      </PasoAyuda>
      </View>
    </ScrollViewAyuda>

    <PantallaFiltros
      visible={pantallaFiltros}
      titulo="Filtrar recorridos"
      onCerrar={() => setPantallaFiltros(false)}
      onLimpiar={limpiarBorrador}
      puedeLimpiar={bFiltro !== null || modoZona !== 'todas'}
      textoAplicar="Aplicar filtros"
      onAplicar={aplicarFiltros}
    >
      <SeccionFiltro titulo="Actividad">
        <OpcionesFiltro>
          {FILTROS.map((f) => (
            <OpcionFiltro
              key={f.label}
              etiqueta={f.label}
              activa={bFiltro === f.id}
              onPress={() => setBFiltro(f.id)}
              icono={f.id ? <ActivityTile activity={f.id} size={24} /> : undefined}
            />
          ))}
        </OpcionesFiltro>
      </SeccionFiltro>

      <SeccionFiltro titulo="Zona" ayuda="Dónde arranca el recorrido">
        <OpcionesFiltro>
          <OpcionFiltro
            etiqueta="Cualquier lugar"
            activa={modoZona === 'todas'}
            onPress={verTodas}
            icono={<Feather name="globe" size={15} color={modoZona === 'todas' ? theme.accent : theme.textDim} />}
          />
          <OpcionFiltro
            etiqueta="Cerca mío"
            activa={modoZona === 'cerca'}
            onPress={() => void usarMiUbicacion()}
            icono={<Feather name="navigation" size={15} color={modoZona === 'cerca' ? theme.accent : theme.textDim} />}
          />
          <OpcionFiltro
            etiqueta="Elegir lugar"
            activa={modoZona === 'lugar'}
            onPress={elegirLugar}
            icono={<Feather name="map-pin" size={15} color={modoZona === 'lugar' ? theme.accent : theme.textDim} />}
          />
        </OpcionesFiltro>
      {modoZona !== 'todas' ? (
        <View style={styles.zona}>
          {modoZona === 'lugar' ? (
            <View style={styles.lugar}>
              <View style={styles.lugarFila}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder="Ciudad o lugar (ej. Villa General Belgrano)"
                  placeholderTextColor={theme.textMute}
                  value={busquedaLugar}
                  onChangeText={setBusquedaLugar}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {/* Indicador: las sugerencias aparecen solas mientras se escribe. */}
                <View style={[styles.btnBuscar, { backgroundColor: theme.accent }]}>
                  {buscandoLugar ? (
                    <ActivityIndicator color={theme.onAccent} size="small" />
                  ) : (
                    <Feather name="search" size={18} color={theme.onAccent} />
                  )}
                </View>
              </View>
              {errorLugar ? (
                <Text style={[styles.zonaTexto, { color: theme.danger }]}>{errorLugar}</Text>
              ) : null}
              {resultados.map((lugar, i) => (
                <Pressable
                  key={lugar.placeId ?? `${lugar.lat},${lugar.lng},${i}`}
                  onPress={() => void seleccionarLugar(lugar)}
                  style={[
                    styles.resultado,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Feather name="map-pin" size={14} color={theme.textDim} />
                  <Text style={[styles.resultadoTexto, { color: theme.text }]} numberOfLines={2}>
                    {lugar.nombre}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {ubicando ? (
            <Text style={[styles.zonaTexto, { color: theme.textDim }]}>
              Buscando tu ubicación...
            </Text>
          ) : bZona ? (
            <Text style={[styles.zonaTexto, { color: theme.textDim }]} numberOfLines={2}>
              Recorridos que arrancan a menos de {bRadioKm} km de {bZona.etiqueta}
            </Text>
          ) : null}
        </View>
      ) : null}
      </SeccionFiltro>

      {modoZona !== 'todas' ? (
        <SeccionFiltro titulo="Radio">
          <OpcionesFiltro>
            {RADIOS_KM.map((km) => (
              <OpcionFiltro
                key={km}
                etiqueta={`${km} km`}
                activa={bRadioKm === km}
                onPress={() => setBRadioKm(km)}
              />
            ))}
          </OpcionesFiltro>
        </SeccionFiltro>
      ) : null}
    </PantallaFiltros>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  zona: { gap: 10 },
  zonaTexto: { fontSize: 13, lineHeight: 18 },
  lugar: { gap: 6 },
  lugarFila: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  btnBuscar: {
    width: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultadoTexto: { flex: 1, fontSize: 14 },
  lista: { gap: 12 },
  spinner: { marginVertical: 48 },
  mensaje: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginVertical: 32 },
});
