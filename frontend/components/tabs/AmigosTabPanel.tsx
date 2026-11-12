import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useFocusEffect, useRouter } from 'expo-router';
import { AvatarFallback } from '@/components/AvatarFallback';
import { HerramientasLista } from '@/components/BarraFiltros';
import { SelectionActionBar } from '@/components/SelectionActionBar';
import { BotonFlotante, ESPACIO_BOTON_FLOTANTE } from '@/components/BotonFlotante';
import { AYUDA_GRUPOS } from '@/components/ayuda/contenidoAyuda';
import { BotonSeleccionar, SelectionHeader } from '@/components/SelectionHeader';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import { useTheme } from '@/components/MeshUI';
import { useSelectionMode } from '@/hooks/useSelectionMode';
import {
  bulkDeleteSummary,
  formatItemList,
  runBulkDelete,
} from '@/lib/bulkDelete';
import { meshAlert, meshConfirmDestructive, meshError } from '@/lib/meshAlert';
import {
  buscarUsuariosAmistad,
  eliminarAmigo,
  listarAmigos,
  listarSolicitudesAmistadPendientes,
  solicitarAmistad,
  type AmigoApi,
  type RelacionAmistad,
  type UsuarioBusquedaAmistadApi,
} from '@/lib/amistadesApi';
import { coincideBusqueda, normalizarBusqueda } from '@/lib/busqueda';
import { setSolicitudesPendientesCount } from '@/lib/pendientesStore';
import { TarjetaAmigo, TarjetaAmigoEsqueleto } from '@/components/amigos/TarjetaAmigo';

/** Desde cuántas letras el buscador también busca otros usuarios en el servidor. */
const MIN_LETRAS_OTROS_USUARIOS = 2;

const PADDING_LISTA = 20;
const GAP_GRILLA = 10;
/** Ancho mínimo de cada cuadrado: define cuántas columnas entran (3 en un teléfono). */
const ANCHO_MIN_CELDA = 100;


type Props = {
  /** Título y pestañas de la pantalla: van dentro de la lista para que scrolleen con ella. */
  encabezado: () => ReactNode;
  /** Abre la pantalla de solicitudes (la misma de la campanita del `TopBar`). */
  onAbrirSolicitudes: () => void;
};

export function AmigosTabPanel({ encabezado, onAbrirSolicitudes }: Props) {
  const espacioTabBar = useEspacioTabBar()
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { backendUserId } = useAuth();
  const selection = useSelectionMode();
  const [amigos, setAmigos] = useState<AmigoApi[]>([]);
  const [cantidadSolicitudes, setCantidadSolicitudes] = useState(0);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<UsuarioBusquedaAmistadApi[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [solicitandoId, setSolicitandoId] = useState<string | null>(null);
  const [eliminandoBulk, setEliminandoBulk] = useState(false);
  const [relacionesLocales, setRelacionesLocales] = useState<Map<string, RelacionAmistad>>(
    new Map()
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yaCargoRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const listaRef = useRef<FlatList<AmigoApi>>(null);

  const columnas = Math.max(
    3,
    Math.floor((width - PADDING_LISTA * 2 + GAP_GRILLA) / (ANCHO_MIN_CELDA + GAP_GRILLA))
  );
  const anchoCelda = Math.floor(
    (width - PADDING_LISTA * 2 - GAP_GRILLA * (columnas - 1)) / columnas
  );

  useEffect(() => {
    if (!loading) setSolicitudesPendientesCount(cantidadSolicitudes);
  }, [cantidadSolicitudes, loading]);

  useFocusEffect(
    useCallback(() => {
      return () => selection.exit();
    }, [selection.exit])
  );

  const cargarDatos = useCallback(
    /** `refresh`: tirón de la lista. `silencioso`: al volver a la pantalla, sin indicador. */
    async (modo: 'inicial' | 'refresh' | 'silencioso' = 'inicial') => {
      const esRefresh = modo !== 'inicial';
      if (modo === 'refresh') setRefreshing(true);
      else if (modo === 'inicial') setLoading(true);

      try {
        const userId = resolveBackendUserId(backendUserId);
        const [listaAmigos, listaSolicitudes] = await Promise.all([
          listarAmigos(userId),
          listarSolicitudesAmistadPendientes(userId),
        ]);
        setAmigos(listaAmigos);
        setCantidadSolicitudes(listaSolicitudes.length);
      } catch (e: unknown) {
        if (!esRefresh) {
          meshError('Error', e instanceof Error ? e.message : 'No se pudieron cargar los datos.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [backendUserId]
  );

  // La primera vez muestra la carga de la grilla; al volver (p. ej. de aceptar
  // solicitudes en la pantalla de la campanita) refresca sin taparla.
  useFocusEffect(
    useCallback(() => {
      void cargarDatos(yaCargoRef.current ? 'silencioso' : 'inicial');
      yaCargoRef.current = true;
    }, [cargarDatos])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = busqueda.trim();
    if (q.length < MIN_LETRAS_OTROS_USUARIOS) {
      setResultadosBusqueda([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const userId = resolveBackendUserId(backendUserId);
          const resultados = await buscarUsuariosAmistad(q, userId);
          setResultadosBusqueda(resultados);
        } catch (e: unknown) {
          meshError('Error', e instanceof Error ? e.message : 'No se pudo buscar usuarios.');
        } finally {
          setBuscando(false);
        }
      })();
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busqueda, backendUserId]);

  const obtenerRelacion = (usuario: UsuarioBusquedaAmistadApi): RelacionAmistad => {
    return relacionesLocales.get(usuario.id) ?? usuario.relacion;
  };

  const ejecutarSolicitud = async (usuario: UsuarioBusquedaAmistadApi) => {
    setSolicitandoId(usuario.id);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await solicitarAmistad(usuario.id, userId);
      setRelacionesLocales((prev) => new Map(prev).set(usuario.id, 'solicitud_enviada'));
      setResultadosBusqueda((prev) =>
        prev.map((u) =>
          u.id === usuario.id ? { ...u, relacion: 'solicitud_enviada' as const } : u
        )
      );
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSolicitandoId(null);
    }
  };

  const consulta = normalizarBusqueda(busqueda);
  const buscaOtrosUsuarios = busqueda.trim().length >= MIN_LETRAS_OTROS_USUARIOS;
  const amigosVisibles = amigos.filter((a) => coincideBusqueda(consulta, [a.nombre, a.email]));
  // Los que ya son amigos aparecen arriba, en la grilla filtrada: acá no se repiten.
  const otrosUsuarios = resultadosBusqueda.filter((u) => obtenerRelacion(u) !== 'amigo');

  // Escribir sale del modo selección: así nunca queda seleccionado un amigo oculto.
  const cambiarBusqueda = (texto: string) => {
    selection.exit();
    setBusqueda(texto);
  };

  const abrirBuscador = () => {
    selection.exit();
    setBuscadorAbierto(true);
    listaRef.current?.scrollToOffset({ offset: 0, animated: true });
    // Espera a que el buscador se monte antes de enfocarlo.
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const amigosSeleccionados = amigos.filter((a) => selection.isSelected(a.id));
  const todosSeleccionados =
    amigosVisibles.length > 0 && amigosVisibles.every((a) => selection.isSelected(a.id));

  const toggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      selection.clear();
      return;
    }
    selection.selectAll(amigosVisibles.map((a) => a.id));
  };

  const confirmarEliminarSeleccionados = () => {
    if (selection.count === 0) return;

    const nombres = amigosSeleccionados.map((a) => a.nombre);
    const lista = formatItemList(nombres);

    meshConfirmDestructive({
      title: 'Eliminar amigos',
      message: `¿Querés eliminar a ${lista} de tu lista de amigos? Esta acción no se puede deshacer.`,
      confirmLabel: `Eliminar (${selection.count})`,
      onConfirm: () => void ejecutarEliminarBulk(),
    });
  };

  const ejecutarEliminarBulk = async () => {
    setEliminandoBulk(true);
    try {
      const userId = resolveBackendUserId(backendUserId);
      const items = amigosSeleccionados.map((a) => ({ id: a.id, label: a.nombre }));

      const result = await runBulkDelete(items, async (item) => {
        await eliminarAmigo(item.id, userId);
      });

      const idsOk = new Set(
        items.filter((i) => !result.failed.some((f) => f.id === i.id)).map((i) => i.id)
      );
      setAmigos((prev) => prev.filter((a) => !idsOk.has(a.id)));
      selection.exit();

      if (result.failed.length > 0) {
        meshAlert('Resultado parcial', bulkDeleteSummary(result, 'amigo'), [{ text: 'Entendido' }]);
      }
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo completar la eliminación.');
    } finally {
      setEliminandoBulk(false);
    }
  };

  const verPerfil = (usuarioId: string) => {
    router.push({ pathname: '/usuario/[usuarioId]', params: { usuarioId } });
  };

  const renderBotonAgregar = (usuario: UsuarioBusquedaAmistadApi) => {
    const relacion = obtenerRelacion(usuario);
    const solicitando = solicitandoId === usuario.id;

    if (relacion === 'amigo') return null;

    if (relacion === 'solicitud_recibida') {
      return (
        <Pressable
          style={[styles.botonAgregar, { borderColor: theme.accentLine }]}
          onPress={onAbrirSolicitudes}
        >
          <Text style={[styles.botonAgregarTexto, { color: theme.accent }]}>Responder</Text>
        </Pressable>
      );
    }

    const enviada = relacion === 'solicitud_enviada';

    return (
      <Pressable
        style={[
          styles.botonAgregar,
          { borderColor: theme.accentLine },
          (enviada || solicitando) && styles.botonDeshabilitado,
        ]}
        onPress={() => void ejecutarSolicitud(usuario)}
        disabled={enviada || solicitando}
      >
        {solicitando ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <Text style={[styles.botonAgregarTexto, { color: theme.accent }]}>
            {enviada ? 'Enviada' : 'Agregar'}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderCelda = ({ item }: { item: AmigoApi }) => (
    <TarjetaAmigo
      amigo={item}
      ancho={anchoCelda}
      selectionActive={selection.active}
      selected={selection.isSelected(item.id)}
      onEnterSelection={selection.enter}
      onToggle={selection.toggle}
      onPress={() => verPerfil(item.id)}
    />
  );

  // Los resultados del servidor tienen una acción por persona: se leen mejor en filas.
  const renderFilaBusqueda = (item: UsuarioBusquedaAmistadApi) => (
    <Pressable
      key={item.id}
      style={[styles.fila, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => verPerfil(item.id)}
    >
      <AvatarFallback nombre={item.nombre} usuarioId={item.id} />
      <View style={styles.filaContenido}>
        <Text style={[styles.nombre, { color: theme.text }]}>{item.nombre}</Text>
        <Text style={[styles.email, { color: theme.textDim }]}>{item.email}</Text>
      </View>
      {renderBotonAgregar(item)}
    </Pressable>
  );

  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void cargarDatos('refresh')}
      tintColor={theme.accent}
    />
  );

  const herramientas = (
    <HerramientasLista
      resumen={
        amigos.length === 0
          ? undefined
          : consulta
            ? `Mostrando ${amigosVisibles.length} de ${amigos.length}`
            : `${amigos.length} ${amigos.length === 1 ? 'amigo' : 'amigos'}`
      }
      acciones={
        <BotonSeleccionar
          visible={!selection.active && amigosVisibles.length > 0}
          onPress={() => selection.enter()}
        />
      }
      busqueda={{
        value: busqueda,
        onChangeText: cambiarBusqueda,
        placeholder: 'Buscar amigos o usuarios por nombre o email',
        accessibilityLabel: 'Buscar amigos o usuarios',
        maxLength: 60,
        inputRef,
        abierto: buscadorAbierto,
        onAbiertoChange: setBuscadorAbierto,
      }}
    />
  );

  // Encabezado de la pantalla + herramientas, de borde a borde (la lista tiene margen lateral).
  const cabecera = (
    <View style={styles.cabecera}>
      {encabezado()}
      {herramientas}
    </View>
  );

  const vacioBusqueda =
    consulta && amigos.length > 0 ? (
      <Text style={[styles.vacioCompacto, { color: theme.textMute }]}>
        Ninguno de tus amigos coincide con la búsqueda.
      </Text>
    ) : null;

  const pie = buscaOtrosUsuarios ? (
    <View style={styles.seccionOtros}>
      <Text style={[styles.eyebrow, { color: theme.textDim }]}>OTROS USUARIOS</Text>
      {buscando ? (
        <ActivityIndicator color={theme.accent} style={styles.cargandoOtros} />
      ) : otrosUsuarios.length === 0 ? (
        <Text style={[styles.vacioCompacto, { color: theme.textMute }]}>
          No se encontraron otros usuarios.
        </Text>
      ) : (
        otrosUsuarios.map(renderFilaBusqueda)
      )}
    </View>
  ) : consulta ? (
    <Text style={[styles.vacioCompacto, { color: theme.textMute }]}>
      Escribí al menos {MIN_LETRAS_OTROS_USUARIOS} letras para buscar otros usuarios.
    </Text>
  ) : amigos.length === 0 ? (
    <Text style={[styles.pista, { color: theme.textMute }]}>
      Buscá a tus compañeros por nombre o email y mandales una solicitud de amistad.
    </Text>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading ? (
        <View style={styles.lista}>
          {cabecera}
          <View style={[styles.filaGrilla, styles.filaEsqueleto]}>
            {Array.from({ length: columnas * 2 }, (_, i) => (
              <TarjetaAmigoEsqueleto key={i} ancho={anchoCelda} />
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listaRef}
          // Cambiar la cantidad de columnas exige montar la lista de nuevo.
          key={`grilla-${columnas}`}
          data={amigosVisibles}
          numColumns={columnas}
          keyExtractor={(item) => item.id}
          renderItem={renderCelda}
          columnWrapperStyle={styles.filaGrilla}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={
            <>
              {cabecera}
              <SelectionHeader
                visible={selection.active}
                allSelected={todosSeleccionados}
                onToggleAll={toggleSeleccionarTodos}
                onCancel={selection.exit}
              />
            </>
          }
          ListEmptyComponent={vacioBusqueda}
          ListFooterComponent={pie}
          contentContainerStyle={[
            styles.lista,
            { paddingBottom: espacioTabBar + (selection.active ? 88 : ESPACIO_BOTON_FLOTANTE) },
          ]}
          refreshControl={refresh}
        />
      )}

      <BotonFlotante
        icon="user-plus"
        label="Agregar amigo"
        onPress={abrirBuscador}
        visible={!selection.active}
        ayuda={AYUDA_GRUPOS[2]}
      />

      <SelectionActionBar
        visible={selection.active}
        count={selection.count}
        deleting={eliminandoBulk}
        onCancel={selection.exit}
        onDelete={confirmarEliminarSeleccionados}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { paddingHorizontal: PADDING_LISTA },
  // Compensa el padding de la lista: el encabezado va de borde a borde.
  cabecera: { marginHorizontal: -PADDING_LISTA, marginBottom: 4 },
  filaGrilla: { gap: GAP_GRILLA, marginBottom: GAP_GRILLA },
  filaEsqueleto: { flexDirection: 'row', flexWrap: 'wrap' },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  seccionOtros: { marginTop: 14, gap: 10 },
  cargandoOtros: { marginVertical: 16 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
    gap: 12,
  },
  filaContenido: { flex: 1, gap: 2 },
  nombre: { fontSize: 16, fontWeight: '600' },
  email: { fontSize: 13 },
  botonAgregar: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    minWidth: 92,
    alignItems: 'center',
  },
  botonAgregarTexto: { fontSize: 12.5, fontWeight: '700' },
  botonDeshabilitado: { opacity: 0.5 },
  vacioCompacto: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginVertical: 12 },
  pista: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
});
