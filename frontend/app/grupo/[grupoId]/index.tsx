import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCopilot } from 'react-native-copilot';
import { Pressable } from '@/components/Pressable';
import { meshAlert } from '@/lib/meshAlert';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  abandonarGrupo,
  eliminarGrupo,
  listarMiembrosGrupo,
  obtenerGrupo,
  type GrupoDetalleApi,
  type GrupoMiembroApi,
} from '@/lib/gruposApi';
import { TransferirLiderazgoModal } from '@/components/TransferirLiderazgoModal';
import { formatearEnArg } from '@/lib/tiempoArg';
import { Btn, TopBar, useTheme } from '@/components/MeshUI';
import { Esqueleto } from '@/components/Esqueleto';
import { PasoAyuda } from '@/components/ayuda/PasoAyuda';
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda';
import { AYUDA_GRUPO_DETALLE } from '@/components/ayuda/contenidoAyuda';
import { AvatarGrupo } from '@/components/grupos/AvatarGrupo';
import { HojaInferior } from '@/components/HojaInferior';
import { FilaOpcion } from '@/components/perfil/FilaOpcion';
import { FondoMesh, FundidoMesh } from '@/components/perfil/FondoMesh';
import {
  elegirFoto,
  PermisoFotoDenegado,
  quitarFotoGrupo,
  subirFotoGrupo,
  type OrigenFoto,
} from '@/lib/fotoPerfil';
import { FilaMiembro, ordenarMiembros } from '@/components/grupos/FilaMiembro';
import { abrirNuevoViaje } from '@/lib/nuevoViaje';

/** Cuántos integrantes se muestran en el detalle; el resto, en "Ver todos". */
const MIEMBROS_PREVIEW = 5;

/** Alto del patrón de logos detrás de la cabecera (como en el Perfil). */
const ALTO_FONDO = 420;

export default function GrupoDetalleScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { backendUserId } = useAuth();
  const theme = useTheme();
  const { start } = useCopilot();

  const [grupo, setGrupo] = useState<GrupoDetalleApi | null>(null);
  const [miembros, setMiembros] = useState<GrupoMiembroApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hojaFoto, setHojaFoto] = useState(false);
  const [guardandoFoto, setGuardandoFoto] = useState(false);
  const [modalTransferir, setModalTransferir] = useState(false);
  const [miembrosTransferencia, setMiembrosTransferencia] = useState<GrupoMiembroApi[]>([]);
  const [nuevoLiderId, setNuevoLiderId] = useState<string | null>(null);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  const cargar = useCallback(
    async (esRefresh = false) => {
      if (!grupoId) return;
      if (esRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const userId = resolveBackendUserId(backendUserId);
        const [detalle, lista] = await Promise.all([
          obtenerGrupo(grupoId, userId),
          listarMiembrosGrupo(grupoId, userId),
        ]);
        setGrupo(detalle);
        setMiembros(ordenarMiembros(lista));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo cargar el grupo.';
        setError(msg);
        if (!esRefresh) meshAlert('Error', msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [grupoId, backendUserId]
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const esLider = grupo?.mi_rol === 'lider';
  const foto = grupo?.foto ?? null;

  // Cualquier integrante puede cambiar la foto del grupo (el backend valida la membresía).
  const cambiarFoto = (origen: OrigenFoto) => {
    setHojaFoto(false);
    if (!grupoId) return;
    void (async () => {
      let uri: string | null;
      try {
        uri = await elegirFoto(origen);
      } catch (e) {
        if (e instanceof PermisoFotoDenegado) {
          meshAlert(
            'Sin permiso',
            origen === 'camara'
              ? 'Habilitá el acceso a la cámara desde los ajustes del teléfono para sacar una foto.'
              : 'Habilitá el acceso a tus fotos desde los ajustes del teléfono para elegir una.'
          );
        } else {
          meshAlert('Error', 'No se pudo abrir la foto. Intentá de nuevo.');
        }
        return;
      }
      if (!uri) return;
      setGuardandoFoto(true);
      try {
        const url = await subirFotoGrupo(grupoId, uri);
        setGrupo((g) => (g ? { ...g, foto: url } : g));
      } catch (e) {
        meshAlert('No se pudo cambiar la foto', e instanceof Error ? e.message : 'Intentá de nuevo.');
      } finally {
        setGuardandoFoto(false);
      }
    })();
  };

  const quitarFoto = () => {
    setHojaFoto(false);
    if (!grupoId) return;
    meshAlert('Quitar foto', 'El grupo va a volver a mostrar sus iniciales.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setGuardandoFoto(true);
            try {
              await quitarFotoGrupo(grupoId);
              setGrupo((g) => (g ? { ...g, foto: null } : g));
            } catch {
              meshAlert('Error', 'No se pudo quitar la foto. Intentá de nuevo.');
            } finally {
              setGuardandoFoto(false);
            }
          })();
        },
      },
    ]);
  };
  const preview = miembros.slice(0, MIEMBROS_PREVIEW);

  const verMiembros = () =>
    router.push({ pathname: '/grupo/[grupoId]/miembros', params: { grupoId } });
  const verViajes = () =>
    router.push({ pathname: '/grupo/[grupoId]/viajes', params: { grupoId } });
  const invitar = () =>
    router.push({ pathname: '/grupo/[grupoId]/invitar-desde-grupos', params: { grupoId } });
  const verPerfil = (usuarioId: string) =>
    router.push({ pathname: '/usuario/[usuarioId]', params: { usuarioId } });

  const redirigirTrasSalida = () => {
    router.replace('/(tabs)/grupos');
  };

  const ejecutarAbandono = async (nuevoLider?: string) => {
    if (!grupoId) return;
    setProcesandoAccion(true);
    try {
      const userId = resolveBackendUserId(backendUserId);
      await abandonarGrupo(grupoId, userId, nuevoLider);
      setModalTransferir(false);
      redirigirTrasSalida();
    } catch (e: unknown) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo abandonar el grupo.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const ejecutarEliminacion = () => {
    if (!grupoId) return;
    meshAlert(
      'Eliminar grupo',
      '¿Eliminar este grupo definitivamente? Esta acción no se puede deshacer y todos los miembros serán expulsados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setProcesandoAccion(true);
              try {
                const userId = resolveBackendUserId(backendUserId);
                await eliminarGrupo(grupoId, userId);
                setModalTransferir(false);
                redirigirTrasSalida();
              } catch (e: unknown) {
                meshAlert('Error', e instanceof Error ? e.message : 'No se pudo eliminar el grupo.');
              } finally {
                setProcesandoAccion(false);
              }
            })();
          },
        },
      ]
    );
  };

  // Participante: confirma y sale. Líder: si queda gente, elige a quién pasarle el
  // liderazgo; si está solo, salir elimina el grupo (RN-013).
  const iniciarAbandono = () => {
    if (!grupo || !grupoId) return;

    if (grupo.mi_rol === 'participante') {
      meshAlert('Abandonar grupo', '¿Estás seguro de que quieres abandonar este grupo?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abandonar', style: 'destructive', onPress: () => void ejecutarAbandono() },
      ]);
      return;
    }

    void (async () => {
      try {
        const userId = resolveBackendUserId(backendUserId);
        const lista = await listarMiembrosGrupo(grupoId, userId);
        const otros = lista.filter((m) => m.id !== userId);

        if (otros.length === 0) {
          meshAlert(
            'Abandonar grupo',
            'Sos el único integrante. Al abandonar, el grupo se eliminará permanentemente.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar y salir', style: 'destructive', onPress: () => void ejecutarAbandono() },
            ]
          );
          return;
        }

        setMiembrosTransferencia(otros);
        setNuevoLiderId(null);
        setModalTransferir(true);
      } catch (e: unknown) {
        meshAlert('Error', e instanceof Error ? e.message : 'No se pudieron cargar los miembros.');
      }
    })();
  };

  const cerrarModalTransferir = () => {
    if (procesandoAccion) return;
    setModalTransferir(false);
    setNuevoLiderId(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Mismo fondo que el Perfil (sin racha): el logo de Mesh repetido detrás de la cabecera. */}
      {grupo ? (
        <FondoMesh color={theme.text} alto={ALTO_FONDO} colorRacha={theme.fire} intensidadRacha={0} />
      ) : null}

      <TopBar
        title=""
        onBack={() => router.back()}
        bordered={false}
        transparente
        onAyuda={() => start()}
      />

      <ScrollViewAyuda
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargar(true)}
            tintColor={theme.accent}
          />
        }
      >
        {loading ? (
          <View style={styles.cuerpo}>
            <DetalleEsqueleto />
          </View>
        ) : error || !grupo ? (
          <View style={styles.cuerpo}>
            <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Identidad del grupo + estadísticas */}
            <View style={styles.cabecera}>
              <View style={styles.fundido}>
                <FundidoMesh color={theme.background} />
              </View>
              <PasoAyuda {...AYUDA_GRUPO_DETALLE[0]!}>
                <View style={styles.hero}>
                  <Pressable
                    onPress={() => setHojaFoto(true)}
                    disabled={guardandoFoto}
                    accessibilityRole="button"
                    accessibilityLabel={foto ? 'Cambiar la foto del grupo' : 'Agregar una foto al grupo'}
                  >
                    <AvatarGrupo nombre={grupo.nombre} foto={foto} size={96} radio={28} conBorde />
                    <View
                      style={[
                        styles.fotoBadge,
                        { backgroundColor: theme.accent, borderColor: theme.background },
                      ]}
                    >
                      {guardandoFoto ? (
                        <ActivityIndicator size="small" color={theme.onAccent} />
                      ) : (
                        <Feather name="camera" size={15} color={theme.onAccent} />
                      )}
                    </View>
                  </Pressable>

                  <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
                    {grupo.nombre}
                  </Text>

                  <View
                    style={[
                      styles.miRol,
                      { backgroundColor: esLider ? theme.goldWeak : theme.surface2 },
                    ]}
                  >
                    {esLider ? (
                      <MaterialCommunityIcons name="crown" size={14} color={theme.gold} />
                    ) : (
                      <Feather name="user" size={13} color={theme.textDim} />
                    )}
                    <Text style={[styles.miRolTexto, { color: esLider ? theme.gold : theme.textDim }]}>
                      {esLider ? 'Sos el líder' : 'Sos participante'}
                    </Text>
                  </View>

                  <View style={styles.stats}>
                    <Stat
                      icono="users"
                      valor={String(grupo.cantidad_miembros)}
                      etiqueta={grupo.cantidad_miembros === 1 ? 'Miembro' : 'Miembros'}
                    />
                    <Stat
                      icono="map"
                      valor={String(grupo.cantidad_viajes)}
                      etiqueta={grupo.cantidad_viajes === 1 ? 'Viaje' : 'Viajes'}
                      onPress={verViajes}
                    />
                    <Stat
                      icono="calendar"
                      valor={formatearEnArg(grupo.fecha_creacion, { month: 'short', year: '2-digit' })}
                      etiqueta="Desde"
                    />
                  </View>
                </View>
              </PasoAyuda>
            </View>

            {/* Fondo liso: tapa el patrón de la cabecera, que queda fijo detrás del scroll. */}
            <View style={[styles.cuerpo, { backgroundColor: theme.background }]}>
              {/* Acciones principales */}
              <View style={styles.acciones}>
                <PasoAyuda {...AYUDA_GRUPO_DETALLE[1]!} estilo={styles.flex}>
                  <Btn
                    variant="primary"
                    size="lg"
                    block
                    icon="plus"
                    onPress={() => abrirNuevoViaje({ grupo: grupo.id })}
                  >
                    Nuevo viaje
                  </Btn>
                </PasoAyuda>
                {esLider ? (
                  <PasoAyuda {...AYUDA_GRUPO_DETALLE[3]!}>
                    <Btn variant="secondary" size="lg" icon="user-plus" onPress={invitar}>
                      Invitar
                    </Btn>
                  </PasoAyuda>
                ) : null}
              </View>

              {/* Miembros */}
              <PasoAyuda {...AYUDA_GRUPO_DETALLE[2]!}>
                <View style={styles.seccion}>
                  <View style={styles.seccionHeader}>
                    <Text style={[styles.eyebrow, { color: theme.textDim }]}>
                      MIEMBROS ({miembros.length})
                    </Text>
                    <Pressable onPress={verMiembros} hitSlop={8} accessibilityRole="button">
                      <Text style={[styles.verTodos, { color: theme.accent }]}>Ver todos</Text>
                    </Pressable>
                  </View>

                  <View
                    style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    {preview.map((m, i) => {
                      const esYo = m.id === backendUserId;
                      return (
                        <FilaMiembro
                          key={m.id}
                          miembro={m}
                          esYo={esYo}
                          separador={i > 0}
                          onPress={esYo ? undefined : () => verPerfil(m.id)}
                        />
                      );
                    })}

                    {miembros.length > MIEMBROS_PREVIEW ? (
                      <Pressable
                        onPress={verMiembros}
                        style={({ pressed }) => [
                          styles.filaExtra,
                          { borderTopColor: theme.border },
                          pressed && { backgroundColor: theme.surface2 },
                        ]}
                      >
                        <Text style={[styles.filaExtraTexto, { color: theme.text }]}>
                          Ver los {miembros.length} miembros
                        </Text>
                        <Feather name="chevron-right" size={18} color={theme.textMute} />
                      </Pressable>
                    ) : null}

                    {esLider ? (
                      <Pressable
                        onPress={invitar}
                        style={({ pressed }) => [
                          styles.filaExtra,
                          { borderTopColor: theme.border },
                          pressed && { backgroundColor: theme.surface2 },
                        ]}
                      >
                        <View style={[styles.iconoInvitar, { backgroundColor: theme.accentWeak }]}>
                          <Feather name="user-plus" size={18} color={theme.accent} />
                        </View>
                        <View style={styles.flex}>
                          <Text style={[styles.filaExtraTexto, { color: theme.accent }]}>
                            Invitar personas
                          </Text>
                          <Text style={[styles.filaExtraSub, { color: theme.textDim }]}>
                            Por usuario o desde otros grupos
                          </Text>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </PasoAyuda>

              {/* Acciones de salida al final, como "Cerrar sesión" en el Perfil: filas simples en rojo. */}
              <PasoAyuda {...AYUDA_GRUPO_DETALLE[4]!}>
                <View style={styles.accionesSalida}>
                  <FilaOpcion
                    icono="log-out"
                    titulo="Abandonar grupo"
                    peligro
                    disabled={procesandoAccion}
                    onPress={iniciarAbandono}
                  />
                  {esLider ? (
                    <FilaOpcion
                      icono="trash-2"
                      titulo="Eliminar grupo"
                      peligro
                      disabled={procesandoAccion}
                      onPress={ejecutarEliminacion}
                    />
                  ) : null}
                </View>
              </PasoAyuda>
            </View>
          </>
        )}
      </ScrollViewAyuda>

      <TransferirLiderazgoModal
        visible={modalTransferir}
        miembros={miembrosTransferencia}
        seleccionadoId={nuevoLiderId}
        procesando={procesandoAccion}
        onSeleccionar={setNuevoLiderId}
        onConfirmar={() => {
          if (nuevoLiderId) void ejecutarAbandono(nuevoLiderId);
        }}
        onEliminarGrupo={() => {
          setModalTransferir(false);
          ejecutarEliminacion();
        }}
        onCerrar={cerrarModalTransferir}
      />

      <HojaInferior visible={hojaFoto} titulo="Foto del grupo" onCerrar={() => setHojaFoto(false)}>
        <FilaOpcion icono="image" titulo="Elegir de la galería" onPress={() => cambiarFoto('galeria')} />
        <FilaOpcion icono="camera" titulo="Sacar una foto" onPress={() => cambiarFoto('camara')} />
        {foto ? <FilaOpcion icono="trash-2" titulo="Quitar foto" peligro onPress={quitarFoto} /> : null}
      </HojaInferior>
    </View>
  );
}

function Stat({
  icono,
  valor,
  etiqueta,
  onPress,
}: {
  icono: keyof typeof Feather.glyphMap;
  valor: string;
  etiqueta: string;
  /** Si está, el stat es tocable y lleva a su detalle (ej. los viajes del grupo). */
  onPress?: () => void;
}) {
  const theme = useTheme();
  const contenido = (
    <>
      <Feather name={icono} size={15} color={onPress ? theme.accent : theme.textMute} />
      <Text style={[styles.statValor, { color: theme.text }]} numberOfLines={1}>
        {valor}
      </Text>
      <View style={styles.statEtiquetaFila}>
        <Text style={[styles.statEtiqueta, { color: onPress ? theme.accent : theme.textDim }]}>
          {etiqueta}
        </Text>
        {onPress ? <Feather name="chevron-right" size={12} color={theme.accent} /> : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {contenido}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver ${etiqueta.toLowerCase()} del grupo`}
      style={({ pressed }) => [
        styles.stat,
        { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
      ]}
    >
      {contenido}
    </Pressable>
  );
}

function DetalleEsqueleto() {
  return (
    <View style={styles.hero}>
      <Esqueleto ancho={96} alto={96} radio={28} />
      <Esqueleto ancho="55%" alto={24} />
      <Esqueleto ancho={120} alto={24} radio={12} />
      <View style={styles.stats}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.flex}>
            <Esqueleto alto={84} radio={14} />
          </View>
        ))}
      </View>
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
  content: {
    flexGrow: 1,
  },
  cabecera: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 22,
  },
  fundido: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 170 },
  cuerpo: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 22,
  },
  // Las filas traen su propio padding: ocupan todo el ancho, como en el Perfil.
  accionesSalida: {
    marginHorizontal: -20,
  },
  hero: {
    alignItems: 'center',
    gap: 10,
  },
  fotoBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginTop: 4,
  },
  miRol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  miRolTexto: {
    fontSize: 13,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    alignSelf: 'stretch',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  statValor: {
    fontSize: 19,
    fontWeight: '800',
    fontFamily: 'SpaceMono',
  },
  statEtiquetaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statEtiqueta: {
    fontSize: 10.5,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  acciones: {
    flexDirection: 'row',
    gap: 10,
  },
  seccion: {
    gap: 10,
  },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  verTodos: {
    fontSize: 14,
    fontWeight: '700',
  },
  tarjeta: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filaExtra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  filaExtraTexto: {
    fontSize: 15,
    fontWeight: '700',
  },
  filaExtraSub: {
    fontSize: 13,
    marginTop: 2,
  },
  // Mismo ancho que el avatar con anillo de `FilaMiembro`: los textos quedan alineados.
  iconoInvitar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },
});
