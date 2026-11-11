import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Feather } from '@expo/vector-icons';
import { Pressable } from '@/components/Pressable';
import { useFocusEffect, useRouter } from 'expo-router';
import { AvatarFallback } from '@/components/AvatarFallback';
import { BarraFiltros, BuscadorFiltros } from '@/components/BarraFiltros';
import { SelectionActionBar } from '@/components/SelectionActionBar';
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
  responderSolicitudAmistad,
  solicitarAmistad,
  type AmigoApi,
  type RelacionAmistad,
  type SolicitudAmistadPendienteApi,
  type UsuarioBusquedaAmistadApi,
} from '@/lib/amistadesApi';
import { coincideBusqueda, normalizarBusqueda } from '@/lib/busqueda';
import { setSolicitudesPendientesCount } from '@/lib/pendientesStore';
import { formatearHaceCuanto } from '@/lib/tiempoArg';
import { vibrarExito, vibrarSuave } from '@/lib/haptica';
import { HojaInferior } from '@/components/HojaInferior';
import { EstadoVacio } from '@/components/EstadoVacio';
import { Destacado, FilaNotificacion } from '@/components/notificaciones/FilaNotificacion';
import {
  TarjetaAgregarAmigo,
  TarjetaAmigo,
  TarjetaAmigoEsqueleto,
} from '@/components/amigos/TarjetaAmigo';

/** Desde cuántas letras el buscador también busca otros usuarios en el servidor. */
const MIN_LETRAS_OTROS_USUARIOS = 2;

/** Con pocos amigos el buscador queda oculto hasta tocar "Agregar amigo". */
const UMBRAL_BUSCADOR = 6;

const PADDING_LISTA = 20;
const GAP_GRILLA = 10;
/** Ancho mínimo de cada cuadrado: define cuántas columnas entran (3 en un teléfono). */
const ANCHO_MIN_CELDA = 100;

const CELDA_AGREGAR = '__agregar__';
type CeldaGrilla = AmigoApi | { id: typeof CELDA_AGREGAR };

type Props = {
  /** La campanita vive en el `TopBar` de la pantalla; el panel solo abre y cierra la hoja. */
  solicitudesAbiertas: boolean;
  onCerrarSolicitudes: () => void;
  onAbrirSolicitudes: () => void;
};

export function AmigosTabPanel({ solicitudesAbiertas, onCerrarSolicitudes, onAbrirSolicitudes }: Props) {
  const espacioTabBar = useEspacioTabBar()
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { backendUserId } = useAuth();
  const selection = useSelectionMode();
  const [amigos, setAmigos] = useState<AmigoApi[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudAmistadPendienteApi[]>([]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<UsuarioBusquedaAmistadApi[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [solicitandoId, setSolicitandoId] = useState<string | null>(null);
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null);
  const [eliminandoBulk, setEliminandoBulk] = useState(false);
  const [relacionesLocales, setRelacionesLocales] = useState<Map<string, RelacionAmistad>>(
    new Map()
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const listaRef = useRef<FlatList<CeldaGrilla>>(null);

  const columnas = Math.max(
    3,
    Math.floor((width - PADDING_LISTA * 2 + GAP_GRILLA) / (ANCHO_MIN_CELDA + GAP_GRILLA))
  );
  const anchoCelda = Math.floor(
    (width - PADDING_LISTA * 2 - GAP_GRILLA * (columnas - 1)) / columnas
  );

  useEffect(() => {
    if (!loading) setSolicitudesPendientesCount(solicitudes.length);
  }, [solicitudes, loading]);

  useFocusEffect(
    useCallback(() => {
      return () => selection.exit();
    }, [selection.exit])
  );

  const cargarDatos = useCallback(
    async (esRefresh = false) => {
      if (esRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const userId = resolveBackendUserId(backendUserId);
        const [listaAmigos, listaSolicitudes] = await Promise.all([
          listarAmigos(userId),
          listarSolicitudesAmistadPendientes(userId),
        ]);
        setAmigos(listaAmigos);
        setSolicitudes(listaSolicitudes);
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

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  // Al abrir la campanita: trae las solicitudes nuevas sin mostrar la carga de la grilla.
  useEffect(() => {
    if (!solicitudesAbiertas) return;
    try {
      const userId = resolveBackendUserId(backendUserId);
      void listarSolicitudesAmistadPendientes(userId)
        .then(setSolicitudes)
        .catch(() => {});
    } catch {
      // Sin usuario no hay nada que refrescar: queda la lista que ya estaba.
    }
  }, [solicitudesAbiertas, backendUserId]);

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
  const mostrarBuscador = amigos.length >= UMBRAL_BUSCADOR || buscadorAbierto || busqueda.length > 0;
  const buscaOtrosUsuarios = busqueda.trim().length >= MIN_LETRAS_OTROS_USUARIOS;
  const amigosVisibles = amigos.filter((a) => coincideBusqueda(consulta, [a.nombre, a.email]));
  // Los que ya son amigos aparecen arriba, en la grilla filtrada: acá no se repiten.
  const otrosUsuarios = resultadosBusqueda.filter((u) => obtenerRelacion(u) !== 'amigo');
  // La celda "Agregar amigo" sobra mientras se busca o se selecciona.
  const celdas: CeldaGrilla[] =
    consulta || selection.active ? amigosVisibles : [{ id: CELDA_AGREGAR }, ...amigosVisibles];

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

  const ejecutarRespuesta = async (solicitudId: string, accion: 'aceptar' | 'rechazar') => {
    setRespondiendoId(solicitudId);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await responderSolicitudAmistad(solicitudId, accion, userId);
      const restantes = solicitudes.filter((s) => s.id !== solicitudId);
      setSolicitudes(restantes);

      if (accion === 'aceptar') {
        vibrarExito();
        void cargarDatos(true);
      } else {
        vibrarSuave();
      }
      // Deja ver el fundido del último ítem antes de cerrar.
      if (restantes.length === 0) setTimeout(onCerrarSolicitudes, 250);
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo responder la solicitud.');
    } finally {
      setRespondiendoId(null);
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

  const renderCelda = ({ item }: { item: CeldaGrilla }) =>
    item.id === CELDA_AGREGAR ? (
      <TarjetaAgregarAmigo ancho={anchoCelda} onPress={abrirBuscador} />
    ) : (
      <TarjetaAmigo
        amigo={item as AmigoApi}
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
      onRefresh={() => void cargarDatos(true)}
      tintColor={theme.accent}
    />
  );

  const barraFiltros = mostrarBuscador ? (
    <View style={styles.barraEnLista}>
      <BarraFiltros>
        <BuscadorFiltros
          inputRef={inputRef}
          value={busqueda}
          onChangeText={cambiarBusqueda}
          placeholder="Buscar amigos o usuarios por nombre o email"
          accessibilityLabel="Buscar amigos o usuarios"
          maxLength={60}
        />
      </BarraFiltros>
    </View>
  ) : null;

  const encabezadoAmigos =
    amigos.length > 0 ? (
      <View>
        <View style={styles.encabezadoFila}>
          <Text style={[styles.eyebrow, { color: theme.textDim }]}>
            TUS AMIGOS ({amigosVisibles.length})
          </Text>
          <BotonSeleccionar
            visible={!selection.active && amigosVisibles.length > 0}
            onPress={() => selection.enter()}
          />
        </View>
        <SelectionHeader
          visible={selection.active}
          allSelected={todosSeleccionados}
          onToggleAll={toggleSeleccionarTodos}
          onCancel={selection.exit}
        />
      </View>
    ) : null;

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
          data={celdas}
          numColumns={columnas}
          keyExtractor={(item) => item.id}
          renderItem={renderCelda}
          columnWrapperStyle={styles.filaGrilla}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={
            <>
              {barraFiltros}
              {encabezadoAmigos}
            </>
          }
          ListEmptyComponent={vacioBusqueda}
          ListFooterComponent={pie}
          contentContainerStyle={[
            styles.lista,
            { paddingBottom: espacioTabBar + 74 + (selection.active ? 88 : 0) },
          ]}
          refreshControl={refresh}
        />
      )}

      {!selection.active && (
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            {
              bottom: espacioTabBar,
              backgroundColor: theme.accent,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
          onPress={abrirBuscador}
        >
          <Feather name="user-plus" size={19} color={theme.onAccent} />
          <Text style={[styles.fabText, { color: theme.onAccent }]}>Agregar amigo</Text>
        </Pressable>
      )}

      <SelectionActionBar
        visible={selection.active}
        count={selection.count}
        deleting={eliminandoBulk}
        onCancel={selection.exit}
        onDelete={confirmarEliminarSeleccionados}
      />

      <HojaInferior
        visible={solicitudesAbiertas}
        titulo="Solicitudes de amistad"
        onCerrar={onCerrarSolicitudes}
      >
        {solicitudes.length === 0 ? (
          <EstadoVacio
            compacto
            icono="check"
            titulo="Estás al día"
            texto="Cuando alguien quiera sumarte como amigo, lo vas a ver acá."
          />
        ) : (
          solicitudes.map((s) => (
            <FilaNotificacion
              key={s.id}
              nombre={s.solicitante.nombre}
              usuarioId={s.solicitante.id}
              mensaje={
                <>
                  <Destacado>{s.solicitante.nombre}</Destacado> quiere agregarte como amigo
                </>
              }
              meta={formatearHaceCuanto(s.created_at)}
              etiquetaAceptar="Aceptar"
              procesando={respondiendoId === s.id}
              onAceptar={() => void ejecutarRespuesta(s.id, 'aceptar')}
              onRechazar={() => void ejecutarRespuesta(s.id, 'rechazar')}
              onPressAvatar={() => {
                onCerrarSolicitudes();
                verPerfil(s.solicitante.id);
              }}
            />
          ))
        )}
      </HojaInferior>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { paddingHorizontal: PADDING_LISTA, paddingTop: 12 },
  // Compensa el padding de la lista: la barra va de borde a borde.
  barraEnLista: { marginHorizontal: -PADDING_LISTA, marginTop: -12, marginBottom: 12 },
  filaGrilla: { gap: GAP_GRILLA, marginBottom: GAP_GRILLA },
  filaEsqueleto: { flexDirection: 'row', flexWrap: 'wrap' },
  encabezadoFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    minHeight: 24,
  },
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
  fab: {
    position: 'absolute',
    right: 20,
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    gap: 8,
  },
  fabText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});
