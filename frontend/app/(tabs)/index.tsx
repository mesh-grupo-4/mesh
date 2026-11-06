import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { router, useFocusEffect, useIsFocused } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/context/AuthContext'
import { useTripRealtime } from '@/context/TripRealtimeContext'
import { Badge, Btn, useTheme } from '@/components/MeshUI'
import { BotonAyuda } from '@/components/ayuda/BotonAyuda'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_INICIO } from '@/components/ayuda/contenidoAyuda'
import { CenterLocationButton } from '@/components/live/CenterLocationButton'
import { MeshMapView, type MeshMapViewHandle } from '@/components/maps/MeshMapView'
import { getMapStyle } from '@/components/route-config/mapStyles'
import { REGION_FALLBACK } from '@/components/route-config/routeTypes'
import { useUbicacionActual } from '@/hooks/useUbicacionActual'
import { etiquetaActividad } from '@/lib/activityDefaults'
import { resolveBackendUserId } from '@/lib/apiClient'
import { formatearEnArg } from '@/lib/tiempoArg'
import { obtenerViajeEnCurso, type ViajeEnCursoApi } from '@/lib/viajesApi'

const ESTILO_MAPA = getMapStyle('standard')
const ZOOM_UBICACION = 16

function horaInicio(iso: string | null): string {
  if (!iso) return 'En curso'
  return `Desde las ${formatearEnArg(iso, { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Inicio: mapa con dónde estás parado y, arriba a la derecha, "Viaje YA".
 * Si hay un viaje en curso aparece una tarjeta flotante para volver al mapa en vivo.
 */
export default function InicioScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const enfocado = useIsFocused()
  const { backendUserId, backendSyncing } = useAuth()
  const { syncKnownTripIds } = useTripRealtime()
  const [enCurso, setEnCurso] = useState<ViajeEnCursoApi | null>(null)
  const mapRef = useRef<MeshMapViewHandle>(null)
  const centradoRef = useRef(false)
  // La ubicación solo se sigue mientras Inicio está a la vista.
  const { ubicacion } = useUbicacionActual({ activo: enfocado, seguir: true })

  useEffect(() => {
    if (ubicacion && !centradoRef.current) {
      centradoRef.current = true
      mapRef.current?.animateTo(ubicacion, ZOOM_UBICACION)
    }
  }, [ubicacion])

  const cargarEnCurso = useCallback(async () => {
    if (backendSyncing) return
    let userId: string
    try {
      userId = resolveBackendUserId(backendUserId)
    } catch {
      setEnCurso(null)
      return
    }
    try {
      const viaje = await obtenerViajeEnCurso(userId)
      setEnCurso(viaje)
      if (viaje?.id) syncKnownTripIds([viaje.id])
    } catch {
      // Ante un fallo de red dejamos el último estado conocido.
    }
  }, [backendUserId, backendSyncing, syncKnownTripIds])

  useFocusEffect(
    useCallback(() => {
      void cargarEnCurso()
    }, [cargarEnCurso])
  )

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <PasoAyuda {...AYUDA_INICIO[0]!} estilo={StyleSheet.absoluteFill}>
        <MeshMapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialCenter={{ latitude: REGION_FALLBACK.latitude, longitude: REGION_FALLBACK.longitude }}
          initialZoom={12}
          mapStyle={ESTILO_MAPA}
          userLocation={ubicacion}
        />
      </PasoAyuda>

      <View style={[styles.top, { top: insets.top + 10 }]} pointerEvents="box-none">
        <BotonAyuda />
        <PasoAyuda {...AYUDA_INICIO[1]!}>
          <Btn size="lg" icon="zap" onPress={() => router.push('/viaje/rapido')} style={styles.sombra}>
            Viaje YA
          </Btn>
        </PasoAyuda>
      </View>

      {ubicacion && (
        <CenterLocationButton
          align="right"
          bottomOffset={enCurso ? 150 : 40}
          onPress={() => mapRef.current?.animateTo(ubicacion, ZOOM_UBICACION)}
        />
      )}

      {enCurso && (
        <PasoAyuda {...AYUDA_INICIO[2]!} estilo={styles.enCursoWrap} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [
              styles.enCursoCard,
              styles.sombra,
              {
                backgroundColor: pressed ? theme.surface2 : theme.surface,
                borderColor: theme.accentLine,
              },
            ]}
            onPress={() =>
              router.push({ pathname: '/viaje/[viajeId]/live', params: { viajeId: enCurso.id } })
            }
          >
            <View style={styles.enCursoInfo}>
              <View style={styles.enCursoTop}>
                <Badge tone="live" pulse>
                  EN VIVO
                </Badge>
                <Text style={[styles.enCursoMeta, { color: theme.textDim }]}>
                  {horaInicio(enCurso.fecha_inicio_real)}
                </Text>
              </View>
              <Text style={[styles.enCursoTitulo, { color: theme.text }]} numberOfLines={1}>
                {enCurso.nombre || etiquetaActividad(enCurso.tipo_actividad)}
              </Text>
            </View>
            <Feather name="arrow-right" size={22} color={theme.accent} />
          </Pressable>
        </PasoAyuda>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sombra: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  enCursoWrap: { position: 'absolute', left: 16, right: 16, bottom: 40 },
  enCursoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  enCursoInfo: { flex: 1, gap: 6 },
  enCursoTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  enCursoMeta: { fontSize: 14, fontWeight: '600' },
  enCursoTitulo: { fontSize: 18, fontWeight: '800' },
})
