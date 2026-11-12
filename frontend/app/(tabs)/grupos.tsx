import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  crearGrupo,
  eliminarGrupo,
  listarGrupos,
  listarInvitacionesPendientes,
  type GrupoListItemApi,
  type InvitacionPendienteApi,
} from '@/lib/gruposApi';
import { Btn, Field, TopBar, useTheme } from '@/components/MeshUI';
import { useCopilot } from 'react-native-copilot';
import { PasoAyuda } from '@/components/ayuda/PasoAyuda';
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda'
import { AYUDA_GRUPOS } from '@/components/ayuda/contenidoAyuda';
import { SelectionActionBar } from '@/components/SelectionActionBar';
import { BotonSeleccionar, SelectionHeader } from '@/components/SelectionHeader';
import { useSelectionMode } from '@/hooks/useSelectionMode';
import {
  bulkDeleteSummary,
  formatItemList,
  runBulkDelete,
} from '@/lib/bulkDelete';
import { meshAlert, meshConfirmDestructive, meshError, meshWarning } from '@/lib/meshAlert';
import { SegmentTabs } from '@/components/SegmentTabs';
import { HerramientasLista } from '@/components/BarraFiltros';
import { FranjaEstado } from '@/components/FranjaEstado';
import { BotonFlotante, ESPACIO_BOTON_FLOTANTE } from '@/components/BotonFlotante';
import { AmigosTabPanel } from '@/components/tabs/AmigosTabPanel';
import { coincideBusqueda, normalizarBusqueda } from '@/lib/busqueda';
import { setInvitacionesPendientesCount, usePendientes } from '@/lib/pendientesStore';
import { CampanitaNotificaciones } from '@/components/notificaciones/CampanitaNotificaciones';
import { HojaInferior } from '@/components/HojaInferior';
import { EstadoVacio } from '@/components/EstadoVacio';
import {
  TarjetaGrupo,
  TarjetaGrupoEsqueleto,
  ordenarGrupos,
} from '@/components/grupos/TarjetaGrupo';

type SeccionGruposAmigos = 'grupos' | 'amigos';

const abrirInvitaciones = () => router.push('/grupo/invitaciones');
const abrirSolicitudes = () => router.push('/amigos/solicitudes');

export default function GruposScreen() {
  const espacioTabBar = useEspacioTabBar()
  const { tab, abrir } = useLocalSearchParams<{ tab?: string; abrir?: string }>();
  const { backendUserId, backendSyncing } = useAuth();
  const theme = useTheme();
  const { start } = useCopilot();
  const selection = useSelectionMode();
  const pendientes = usePendientes();
  const [seccion, setSeccion] = useState<SeccionGruposAmigos>(tab === 'amigos' ? 'amigos' : 'grupos');

  useEffect(() => {
    if (tab === 'amigos') setSeccion('amigos');
    if (tab === 'grupos') setSeccion('grupos');
    // Desde una notificación push: abrir directo la pantalla de la campanita que corresponde.
    if (abrir === 'notificaciones') {
      router.setParams({ abrir: undefined });
      if (tab === 'amigos') abrirSolicitudes();
      else abrirInvitaciones();
    }
  }, [tab, abrir]);

  const [grupos, setGrupos] = useState<GrupoListItemApi[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionPendienteApi[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creandoAbierto, setCreandoAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [eliminandoBulk, setEliminandoBulk] = useState(false);

  useEffect(() => {
    if (!cargandoLista) setInvitacionesPendientesCount(invitaciones.length);
  }, [invitaciones, cargandoLista]);

  useFocusEffect(
    useCallback(() => {
      return () => selection.exit();
    }, [selection.exit])
  );

  const [busqueda, setBusqueda] = useState('');

  // Cambiar la búsqueda sale del modo selección: así nunca queda seleccionado un grupo oculto.
  const cambiarBusqueda = (texto: string) => {
    selection.exit();
    setBusqueda(texto);
  };

  const consulta = normalizarBusqueda(busqueda);
  const gruposVisibles = ordenarGrupos(
    grupos.filter((g) => coincideBusqueda(consulta, [g.nombre]))
  );

  const gruposEliminables = gruposVisibles.filter((g) => g.mi_rol === 'lider');
  const gruposSeleccionados = grupos.filter((g) => selection.isSelected(g.id));
  const todosSeleccionados =
    gruposEliminables.length > 0 &&
    gruposEliminables.every((g) => selection.isSelected(g.id));

  const toggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      selection.clear();
      return;
    }
    selection.selectAll(gruposEliminables.map((g) => g.id));
  };

  const confirmarEliminarSeleccionados = () => {
    if (selection.count === 0) return;

    const nombres = gruposSeleccionados.map((g) => g.nombre);
    meshConfirmDestructive({
      title: 'Eliminar grupos',
      message: `¿Eliminar definitivamente ${selection.count === 1 ? 'este grupo' : `estos ${selection.count} grupos`} (${formatItemList(nombres)})? Se perderán invitaciones pendientes. Esta acción no se puede deshacer.`,
      confirmLabel: `Eliminar (${selection.count})`,
      onConfirm: () => void ejecutarEliminarBulk(),
    });
  };

  const ejecutarEliminarBulk = async () => {
    setEliminandoBulk(true);
    try {
      const userId = resolveBackendUserId(backendUserId);
      const items = gruposSeleccionados.map((g) => ({ id: g.id, label: g.nombre }));

      const result = await runBulkDelete(items, async (item) => {
        await eliminarGrupo(item.id, userId);
      });

      const idsOk = new Set(
        items.filter((i) => !result.failed.some((f) => f.id === i.id)).map((i) => i.id)
      );
      setGrupos((prev) => prev.filter((g) => !idsOk.has(g.id)));
      selection.exit();

      if (result.failed.length > 0) {
        meshAlert('Resultado parcial', bulkDeleteSummary(result, 'grupo'), [{ text: 'Entendido' }]);
      }
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo completar la eliminación.');
    } finally {
      setEliminandoBulk(false);
    }
  };

  const cargarGrupos = useCallback(async (esRefresh = false) => {
    if (backendSyncing) return;

    let userId: string;
    try {
      userId = resolveBackendUserId(backendUserId);
    } catch {
      setGrupos([]);
      setInvitaciones([]);
      setCargandoLista(false);
      setRefreshing(false);
      return;
    }

    if (esRefresh) setRefreshing(true);
    else setCargandoLista(true);

    try {
      const [data, pendientesApi] = await Promise.all([
        listarGrupos(userId),
        listarInvitacionesPendientes(userId),
      ]);
      setGrupos(data);
      setInvitaciones(pendientesApi);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los grupos.';
      if (!esRefresh) {
        meshError('Error', msg);
      }
    } finally {
      setCargandoLista(false);
      setRefreshing(false);
    }
  }, [backendUserId, backendSyncing]);

  useFocusEffect(
    useCallback(() => {
      void cargarGrupos();
    }, [cargarGrupos])
  );

  const cerrarCrear = () => {
    if (loading) return;
    setCreandoAbierto(false);
    setNombre('');
  };

  const handleCrear = async () => {
    if (!nombre.trim()) {
      meshWarning('Campo requerido', 'El nombre del grupo es obligatorio.');
      return;
    }

    let userId: string;
    try {
      userId = resolveBackendUserId(backendUserId);
    } catch {
      meshError('Error', 'No se pudo identificar tu usuario. Volvé a iniciar sesión.');
      return;
    }

    setLoading(true);
    try {
      const grupo = await crearGrupo(nombre.trim(), userId);
      setNombre('');
      setCreandoAbierto(false);
      void cargarGrupos(true);
      router.push({ pathname: '/grupo/[grupoId]', params: { grupoId: grupo.id } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      const esRed = msg.includes('Network') || msg.includes('Failed to fetch');
      meshError(
        'Error',
        esRed || !msg
          ? 'Hubo un error al crear el grupo. Inténtalo más tarde.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  if (backendSyncing) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={[styles.hint, { color: theme.textDim }]}>Sincronizando usuario…</Text>
      </View>
    );
  }

  if (!backendUserId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.titulo, { color: theme.text }]}>Sin conexión al servidor</Text>
        <Text style={[styles.subtitulo, { color: theme.textDim }]}>
          No pudimos sincronizar tu usuario con la base de datos. Cerrá sesión e iniciá de nuevo con
          el backend corriendo en tu PC.
        </Text>
      </View>
    );
  }

  const campanita =
    seccion === 'grupos' ? (
      <CampanitaNotificaciones
        pendientes={pendientes.invitaciones}
        etiqueta="Invitaciones a grupos"
        onPress={abrirInvitaciones}
      />
    ) : (
      <CampanitaNotificaciones
        pendientes={pendientes.solicitudes}
        etiqueta="Solicitudes de amistad"
        onPress={abrirSolicitudes}
      />
    );

  // Encabezado y pestañas van dentro del scroll de cada sección: nada queda fijo.
  // Crear un grupo o agregar un amigo es el botón flotante de cada pestaña.
  const crearEncabezado = () => (
    <>
      <TopBar
        title="Social"
        raiz
        bordered={false}
        right={campanita}
        onAyuda={() => start()}
      />
      <PasoAyuda {...AYUDA_GRUPOS[0]!}>
        <View style={styles.segmentWrap}>
          <SegmentTabs
            tabs={[
              // El punto avisa de pendientes en la otra pestaña, cuya campanita no está a la vista.
              { key: 'grupos', label: 'Grupos', dot: seccion !== 'grupos' && pendientes.invitaciones > 0 },
              { key: 'amigos', label: 'Amigos', dot: seccion !== 'amigos' && pendientes.solicitudes > 0 },
            ]}
            active={seccion}
            onChange={(key) => {
              selection.exit();
              setSeccion(key as SeccionGruposAmigos);
            }}
            theme={theme}
          />
        </View>
      </PasoAyuda>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {seccion === 'amigos' ? (
        <AmigosTabPanel encabezado={crearEncabezado} onAbrirSolicitudes={abrirSolicitudes} />
      ) : (
    <View style={styles.flex}>
      <ScrollViewAyuda
        contentContainerStyle={{ paddingBottom: espacioTabBar + ESPACIO_BOTON_FLOTANTE }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargarGrupos(true)}
            tintColor={theme.accent}
          />
        }
      >
        {crearEncabezado()}

        {grupos.length > 0 ? (
          <HerramientasLista
            resumen={
              consulta
                ? `Mostrando ${gruposVisibles.length} de ${grupos.length}`
                : `${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'}`
            }
            acciones={
              <BotonSeleccionar
                visible={!selection.active && gruposEliminables.length > 0}
                onPress={() => selection.enter()}
              />
            }
            busqueda={{
              value: busqueda,
              onChangeText: cambiarBusqueda,
              placeholder: 'Buscar por nombre...',
              accessibilityLabel: 'Buscar grupos',
              maxLength: 60,
            }}
          />
        ) : null}

        <View style={styles.inner}>
          {cargandoLista ? (
            <View style={styles.lista}>
              <TarjetaGrupoEsqueleto />
              <TarjetaGrupoEsqueleto />
              <TarjetaGrupoEsqueleto />
            </View>
          ) : grupos.length === 0 ? (
            invitaciones.length > 0 ? (
              <EstadoVacio
                icono="mail"
                titulo="Te invitaron a un grupo"
                texto={`Tenés ${invitaciones.length === 1 ? 'una invitación pendiente' : `${invitaciones.length} invitaciones pendientes`}. Aceptala para empezar a coordinar viajes.`}
                accion={{ label: 'Ver invitaciones', onPress: abrirInvitaciones }}
              />
            ) : (
              <EstadoVacio
                icono="users"
                titulo="Armá tu primer grupo"
                texto="Juntá a la gente con la que salís para coordinar viajes en tiempo real."
                accion={{ label: 'Crear grupo', onPress: () => setCreandoAbierto(true) }}
              />
            )
          ) : (
            <View style={styles.seccionGrupos}>
              <SelectionHeader
                visible={selection.active}
                allSelected={todosSeleccionados}
                onToggleAll={toggleSeleccionarTodos}
                onCancel={selection.exit}
              />

              {gruposVisibles.length === 0 ? (
                <EstadoVacio
                  compacto
                  icono="search"
                  titulo="Sin resultados"
                  texto={`Ningún grupo coincide con "${busqueda.trim()}".`}
                />
              ) : (
                <PasoAyuda {...AYUDA_GRUPOS[1]!}>
                <View style={[styles.lista, selection.active && styles.listaConBarra]}>
                  {gruposVisibles.map((g) => (
                    <TarjetaGrupo
                      key={g.id}
                      grupo={g}
                      selectionActive={selection.active}
                      selected={selection.isSelected(g.id)}
                      onEnterSelection={selection.enter}
                      onToggle={selection.toggle}
                      onDisabledPress={() =>
                        meshWarning(
                          'No podés eliminar este grupo',
                          'Solo el líder puede eliminar el grupo. Podés abandonarlo desde Ajustes del grupo.'
                        )
                      }
                    />
                  ))}
                </View>
                </PasoAyuda>
              )}
            </View>
          )}
        </View>
      </ScrollViewAyuda>

      <BotonFlotante
        icon="plus"
        label="Crear grupo"
        onPress={() => setCreandoAbierto(true)}
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
      )}

      <FranjaEstado />

      <HojaInferior
        visible={creandoAbierto}
        titulo="Nuevo grupo"
        subtitulo="Creá tu grupo para organizar salidas y coordinar en tiempo real."
        onCerrar={cerrarCrear}
      >
        <Field
          label="Nombre del grupo *"
          placeholder="Ej: Trail Riders Córdoba"
          placeholderTextColor={theme.textMute}
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="words"
          autoFocus
          maxLength={80}
          editable={!loading}
          onSubmitEditing={() => void handleCrear()}
          returnKeyType="done"
        />
        <View style={styles.formActions}>
          <Btn variant="primary" size="lg" block onPress={handleCrear} loading={loading}>
            Crear grupo
          </Btn>
        </View>
      </HojaInferior>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  segmentWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  inner: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  hint: {
    fontSize: 14.5,
  },
  formActions: {
    marginTop: 6,
  },
  lista: {
    gap: 11,
  },
  listaConBarra: {
    paddingBottom: 88,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitulo: {
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  seccionGrupos: {
    gap: 12,
  },
});
