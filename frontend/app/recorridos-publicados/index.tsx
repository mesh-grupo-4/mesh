import { Stack, useFocusEffect, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useCopilot } from 'react-native-copilot'
import { Feather } from '@expo/vector-icons'

import { Chip, ChipRow, TopBar, useTheme, ActivityTile } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_RECORRIDOS_PUBLICADOS } from '@/components/ayuda/contenidoAyuda'
import { formatDurationHm, formatKm } from '@/lib/format'
import { meshError } from '@/lib/meshAlert'
import { buscarLugares, type LugarHit } from '@/lib/nominatim'
import {
  listarRecorridosPublicados,
  textoValoracion,
  type RecorridoComunidadApi,
} from '@/lib/recorridosPublicadosApi'
import { formatearEnArg } from '@/lib/tiempoArg'
import type { TipoActividadApi } from '@/lib/viajesApi'

const FILTROS: { id: TipoActividadApi | null; label: string }[] = [
  { id: null, label: 'Todos' },
  { id: 'moto', label: 'Moto' },
  { id: 'bici', label: 'Bici' },
  { id: 'running', label: 'Running' },
  { id: 'trekking', label: 'Trekking' },
  { id: 'otro', label: 'Otro' },
]

/** SCRUM-62: radios ofrecidos para la zona (el backend acepta de 1 a 200 km). */
const RADIOS_KM = [10, 25, 50, 100] as const

type ModoZona = 'todas' | 'cerca' | 'lugar'
type Zona = { lat: number; lng: number; etiqueta: string }

export default function RecorridosPublicadosScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { start } = useCopilot()
  const [filtro, setFiltro] = useState<TipoActividadApi | null>(null)
  const [modoZona, setModoZona] = useState<ModoZona>('todas')
  const [zona, setZona] = useState<Zona | null>(null)
  const [radioKm, setRadioKm] = useState<number>(25)
  const [ubicando, setUbicando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<LugarHit[]>([])
  const [recorridos, setRecorridos] = useState<RecorridoComunidadApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(
    async (esRefresh = false) => {
      if (esRefresh) setRefreshing(true)
      else setCargando(true)
      setError(null)
      try {
        setRecorridos(
          await listarRecorridosPublicados({
            tipoActividad: filtro ?? undefined,
            zona: zona ? { lat: zona.lat, lng: zona.lng, radioKm } : undefined,
          })
        )
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los recorridos.')
      } finally {
        setCargando(false)
        setRefreshing(false)
      }
    },
    [filtro, zona, radioKm]
  )

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const verTodas = () => {
    setModoZona('todas')
    setZona(null)
    setResultados([])
  }

  const usarMiUbicacion = async () => {
    setModoZona('cerca')
    setResultados([])
    setUbicando(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        meshError('Ubicación', 'Necesitamos tu ubicación para mostrarte recorridos cerca tuyo.')
        verTodas()
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setZona({ lat: pos.coords.latitude, lng: pos.coords.longitude, etiqueta: 'tu ubicación' })
    } catch {
      meshError('Ubicación', 'No pudimos obtener tu ubicación. Probá elegir un lugar.')
      verTodas()
    } finally {
      setUbicando(false)
    }
  }

  const elegirLugar = () => {
    setModoZona('lugar')
    setZona(null)
  }

  const buscar = async () => {
    if (busqueda.trim().length < 3) return
    setBuscando(true)
    try {
      setResultados(await buscarLugares(busqueda))
    } catch (e) {
      meshError('Búsqueda', e instanceof Error ? e.message : 'No se pudo buscar el lugar.')
    } finally {
      setBuscando(false)
    }
  }

  const seleccionarLugar = (lugar: LugarHit) => {
    setZona({ lat: lugar.lat, lng: lugar.lng, etiqueta: lugar.nombre })
    setBusqueda(lugar.nombre)
    setResultados([])
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Recorridos de la comunidad"
        onBack={() => router.back()}
        bordered={false}
        onAyuda={() => start()}
      />

      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargar(true)}
            tintColor={theme.accent}
          />
        }
      >
        <PasoAyuda {...AYUDA_RECORRIDOS_PUBLICADOS[0]!}>
          <ChipRow>
            {FILTROS.map((f) => (
              <Chip key={f.label} active={filtro === f.id} onPress={() => setFiltro(f.id)}>
                {f.label}
              </Chip>
            ))}
          </ChipRow>
        </PasoAyuda>

        <PasoAyuda {...AYUDA_RECORRIDOS_PUBLICADOS[1]!}>
          <View style={styles.zona}>
            <ChipRow>
              <Chip icon="globe" active={modoZona === 'todas'} onPress={verTodas}>
                Cualquier lugar
              </Chip>
              <Chip
                icon="navigation"
                active={modoZona === 'cerca'}
                onPress={() => void usarMiUbicacion()}
              >
                Cerca mío
              </Chip>
              <Chip icon="map-pin" active={modoZona === 'lugar'} onPress={elegirLugar}>
                Elegir lugar
              </Chip>
            </ChipRow>

            {modoZona === 'lugar' ? (
              <View style={styles.buscador}>
                <View style={styles.buscadorFila}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="Ciudad o lugar (ej. Villa General Belgrano)"
                    placeholderTextColor={theme.textMute}
                    value={busqueda}
                    onChangeText={setBusqueda}
                    onSubmitEditing={() => void buscar()}
                    returnKeyType="search"
                    autoCorrect={false}
                  />
                  <Pressable
                    onPress={() => void buscar()}
                    accessibilityRole="button"
                    accessibilityLabel="Buscar lugar"
                    style={[styles.btnBuscar, { backgroundColor: theme.accent }]}
                  >
                    {buscando ? (
                      <ActivityIndicator color={theme.onAccent} size="small" />
                    ) : (
                      <Feather name="search" size={18} color={theme.onAccent} />
                    )}
                  </Pressable>
                </View>
                {resultados.map((lugar) => (
                  <Pressable
                    key={`${lugar.lat},${lugar.lng},${lugar.nombre}`}
                    onPress={() => seleccionarLugar(lugar)}
                    style={[
                      styles.resultado,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Feather name="map-pin" size={14} color={theme.textDim} />
                    <Text style={[styles.resultadoTexto, { color: theme.text }]} numberOfLines={2}>
                      {lugar.nombre}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {ubicando ? (
              <Text style={[styles.zonaTexto, { color: theme.textDim }]}>
                Buscando tu ubicación...
              </Text>
            ) : zona ? (
              <>
                <Text style={[styles.zonaTexto, { color: theme.textDim }]} numberOfLines={2}>
                  Recorridos que arrancan a menos de {radioKm} km de {zona.etiqueta}
                </Text>
                <ChipRow>
                  {RADIOS_KM.map((km) => (
                    <Chip key={km} active={radioKm === km} onPress={() => setRadioKm(km)}>
                      {`${km} km`}
                    </Chip>
                  ))}
                </ChipRow>
              </>
            ) : null}
          </View>
        </PasoAyuda>

        <PasoAyuda {...AYUDA_RECORRIDOS_PUBLICADOS[2]!}>
          <View style={styles.lista}>
            {cargando ? (
              <ActivityIndicator color={theme.accent} size="large" style={styles.spinner} />
            ) : error ? (
              <Text style={[styles.mensaje, { color: theme.danger }]}>{error}</Text>
            ) : recorridos.length === 0 ? (
              <Text style={[styles.mensaje, { color: theme.textMute }]}>
                {zona
                  ? 'No hay recorridos publicados que arranquen en esta zona. Probá con un radio mayor.'
                  : 'Todavía no hay recorridos publicados. Publicá uno desde el resumen de un viaje finalizado.'}
              </Text>
            ) : (
              recorridos.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() =>
                    router.push({
                      pathname: '/recorridos-publicados/[recorridoId]',
                      params: { recorridoId: r.id },
                    })
                  }
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <ActivityTile activity={r.tipo_actividad} size={44} />
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitulo, { color: theme.text }]} numberOfLines={1}>
                      {r.nombre?.trim() || 'Recorrido sin nombre'}
                    </Text>
                    <Text style={[styles.cardSub, { color: theme.textDim }]} numberOfLines={1}>
                      {formatKm(r.distancia_m)} · {formatDurationHm(r.tiempo_seg)}
                    </Text>
                    <Text style={[styles.cardSub, { color: theme.textMute }]} numberOfLines={1}>
                      {r.autor.nombre} ·{' '}
                      {formatearEnArg(r.publicado_at, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </Text>
                    <View style={styles.valoracionFila}>
                      <Feather
                        name="thumbs-up"
                        size={13}
                        color={r.valoracion.total > 0 ? theme.accent : theme.textMute}
                      />
                      <Text
                        style={[
                          styles.cardSub,
                          { color: r.valoracion.total > 0 ? theme.textDim : theme.textMute },
                        ]}
                        numberOfLines={1}
                      >
                        {textoValoracion(r.valoracion)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </PasoAyuda>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 20, paddingBottom: 40, gap: 12 },
  zona: { gap: 10 },
  zonaTexto: { fontSize: 13, lineHeight: 18 },
  buscador: { gap: 6 },
  buscadorFila: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  btnBuscar: {
    width: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultadoTexto: { flex: 1, fontSize: 14 },
  lista: { gap: 12 },
  spinner: { marginTop: 48 },
  mensaje: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.2,
  },
  cardInfo: { flex: 1, gap: 2 },
  cardTitulo: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 13 },
  valoracionFila: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
})
