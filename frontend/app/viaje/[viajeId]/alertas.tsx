import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useCopilot } from 'react-native-copilot'
import { Btn, TopBar, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_VIAJE_ALERTAS } from '@/components/ayuda/contenidoAyuda'
import { CrearAlertaSheet } from '@/components/live/CrearAlertaSheet'
import { SegmentTabs } from '@/components/SegmentTabs'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import { useAlertas } from '@/hooks/useAlertas'
import {
  ACCION_ESTADO_ALERTA,
  ETIQUETA_ESTADO_ALERTA,
  TRANSICIONES_ALERTA,
  mensajeAlertaVisible,
  metaTipoAlerta,
  type AlertaApi,
  type EstadoAlertaApi,
  type TipoAlertaApi,
} from '@/lib/alertasApi'
import { pedirEnfoqueMapa } from '@/lib/enfoqueMapa'
import { meshAlert } from '@/lib/meshAlert'
import { formatearEnArg } from '@/lib/tiempoArg'
import { obtenerViaje, type ViajeDetalleApi } from '@/lib/viajesApi'

type PestanaAlertas = 'activas' | 'resueltas'

/** Una alerta cerrada ya no admite transiciones: va a la pestaña Resueltas, en gris. */
function alertaCerrada(alerta: AlertaApi): boolean {
  return alerta.estado === 'cancelada' || alerta.estado === 'resuelta'
}

/** US1: historial de alertas del viaje, y creación para el líder. */
export default function AlertasViajeScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const insets = useSafeAreaInsets()
  const { backendUserId } = useAuth()
  const params = useLocalSearchParams<{ viajeId: string | string[] }>()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userId = backendUserId || DEV_USER_ID || ''
  const [viaje, setViaje] = useState<ViajeDetalleApi | null>(null)
  const [componiendo, setComponiendo] = useState(false)
  const [pestana, setPestana] = useState<PestanaAlertas>('activas')

  const { alertas, cargando, enviando, publicar, cambiarEstado, refrescar, marcarTodasVistas } =
    useAlertas({
      viajeId: viajeId ?? '',
      userId,
      habilitado: Boolean(viajeId && userId.trim()),
    })

  const alertasVisibles = useMemo(
    () => alertas.filter((a) => alertaCerrada(a) === (pestana === 'resueltas')),
    [alertas, pestana]
  )

  // Lo que aparece en el historial ya se vio: la campanita del mapa baja a cero,
  // y también las que lleguen por socket mientras la pantalla está abierta.
  useEffect(() => {
    marcarTodasVistas()
  }, [marcarTodasVistas])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return
    void obtenerViaje(viajeId, userId)
      .then(setViaje)
      .catch(() => setViaje(null))
  }, [viajeId, userId])

  const esLider = viaje != null && userId === viaje.creador_id
  const puedeCrear =
    viaje?.estado === 'en_curso' &&
    (esLider || (viaje?.alertas_solo_lider ?? true) === false)
  // RN-042: cancelar / resolver es del líder, con el viaje en curso.
  const puedeGestionar = esLider && viaje?.estado === 'en_curso'

  /** Vuelve al mapa en vivo centrado en la alerta. */
  const handleVerEnMapa = useCallback(
    (alerta: AlertaApi) => {
      if (!viajeId || alerta.lat == null || alerta.lng == null) return
      pedirEnfoqueMapa({ viajeId, lat: alerta.lat, lng: alerta.lng })
      if (router.canGoBack()) router.back()
      else router.replace({ pathname: '/viaje/[viajeId]/live', params: { viajeId } })
    },
    [router, viajeId]
  )

  const handleCambiarEstado = useCallback(
    (alertaId: string, estado: EstadoAlertaApi) => {
      void cambiarEstado(alertaId, estado).catch((e: unknown) => {
        meshAlert(
          'No se pudo actualizar la alerta',
          e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
        )
      })
    },
    [cambiarEstado]
  )

  const centroMapaAlerta = useMemo(
    () => ({ latitude: -31.4167, longitude: -64.1833 }),
    []
  )

  const handlePublicar = useCallback(
    (tipo: TipoAlertaApi, mensaje: string, ubicacion?: { lat: number; lng: number }) => {
      void (async () => {
        try {
          await publicar({
            tipo,
            mensaje: mensaje.trim() || undefined,
            lat: ubicacion?.lat,
            lng: ubicacion?.lng,
          })
          setComponiendo(false)
        } catch (e) {
          meshAlert(
            'No se pudo enviar la alerta',
            e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
          )
        }
      })()
    },
    [publicar]
  )

  if (!viajeId) {
    return (
      <View style={[styles.centro, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: theme.textMute }}>Viaje no especificado.</Text>
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Alertas del viaje"
        sub={viaje?.nombre ?? undefined}
        onBack={() => router.back()}
        onAyuda={() => start()}
      />

      <View style={styles.pestanas}>
        <SegmentTabs
          tabs={[
            { key: 'activas', label: 'Activas' },
            { key: 'resueltas', label: 'Resueltas' },
          ]}
          active={pestana}
          onChange={(key) => setPestana(key as PestanaAlertas)}
          theme={theme}
        />
      </View>

      <PasoAyuda {...AYUDA_VIAJE_ALERTAS[0]!} estilo={styles.flex1}>
      <ScrollView
        contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={() => void refrescar()} />
        }
      >
        {cargando && alertas.length === 0 ? (
          <ActivityIndicator style={styles.spinner} color={theme.accent} />
        ) : null}

        {!cargando && alertasVisibles.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={[styles.vacioTitulo, { color: theme.textDim }]}>
              {pestana === 'activas' ? 'Sin alertas activas' : 'Sin alertas resueltas'}
            </Text>
            <Text style={[styles.vacioTxt, { color: theme.textMute }]}>
              {pestana === 'resueltas'
                ? 'Las alertas resueltas o canceladas van a aparecer acá.'
                : puedeCrear
                  ? 'Creá una alerta para avisarle algo al grupo durante el viaje.'
                  : 'Las alertas del viaje van a aparecer acá.'}
            </Text>
          </View>
        ) : null}

        {alertasVisibles.map((a) => (
          <TarjetaAlerta
            key={a.id}
            alerta={a}
            theme={theme}
            gestionable={puedeGestionar}
            onCambiarEstado={handleCambiarEstado}
            onVerEnMapa={handleVerEnMapa}
          />
        ))}
      </ScrollView>
      </PasoAyuda>

      {puedeCrear ? (
        <PasoAyuda {...AYUDA_VIAJE_ALERTAS[1]!}>
          <View style={[styles.pie, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
            <Btn block onPress={() => setComponiendo(true)}>Nueva alerta</Btn>
          </View>
        </PasoAyuda>
      ) : null}

      <CrearAlertaSheet
        visible={componiendo}
        enviando={enviando}
        centroMapaInicial={centroMapaAlerta}
        tipoActividad={viaje?.tipo_actividad}
        onPublicar={handlePublicar}
        onCancelar={() => setComponiendo(false)}
      />
    </View>
  )
}

function TarjetaAlerta({
  alerta,
  theme,
  gestionable,
  onCambiarEstado,
  onVerEnMapa,
}: {
  alerta: AlertaApi
  theme: ReturnType<typeof useTheme>
  gestionable: boolean
  onCambiarEstado: (alertaId: string, estado: EstadoAlertaApi) => void
  onVerEnMapa: (alerta: AlertaApi) => void
}) {
  const meta = metaTipoAlerta(alerta.tipo)
  const mensaje = mensajeAlertaVisible(alerta.mensaje)
  const cerrada = alertaCerrada(alerta)
  const colorTipo = cerrada ? theme.textDim : meta.color
  const transiciones = gestionable ? TRANSICIONES_ALERTA[alerta.estado] : []
  // Solo las activas con ubicación tienen marcador en el mapa en vivo.
  const verEnMapa = alerta.estado === 'activa' && alerta.lat != null && alerta.lng != null
  return (
    <View
      style={[
        styles.tarjeta,
        { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: colorTipo },
      ]}
    >
      <View style={styles.tarjetaHeader}>
        <Text style={[styles.emoji, { color: colorTipo }]}>{meta.emoji}</Text>
        <Text style={[styles.tipo, { color: colorTipo }]}>{meta.label}</Text>
        {alerta.estado !== 'activa' ? (
          <Text
            style={[
              styles.estado,
              { color: cerrada ? theme.textMute : theme.accent, borderColor: theme.border },
            ]}
          >
            {ETIQUETA_ESTADO_ALERTA[alerta.estado]}
          </Text>
        ) : null}
        <Text style={[styles.hora, { color: theme.textMute }]}>
          {/* RN-105: toda hora visible va en hora argentina. */}
          {formatearEnArg(alerta.created_at, {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {mensaje ? (
        <Text style={[styles.mensaje, { color: cerrada ? theme.textDim : theme.text }]}>{mensaje}</Text>
      ) : null}

      <Text
        style={[styles.autor, { color: theme.textMute }, !mensaje && styles.autorSinMensaje]}
      >
        {alerta.creada_por_nombre ?? 'Sistema'}
        {alerta.lat != null && alerta.lng != null ? ' · con ubicación' : ''}
      </Text>

      {verEnMapa || transiciones.length > 0 ? (
        <View style={styles.acciones}>
          {verEnMapa ? (
            <Btn size="sm" variant="outline" onPress={() => onVerEnMapa(alerta)}>
              Ver en el mapa
            </Btn>
          ) : null}
          {transiciones.map((estado) => (
            <Btn
              key={estado}
              size="sm"
              variant={estado === 'cancelada' ? 'danger-outline' : 'outline'}
              onPress={() => onCambiarEstado(alerta.id, estado)}
            >
              {ACCION_ESTADO_ALERTA[estado]}
            </Btn>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  pestanas: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lista: {
    padding: 14,
    gap: 10,
  },
  spinner: {
    marginTop: 32,
  },
  vacio: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  vacioTitulo: {
    fontSize: 17,
    fontWeight: '700',
  },
  vacioTxt: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  pie: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  tarjeta: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
  },
  tarjetaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 16,
  },
  tipo: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  hora: {
    fontSize: 13,
  },
  estado: {
    fontSize: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  mensaje: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
  },
  autor: {
    marginTop: 8,
    fontSize: 13,
  },
  autorSinMensaje: {
    marginTop: 6,
  },
})
