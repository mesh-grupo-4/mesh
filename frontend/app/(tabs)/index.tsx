import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { router, useFocusEffect, useIsFocused } from 'expo-router'
import { Feather, FontAwesome } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/context/AuthContext'
import { useTripRealtime } from '@/context/TripRealtimeContext'
import { Badge, MeshLogo, useTheme } from '@/components/MeshUI'
import { SelectorTema } from '@/components/SelectorTema'
import Colors from '@/constants/Colors'
import { BotonAyuda } from '@/components/ayuda/BotonAyuda'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_INICIO } from '@/components/ayuda/contenidoAyuda'
import { MeshMapView, type MeshMapViewHandle } from '@/components/maps/MeshMapView'
import { ESTILO_MAPA_OSCURO_INICIO, getMapStyle } from '@/components/route-config/mapStyles'
import { REGION_FALLBACK } from '@/components/route-config/routeTypes'
import { useUbicacionActual } from '@/hooks/useUbicacionActual'
import { etiquetaActividad } from '@/lib/activityDefaults'
import { resolveBackendUserId } from '@/lib/apiClient'
import { formatearEnArg } from '@/lib/tiempoArg'
import { obtenerViajeEnCurso, type ViajeEnCursoApi } from '@/lib/viajesApi'

const ESTILO_MAPA = getMapStyle('standard')
const ZOOM_UBICACION = 16
/** Alto de la barra superior, sin contar el inset del sistema. */
const BARRA_ALTO = 56

function horaInicio(iso: string | null): string {
  if (!iso) return 'En curso'
  return `Desde las ${formatearEnArg(iso, { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Inicio: mapa con dónde estás parado y, abajo al alcance del pulgar, "Viaje YA".
 * Si hay un viaje en curso, su tarjeta pasa a ser la acción principal.
 */
export default function InicioScreen() {
  const espacioTabBar = useEspacioTabBar()
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

  const abrirViajeYa = () => router.push('/viaje/rapido')
  const altoBarra = insets.top + BARRA_ALTO

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <PasoAyuda {...AYUDA_INICIO[0]!} estilo={[StyleSheet.absoluteFill, { top: altoBarra }]}>
        <MeshMapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialCenter={{ latitude: REGION_FALLBACK.latitude, longitude: REGION_FALLBACK.longitude }}
          initialZoom={12}
          mapStyle={theme === Colors.dark ? ESTILO_MAPA_OSCURO_INICIO : ESTILO_MAPA}
          userLocation={ubicacion}
        />
      </PasoAyuda>

      <View
        style={[
          styles.barra,
          {
            height: altoBarra,
            paddingTop: insets.top,
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <MeshLogo size={22} />
        <View style={styles.barraAcciones}>
          <SelectorTema menuTop={altoBarra + 8} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escanear un QR para unirte"
            onPress={() => router.push('/escanear-qr')}
            style={({ pressed }) => [
              styles.barraBoton,
              {
                backgroundColor: pressed ? theme.surface2 : theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <FontAwesome name="qrcode" size={24} color={theme.accent} />
          </Pressable>
          <BotonAyuda size={48} />
        </View>
      </View>

      <View
        style={[styles.dock, { bottom: espacioTabBar }, enCurso && ubicacion && styles.dockConCentrar]}
        pointerEvents="box-none"
      >
        {/* Con un viaje en curso no se ofrece iniciar otro: la acción es volver a ese viaje. */}
        {!enCurso && (
          <PasoAyuda {...AYUDA_INICIO[1]!} estilo={styles.viajeYaPaso}>
            <Pressable
              accessibilityRole="button"
              onPress={abrirViajeYa}
              style={({ pressed }) => [
                styles.viajeYa,
                styles.sombra,
                { backgroundColor: theme.accent },
                pressed && styles.presionado,
              ]}
            >
              <Feather name="zap" size={20} color={theme.onAccent} />
              <Text style={[styles.viajeYaTexto, { color: theme.onAccent }]}>Viaje YA</Text>
            </Pressable>
          </PasoAyuda>
        )}

        {enCurso && (
          <PasoAyuda {...AYUDA_INICIO[2]!}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/viaje/[viajeId]/live', params: { viajeId: enCurso.id } })
              }
              style={({ pressed }) => [
                styles.panel,
                styles.sombra,
                { backgroundColor: pressed ? theme.surface2 : theme.surface },
              ]}
            >
              <View style={[styles.filete, styles.fileteViaje, { borderColor: theme.accentLine }]}>
                <View style={styles.enCursoInfo}>
                  <View style={styles.enCursoTop}>
                    <Badge tone="live" pulse>
                      EN VIVO
                    </Badge>
                    <Text style={[styles.enCursoMeta, { color: theme.textDim }]} numberOfLines={1}>
                      {horaInicio(enCurso.fecha_inicio_real)}
                    </Text>
                  </View>
                  <Text style={[styles.enCursoTitulo, { color: theme.text }]} numberOfLines={1}>
                    {enCurso.nombre || etiquetaActividad(enCurso.tipo_actividad)}
                  </Text>
                </View>
                <View style={[styles.enCursoFlecha, { backgroundColor: theme.accent }]}>
                  <Feather name="arrow-right" size={22} color={theme.onAccent} />
                </View>
              </View>
            </Pressable>
          </PasoAyuda>
        )}

        {ubicacion && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Centrar en mi ubicación"
            onPress={() => mapRef.current?.animateTo(ubicacion, ZOOM_UBICACION)}
            style={({ pressed }) => [
              styles.centrar,
              styles.sombra,
              { backgroundColor: pressed ? theme.surface2 : theme.surface },
            ]}
          >
            <Feather name="crosshair" size={24} color={theme.text} />
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  barra: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barraAcciones: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barraBoton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sombra: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  dock: { position: 'absolute', left: 16, right: 16, gap: 12 },
  // Con viaje en curso, reserva la fila del botón de centrar arriba de la tarjeta.
  dockConCentrar: { paddingTop: 64 },
  viajeYaPaso: { alignSelf: 'flex-start' },
  viajeYa: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  // 19 px en negrita: texto grande, legible en blanco sobre el acento de la marca.
  viajeYaTexto: { fontSize: 19, fontWeight: '800' },
  centrar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: { borderRadius: 20, padding: 5 },
  presionado: { opacity: 0.88 },
  filete: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1.5,
  },
  fileteViaje: { paddingVertical: 12, paddingLeft: 14, paddingRight: 10, gap: 12 },
  enCursoInfo: { flex: 1, gap: 6 },
  enCursoTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  enCursoMeta: { flexShrink: 1, fontSize: 15, fontWeight: '600' },
  enCursoTitulo: { fontSize: 20, fontWeight: '800' },
  enCursoFlecha: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
