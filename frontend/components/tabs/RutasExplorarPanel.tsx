import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Btn, Chip, ChipRow, useTheme } from '@/components/MeshUI';
import { PasoAyuda } from '@/components/ayuda/PasoAyuda';
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda';
import { AYUDA_RECORRIDOS_PUBLICADOS } from '@/components/ayuda/contenidoAyuda';
import { RecorridoComunidadCard } from '@/components/tabs/RecorridoComunidadCard';
import { meshError } from '@/lib/meshAlert';
import { buscarLugares, type LugarHit } from '@/lib/nominatim';
import { abrirNuevoViaje } from '@/lib/nuevoViaje';
import {
  listarRecorridosPublicados,
  type RecorridoComunidadApi,
} from '@/lib/recorridosPublicadosApi';
import type { TipoActividadApi } from '@/lib/viajesApi';

const FILTROS: { id: TipoActividadApi | null; label: string }[] = [
  { id: null, label: 'Todos' },
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

export function RutasExplorarPanel() {
  const espacioTabBar = useEspacioTabBar();
  const theme = useTheme();
  const router = useRouter();
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<TipoActividadApi | null>(null);
  const [modoZona, setModoZona] = useState<ModoZona>('todas');
  const [zona, setZona] = useState<Zona | null>(null);
  const [radioKm, setRadioKm] = useState<number>(25);
  const [ubicando, setUbicando] = useState(false);
  const [busquedaLugar, setBusquedaLugar] = useState('');
  const [buscandoLugar, setBuscandoLugar] = useState(false);
  const [resultados, setResultados] = useState<LugarHit[]>([]);
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

  const verTodas = () => {
    setModoZona('todas');
    setZona(null);
    setResultados([]);
  };

  const usarMiUbicacion = async () => {
    setModoZona('cerca');
    setResultados([]);
    setUbicando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        meshError('Ubicación', 'Necesitamos tu ubicación para mostrarte recorridos cerca tuyo.');
        verTodas();
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setZona({ lat: pos.coords.latitude, lng: pos.coords.longitude, etiqueta: 'tu ubicación' });
    } catch {
      meshError('Ubicación', 'No pudimos obtener tu ubicación. Probá elegir un lugar.');
      verTodas();
    } finally {
      setUbicando(false);
    }
  };

  const elegirLugar = () => {
    setModoZona('lugar');
    setZona(null);
  };

  const buscarLugar = async () => {
    if (busquedaLugar.trim().length < 3) return;
    setBuscandoLugar(true);
    try {
      setResultados(await buscarLugares(busquedaLugar));
    } catch (e) {
      meshError('Búsqueda', e instanceof Error ? e.message : 'No se pudo buscar el lugar.');
    } finally {
      setBuscandoLugar(false);
    }
  };

  const seleccionarLugar = (lugar: LugarHit) => {
    setZona({ lat: lugar.lat, lng: lugar.lng, etiqueta: lugar.nombre });
    setBusquedaLugar(lugar.nombre);
    setResultados([]);
  };

  const mensajeVacio = q
    ? `No encontramos recorridos para “${q}”.`
    : zona
      ? 'No hay recorridos publicados que arranquen en esta zona. Probá con un radio mayor.'
      : 'Todavía no hay recorridos publicados. Publicá uno desde el resumen de un viaje finalizado.';

  return (
    <ScrollViewAyuda
      contentContainerStyle={[styles.content, { paddingBottom: espacioTabBar }]}
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
      <PasoAyuda {...AYUDA_RECORRIDOS_PUBLICADOS[0]!}>
        <View
          style={[styles.buscador, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Feather name="search" size={18} color={theme.textDim} />
          <TextInput
            style={[styles.buscadorInput, { color: theme.text }]}
            placeholder="Buscar por nombre, autor o comentario"
            placeholderTextColor={theme.textMute}
            value={textoBusqueda}
            onChangeText={setTextoBusqueda}
            returnKeyType="search"
            autoCorrect={false}
            maxLength={60}
            accessibilityLabel="Buscar recorridos"
          />
          {textoBusqueda ? (
            <Pressable
              onPress={() => setTextoBusqueda('')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
            >
              <Feather name="x" size={18} color={theme.textDim} />
            </Pressable>
          ) : null}
        </View>
      </PasoAyuda>

      <PasoAyuda {...AYUDA_RECORRIDOS_PUBLICADOS[1]!}>
        <ChipRow>
          {FILTROS.map((f) => (
            <Chip key={f.label} active={filtro === f.id} onPress={() => setFiltro(f.id)}>
              {f.label}
            </Chip>
          ))}
        </ChipRow>
      </PasoAyuda>

      <PasoAyuda {...AYUDA_RECORRIDOS_PUBLICADOS[2]!}>
        <View style={styles.zona}>
          <ChipRow>
            <Chip icon="globe" active={modoZona === 'todas'} onPress={verTodas}>
              Cualquier lugar
            </Chip>
            <Chip
              icon="navigation"
              active={modoZona === 'cerca'}
              onPress={() => void usarMiUbicacion()}
            >
              Cerca mío
            </Chip>
            <Chip icon="map-pin" active={modoZona === 'lugar'} onPress={elegirLugar}>
              Elegir lugar
            </Chip>
          </ChipRow>

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
                  onSubmitEditing={() => void buscarLugar()}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={() => void buscarLugar()}
                  accessibilityRole="button"
                  accessibilityLabel="Buscar lugar"
                  style={[styles.btnBuscar, { backgroundColor: theme.accent }]}
                >
                  {buscandoLugar ? (
                    <ActivityIndicator color={theme.onAccent} size="small" />
                  ) : (
                    <Feather name="search" size={18} color={theme.onAccent} />
                  )}
                </Pressable>
              </View>
              {resultados.map((lugar) => (
                <Pressable
                  key={`${lugar.lat},${lugar.lng},${lugar.nombre}`}
                  onPress={() => seleccionarLugar(lugar)}
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
          ) : zona ? (
            <>
              <Text style={[styles.zonaTexto, { color: theme.textDim }]} numberOfLines={2}>
                Recorridos que arrancan a menos de {radioKm} km de {zona.etiqueta}
              </Text>
              <ChipRow>
                {RADIOS_KM.map((km) => (
                  <Chip key={km} active={radioKm === km} onPress={() => setRadioKm(km)}>
                    {`${km} km`}
                  </Chip>
                ))}
              </ChipRow>
            </>
          ) : null}
        </View>
      </PasoAyuda>

      <PasoAyuda {...AYUDA_RECORRIDOS_PUBLICADOS[3]!}>
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

      <View style={[styles.planificar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.planificarHeader}>
          <Feather name="map" size={20} color={theme.accent} />
          <Text style={[styles.planificarTitulo, { color: theme.text }]}>
            Planificar una ruta nueva
          </Text>
        </View>
        <Text style={[styles.planificarHint, { color: theme.textDim }]}>
          Creá un viaje y definí el recorrido desde cero para usarlo con tu grupo.
        </Text>
        <Btn block size="lg" icon="plus" variant="secondary" onPress={() => abrirNuevoViaje()}>
          Crear viaje con ruta
        </Btn>
      </View>
    </ScrollViewAyuda>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 12,
  },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  buscadorInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
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
  planificar: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginTop: 4,
  },
  planificarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planificarTitulo: {
    fontSize: 16,
    fontWeight: '700',
  },
  planificarHint: {
    fontSize: 14,
    lineHeight: 20,
  },
});
