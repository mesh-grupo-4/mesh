import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useCopilot } from 'react-native-copilot'
import { Feather } from '@expo/vector-icons'

import { CorazonGuardar } from '@/components/CorazonGuardar'
import { StatCard, StatCardRow } from '@/components/StatCard'
import { ActivityTile, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda'
import { AYUDA_RUTA_GUARDADA } from '@/components/ayuda/contenidoAyuda'
import { RouteMapView } from '@/components/route-config/RouteMapView'
import { formatDurationHm, formatKm } from '@/lib/format'
import { abrirNuevoViaje, paramTexto } from '@/lib/nuevoViaje'
import { CATEGORIAS_PARADA } from '@/lib/paradasApi'
import {
  coordsEncuadreSnapshot,
  regionInicialSnapshot,
  snapshotToMap,
} from '@/lib/rutaSnapshotMapa'
import { obtenerRutaPlantilla, type RutaPlantillaDetalleApi } from '@/lib/rutasCompartidasApi'
import { confirmarQuitarGuardada } from '@/lib/rutasGuardadas'

const NOMBRE_ACTIVIDAD = {
  moto: 'Moto',
  auto: 'Auto',
  bici: 'Bici',
  running: 'Running',
  trekking: 'Trekking',
  otro: 'Otro',
} as const

function etiquetaCategoria(categoria: string) {
  const c = CATEGORIAS_PARADA.find((x) => x.id === categoria)
  return c ? `${c.emoji} ${c.label}` : categoria
}

/**
 * Detalle de una ruta guardada ("Mis rutas", RN-084): se ve el trazado antes de decidir
 * usarla. "Usar en viaje" abre el selector Viaje YA / Planificar con la plantilla precargada.
 */
export default function RutaGuardadaScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { start } = useCopilot()
  const params = useLocalSearchParams<{ plantillaId: string | string[] }>()
  const plantillaId = paramTexto(params.plantillaId)

  const [ruta, setRuta] = useState<RutaPlantillaDetalleApi | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quitando, setQuitando] = useState(false)

  useEffect(() => {
    if (!plantillaId) {
      setError('Ruta inválida.')
      setCargando(false)
      return
    }
    let cancelado = false
    setCargando(true)
    obtenerRutaPlantilla(plantillaId)
      .then((r) => {
        if (!cancelado) setRuta(r)
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo cargar la ruta.')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [plantillaId])

  const mapa = useMemo(() => (ruta ? snapshotToMap(ruta) : null), [ruta])
  const initialRegion = useMemo(() => regionInicialSnapshot(mapa?.waypoints ?? []), [mapa])
  const fitCoords = useMemo(() => (mapa ? coordsEncuadreSnapshot(mapa) : null), [mapa])

  // Desmarcar el corazón la quita de guardadas: la pantalla ya no tiene sentido y se vuelve.
  const quitar = () => {
    if (!ruta) return
    confirmarQuitarGuardada({
      nombre: ruta.nombre,
      plantillaId: ruta.id,
      onInicio: () => setQuitando(true),
      onFin: () => setQuitando(false),
      onQuitada: () => router.back(),
    })
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Ruta guardada" onBack={() => router.back()} bordered={false} onAyuda={() => start()} />

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : error || !ruta || !mapa ? (
        <View style={styles.center}>
          <Text style={[styles.mensaje, { color: theme.danger }]}>
            {error ?? 'Esta ruta ya no está disponible.'}
          </Text>
        </View>
      ) : (
        <ScrollViewAyuda contentContainerStyle={styles.inner}>
          <View style={styles.hero}>
            <ActivityTile activity={ruta.tipo_actividad} size={46} />
            <View style={styles.heroText}>
              <Text style={[styles.titulo, { color: theme.text }]} numberOfLines={2}>
                {ruta.nombre}
              </Text>
              <Text style={[styles.sub, { color: theme.textDim }]} numberOfLines={2}>
                {ruta.origen.nombre || 'Origen'} → {ruta.destino.nombre || 'Destino'}
              </Text>
            </View>
            <CorazonGuardar guardada cargando={quitando} nombre={ruta.nombre} onPress={quitar} />
          </View>

          <PasoAyuda {...AYUDA_RUTA_GUARDADA[0]!}>
            <View style={styles.mapBox}>
              <RouteMapView
                waypoints={mapa.waypoints}
                routeLineLatLng={mapa.routeLine.length > 1 ? mapa.routeLine : null}
                initialRegion={initialRegion}
                cameraTarget={null}
                fitRouteCoords={fitCoords}
                mapPickMode={false}
                fitBottomPadding={40}
                botonEncuadrar
              />
            </View>
          </PasoAyuda>

          <StatCardRow>
            <StatCard icon="activity" value={NOMBRE_ACTIVIDAD[ruta.tipo_actividad]} label="Actividad" />
            <StatCard
              icon="map-pin"
              value={ruta.distancia_planeada_m != null ? formatKm(ruta.distancia_planeada_m) : '—'}
              label="Distancia"
            />
            <StatCard
              icon="clock"
              value={ruta.tiempo_estimado_seg != null ? formatDurationHm(ruta.tiempo_estimado_seg) : '—'}
              label="Tiempo est."
            />
          </StatCardRow>

          {ruta.paradas.length > 0 ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardTitulo, { color: theme.text }]}>Paradas</Text>
              {ruta.paradas.map((p) => (
                <View key={p.orden} style={styles.fila}>
                  <Text style={[styles.sub, { color: theme.textDim }]}>{etiquetaCategoria(p.categoria)}</Text>
                  {p.nombre ? (
                    <Text style={[styles.sub, styles.flex1, { color: theme.text }]} numberOfLines={1}>
                      {p.nombre}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {ruta.checklist.length > 0 ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardTitulo, { color: theme.text }]}>Checklist</Text>
              {ruta.checklist.map((item) => (
                <View key={item} style={styles.fila}>
                  <Feather name="check" size={14} color={theme.textDim} />
                  <Text style={[styles.sub, styles.flex1, { color: theme.textDim }]}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <PasoAyuda {...AYUDA_RUTA_GUARDADA[1]!}>
            <Btn
              variant="primary"
              block
              icon="plus"
              disabled={quitando}
              onPress={() =>
                abrirNuevoViaje({ plantillaId: ruta.id, tipoActividad: ruta.tipo_actividad })
              }
            >
              Usar en viaje
            </Btn>
          </PasoAyuda>
        </ScrollViewAyuda>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mensaje: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  inner: { padding: 20, paddingBottom: 40, gap: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroText: { flex: 1, gap: 4 },
  titulo: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13 },
  mapBox: { height: 300, borderRadius: 12, overflow: 'hidden' },
  card: { borderWidth: 1.2, borderRadius: 12, padding: 14, gap: 10 },
  cardTitulo: { fontSize: 15, fontWeight: '700' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex1: { flex: 1 },
})
