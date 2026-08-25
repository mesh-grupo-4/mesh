import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Btn, TopBar, useTheme } from '@/components/MeshUI'
import { CrearAlertaSheet } from '@/components/live/CrearAlertaSheet'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import { useAlertas } from '@/hooks/useAlertas'
import { metaTipoAlerta, type AlertaApi, type TipoAlertaApi } from '@/lib/alertasApi'
import { meshAlert } from '@/lib/meshAlert'
import { formatearEnArg } from '@/lib/tiempoArg'
import { obtenerViaje, type ViajeDetalleApi } from '@/lib/viajesApi'

/** US1: historial de alertas del viaje, y creación para el líder. */
export default function AlertasViajeScreen() {
  const router = useRouter()
  const theme = useTheme()
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

  const { alertas, cargando, enviando, publicar, refrescar } = useAlertas({
    viajeId: viajeId ?? '',
    userId,
    habilitado: Boolean(viajeId && userId.trim()),
  })

  useEffect(() => {
    if (!viajeId || !userId.trim()) return
    void obtenerViaje(viajeId, userId)
      .then(setViaje)
      .catch(() => setViaje(null))
  }, [viajeId, userId])

  const esLider = viaje != null && userId === viaje.creador_id
  const puedeCrear = esLider && viaje?.estado === 'en_curso'

  const handlePublicar = useCallback(
    (tipo: TipoAlertaApi, mensaje: string) => {
      void (async () => {
        try {
          await publicar({ tipo, mensaje: mensaje.trim() || undefined })
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
      />

      <ScrollView
        contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={() => void refrescar()} />
        }
      >
        {cargando && alertas.length === 0 ? (
          <ActivityIndicator style={styles.spinner} color={theme.accent} />
        ) : null}

        {!cargando && alertas.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={[styles.vacioTitulo, { color: theme.textDim }]}>Sin alertas todavía</Text>
            <Text style={[styles.vacioTxt, { color: theme.textMute }]}>
              {puedeCrear
                ? 'Creá una alerta para avisarle algo al grupo durante el viaje.'
                : 'Las alertas que envíe el líder van a aparecer acá.'}
            </Text>
          </View>
        ) : null}

        {alertas.map((a) => (
          <TarjetaAlerta key={a.id} alerta={a} theme={theme} />
        ))}
      </ScrollView>

      {puedeCrear ? (
        <View style={[styles.pie, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
          <Btn block onPress={() => setComponiendo(true)}>Nueva alerta</Btn>
        </View>
      ) : null}

      <CrearAlertaSheet
        visible={componiendo}
        enviando={enviando}
        onPublicar={handlePublicar}
        onCancelar={() => setComponiendo(false)}
      />
    </View>
  )
}

function TarjetaAlerta({
  alerta,
  theme,
}: {
  alerta: AlertaApi
  theme: ReturnType<typeof useTheme>
}) {
  const meta = metaTipoAlerta(alerta.tipo)
  return (
    <View
      style={[
        styles.tarjeta,
        { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: meta.color },
      ]}
    >
      <View style={styles.tarjetaHeader}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
        <Text style={[styles.tipo, { color: meta.color }]}>{meta.label}</Text>
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

      {alerta.mensaje ? (
        <Text style={[styles.mensaje, { color: theme.text }]}>{alerta.mensaje}</Text>
      ) : null}

      <Text
        style={[styles.autor, { color: theme.textMute }, !alerta.mensaje && styles.autorSinMensaje]}
      >
        {alerta.creada_por_nombre ?? 'Sistema'}
        {alerta.lat != null && alerta.lng != null ? ' · con ubicación' : ''}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
