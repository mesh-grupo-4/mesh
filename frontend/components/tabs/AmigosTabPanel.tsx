import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Pressable } from '@/components/Pressable';
import { SELECCION_CON_PULSACION_LARGA } from '@/lib/plataforma';
import { useFocusEffect, useRouter } from 'expo-router';
import { AvatarFallback } from '@/components/AvatarFallback';
import {
  BarraFiltros,
  BuscadorFiltros,
  ChipFiltro,
  FilaChipsFiltro,
} from '@/components/BarraFiltros';
import { SelectableCard } from '@/components/SelectableCard';
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

type TabAmigos = 'amigos' | 'solicitudes';

/** Desde cuántas letras el buscador también busca otros usuarios en el servidor. */
const MIN_LETRAS_OTROS_USUARIOS = 2;

export function AmigosTabPanel() {
  const espacioTabBar = useEspacioTabBar()
  const theme = useTheme();
  const router = useRouter();
  const { backendUserId } = useAuth();
  const selection = useSelectionMode();
  const [tab, setTab] = useState<TabAmigos>('amigos');
  const [amigos, setAmigos] = useState<AmigoApi[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudAmistadPendienteApi[]>([]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<UsuarioBusquedaAmistadApi[]>([]);
  const [busqueda, setBusqueda] = useState('');
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Los otros usuarios solo se buscan en "Mis amigos"; en Solicitudes el buscador filtra local.
    const q = busqueda.trim();
    if (tab !== 'amigos' || q.length < MIN_LETRAS_OTROS_USUARIOS) {
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
  }, [busqueda, backendUserId, tab]);

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
  const buscaOtrosUsuarios =
    tab === 'amigos' && busqueda.trim().length >= MIN_LETRAS_OTROS_USUARIOS;
  const amigosVisibles = amigos.filter((a) => coincideBusqueda(consulta, [a.nombre, a.email]));
  const solicitudesVisibles = solicitudes.filter((s) =>
    coincideBusqueda(consulta, [s.solicitante.nombre, s.solicitante.email])
  );
  // Los que ya son amigos aparecen arriba, en la lista filtrada: acá no se repiten.
  const otrosUsuarios = resultadosBusqueda.filter((u) => obtenerRelacion(u) !== 'amigo');

  // Escribir o cambiar de chip sale del modo selección: así nunca queda seleccionado un amigo oculto.
  const cambiarBusqueda = (texto: string) => {
    selection.exit();
    setBusqueda(texto);
  };
  const cambiarTab = (nuevo: TabAmigos) => {
    selection.exit();
    setTab(nuevo);
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
      setSolicitudes((prev) => prev.filter((s) => s.id !== solicitudId));

      if (accion === 'aceptar') {
        await cargarDatos(true);
      }
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo responder la solicitud.');
    } finally {
      setRespondiendoId(null);
    }
  };

  const renderBotonAgregar = (usuario: UsuarioBusquedaAmistadApi) => {
    const relacion = obtenerRelacion(usuario);
    const solicitando = solicitandoId === usuario.id;

    if (relacion === 'amigo') return null;

    if (relacion === 'solicitud_recibida') {
      return <Text style={[styles.hintRelacion, { color: theme.textDim }]}>Respondé en Solicitudes</Text>;
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
            {enviada ? 'Solicitud enviada' : 'Agregar'}
          </Text>
        )}
      </Pressable>
    );
  };

  const verPerfil = (usuarioId: string) => {
    router.push({ pathname: '/usuario/[usuarioId]', params: { usuarioId } });
  };

  const renderFilaAmigo = ({ item }: { item: AmigoApi }) => (
    <SelectableCard
      itemId={item.id}
      selectionActive={selection.active}
      selected={selection.isSelected(item.id)}
      onEnterSelection={selection.enter}
      onToggle={selection.toggle}
      onPress={() => verPerfil(item.id)}
      style={[styles.fila, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <AvatarFallback nombre={item.nombre} />
      <View style={styles.filaContenido}>
        <Text style={[styles.nombre, { color: theme.text }]}>{item.nombre}</Text>
        <Text style={[styles.email, { color: theme.textDim }]}>{item.email}</Text>
      </View>
    </SelectableCard>
  );

  const renderFilaBusqueda = (item: UsuarioBusquedaAmistadApi) => (
    <Pressable
      key={item.id}
      style={[styles.fila, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => verPerfil(item.id)}
    >
      <AvatarFallback nombre={item.nombre} />
      <View style={styles.filaContenido}>
        <Text style={[styles.nombre, { color: theme.text }]}>{item.nombre}</Text>
        <Text style={[styles.email, { color: theme.textDim }]}>{item.email}</Text>
      </View>
      {renderBotonAgregar(item)}
    </Pressable>
  );

  const renderSolicitud = ({ item }: { item: SolicitudAmistadPendienteApi }) => {
    const procesando = respondiendoId === item.id;

    return (
      <View style={[styles.tarjetaSolicitud, { backgroundColor: theme.surface, borderColor: theme.accentLine }]}>
        <Pressable
          style={styles.filaSolicitud}
          onPress={() => verPerfil(item.solicitante.id)}
        >
          <AvatarFallback nombre={item.solicitante.nombre} />
          <View style={styles.filaContenido}>
            <Text style={[styles.nombre, { color: theme.text }]}>{item.solicitante.nombre}</Text>
            <Text style={[styles.email, { color: theme.textDim }]}>{item.solicitante.email}</Text>
            <Text style={[styles.hintRelacion, { color: theme.textDim }]}>Quiere agregarte como amigo</Text>
          </View>
        </Pressable>
        <View style={styles.accionesSolicitud}>
          <Pressable
            style={[styles.botonAceptar, { backgroundColor: theme.accent }, procesando && styles.botonDeshabilitado]}
            onPress={() => void ejecutarRespuesta(item.id, 'aceptar')}
            disabled={procesando}
          >
            {procesando ? (
              <ActivityIndicator color={theme.onAccent} size="small" />
            ) : (
              <Text style={[styles.botonAceptarTexto, { color: theme.onAccent }]}>Aceptar</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.botonRechazar, { borderColor: theme.borderStrong }, procesando && styles.botonDeshabilitado]}
            onPress={() => void ejecutarRespuesta(item.id, 'rechazar')}
            disabled={procesando}
          >
            <Text style={[styles.botonRechazarTexto, { color: theme.textDim }]}>Rechazar</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void cargarDatos(true)}
      tintColor={theme.accent}
    />
  );

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

  const vacioAmigos = !consulta ? (
    <Text style={[styles.vacio, { color: theme.textMute }]}>
      No tenés amigos todavía. Buscá usuarios por nombre o email y enviá solicitudes de amistad.
      {SELECCION_CON_PULSACION_LARGA
        ? '\n\nMantené apretado un contacto para seleccionar y eliminar.'
        : ''}
    </Text>
  ) : amigos.length > 0 ? (
    <Text style={[styles.vacioCompacto, { color: theme.textMute }]}>
      Ninguno de tus amigos coincide con la búsqueda.
    </Text>
  ) : null;

  // Resultados del servidor para agregar gente nueva, debajo de los amigos filtrados.
  const seccionOtrosUsuarios = buscaOtrosUsuarios ? (
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
  ) : null;

  // Búsqueda y filtros van como encabezado de la lista: scrollean con ella y le dejan más lugar.
  const barraFiltros = (
    <View style={styles.barraEnLista}>
      <BarraFiltros>
        <BuscadorFiltros
          value={busqueda}
          onChangeText={cambiarBusqueda}
          placeholder={
            tab === 'amigos' ? 'Buscar amigos o usuarios por nombre o email' : 'Buscar por nombre o email'
          }
          accessibilityLabel={tab === 'amigos' ? 'Buscar amigos o usuarios' : 'Buscar solicitudes'}
          maxLength={60}
        />
        <FilaChipsFiltro>
          <ChipFiltro
            label="Mis amigos"
            activo={tab === 'amigos'}
            onPress={() => cambiarTab('amigos')}
          />
          <ChipFiltro
            label={`Solicitudes${solicitudes.length > 0 ? ` (${solicitudes.length})` : ''}`}
            activo={tab === 'solicitudes'}
            onPress={() => cambiarTab('solicitudes')}
          />
        </FilaChipsFiltro>
      </BarraFiltros>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading ? (
        <View style={styles.lista}>
          {barraFiltros}
          <ActivityIndicator color={theme.accent} size="large" style={styles.centrado} />
        </View>
      ) : tab === 'amigos' ? (
        <FlatList
          data={amigosVisibles}
          keyExtractor={(item) => item.id}
          renderItem={renderFilaAmigo}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={
            <>
              {barraFiltros}
              {encabezadoAmigos}
            </>
          }
          ListEmptyComponent={vacioAmigos}
          ListFooterComponent={seccionOtrosUsuarios}
          contentContainerStyle={[
            styles.lista,
            { paddingBottom: espacioTabBar + (selection.active ? 88 : 0) },
          ]}
          refreshControl={refresh}
        />
      ) : (
        <FlatList
          data={solicitudesVisibles}
          keyExtractor={(item) => item.id}
          renderItem={renderSolicitud}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={barraFiltros}
          contentContainerStyle={[
            styles.lista,
            { paddingBottom: espacioTabBar },
          ]}
          ListEmptyComponent={
            <Text style={[styles.vacio, { color: theme.textMute }]}>
              {consulta && solicitudes.length > 0
                ? 'Ninguna solicitud coincide con la búsqueda.'
                : 'No tenés solicitudes pendientes.'}
            </Text>
          }
          refreshControl={refresh}
        />
      )}

      <SelectionActionBar
        visible={selection.active && tab === 'amigos'}
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
  lista: { paddingHorizontal: 20, paddingTop: 12 },
  // Compensa el padding de la lista: la barra va de borde a borde.
  barraEnLista: { marginHorizontal: -20, marginTop: -12, marginBottom: 12 },
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
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
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
    minWidth: 120,
    alignItems: 'center',
  },
  botonAgregarTexto: { fontSize: 12, fontWeight: '600' },
  botonDeshabilitado: { opacity: 0.5 },
  hintRelacion: { fontSize: 12, fontStyle: 'italic' },
  tarjetaSolicitud: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  filaSolicitud: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accionesSolicitud: { flexDirection: 'row', gap: 10 },
  botonAceptar: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  botonAceptarTexto: { fontSize: 14, fontWeight: '600' },
  botonRechazar: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  botonRechazarTexto: { fontSize: 14, fontWeight: '600' },
  centrado: { marginTop: 48 },
  vacio: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 36 },
  vacioCompacto: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginVertical: 12 },
});
