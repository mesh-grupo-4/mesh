import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { Feather, Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Btn, useTheme } from '@/components/MeshUI'
import { MeshMapView, type LatLng, type MeshMapViewHandle } from '@/components/maps/MeshMapView'
import { getMapStyle } from '@/components/route-config/mapStyles'
import { REGION_FALLBACK } from '@/components/route-config/routeTypes'
import { useCapaMapa } from '@/hooks/useCapaMapa'
import { useSugerenciasLugares } from '@/hooks/useSugerenciasLugares'
import { reverseGeocode, type LugarSugerencia } from '@/lib/nominatim'
import type { PuntoDestino } from '@/lib/rutaRapida'

type Props = {
  titulo: string
  /** Dónde está parado el usuario: centra el mapa al llegar. */
  origen: LatLng | null
  onConfirm: (destino: PuntoDestino) => void
  /** Si se pasa, muestra "Saltear" (el destino es opcional). */
  onSkip?: () => void
  /** Si se pasa, muestra una X para cerrar sin elegir. */
  onCancel?: () => void
  guardando?: boolean
}

/** Mapa a pantalla completa con un pin fijo al centro: se mueve el mapa o se busca un lugar. */
export function DestinoPicker({ titulo, origen, onConfirm, onSkip, onCancel, guardando = false }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [capaMapa] = useCapaMapa()
  const mapRef = useRef<MeshMapViewHandle>(null)
  const centradoRef = useRef(false)
  const [centro, setCentro] = useState<LatLng | null>(origen)
  const [query, setQuery] = useState('')
  const {
    sugerencias: resultados,
    buscando,
    error: errorBusqueda,
    resolver,
  } = useSugerenciasLugares(query, {
    cerca: origen ? { lat: origen.latitude, lng: origen.longitude } : null,
  })
  /** Nombre del lugar buscado; se descarta si el usuario mueve el mapa a mano. */
  const [nombreElegido, setNombreElegido] = useState<string | null>(null)
  const [resolviendo, setResolviendo] = useState(false)

  useEffect(() => {
    if (origen && !centradoRef.current) {
      centradoRef.current = true
      setCentro(origen)
      mapRef.current?.animateTo(origen, 15)
    }
  }, [origen])

  const elegirResultado = async (sugerencia: LugarSugerencia) => {
    Keyboard.dismiss()
    const hit = await resolver(sugerencia)
    if (!hit) return
    const punto = { latitude: hit.lat, longitude: hit.lng }
    setNombreElegido(hit.nombre)
    setCentro(punto)
    setQuery('')
    mapRef.current?.animateTo(punto, 15)
  }

  const confirmar = async () => {
    if (!centro) return
    setResolviendo(true)
    try {
      const nombre =
        nombreElegido ?? (await reverseGeocode(centro.latitude, centro.longitude).catch(() => 'Destino'))
      onConfirm({ lat: centro.latitude, lng: centro.longitude, nombre })
    } finally {
      setResolviendo(false)
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <MeshMapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialCenter={origen ?? { latitude: REGION_FALLBACK.latitude, longitude: REGION_FALLBACK.longitude }}
        initialZoom={origen ? 15 : 12}
        mapStyle={getMapStyle(capaMapa)}
        userLocation={origen}
        onRegionChangeComplete={setCentro}
        onUserDrag={() => setNombreElegido(null)}
      />

      <View style={styles.pinWrap} pointerEvents="none">
        <Ionicons name="location" size={46} color={theme.danger} style={styles.pinIcon} />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.headerRow}>
          {onCancel ? (
            <Pressable
              onPress={onCancel}
              hitSlop={10}
              accessibilityLabel="Cerrar"
              style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>
          ) : (
            <View style={styles.iconBtnPlaceholder} />
          )}
          <Text
            style={[styles.titulo, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            numberOfLines={1}
          >
            {titulo}
          </Text>
          {onSkip ? (
            <Btn variant="secondary" size="sm" onPress={onSkip} disabled={guardando}>
              Saltear
            </Btn>
          ) : (
            <View style={styles.iconBtnPlaceholder} />
          )}
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Feather name="search" size={18} color={theme.textMute} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar un lugar"
            placeholderTextColor={theme.textMute}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
          />
          {buscando && <ActivityIndicator size="small" color={theme.textMute} />}
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Feather name="x-circle" size={18} color={theme.textMute} />
            </Pressable>
          )}
        </View>

        {errorBusqueda ? (
          <View style={[styles.resultados, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.errorBusqueda, { color: theme.danger }]}>{errorBusqueda}</Text>
          </View>
        ) : null}

        {!errorBusqueda && resultados.length > 0 && (
          <View style={[styles.resultados, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {resultados.map((r, i) => (
              <Pressable
                key={r.placeId ?? `${r.lat},${r.lng},${i}`}
                onPress={() => void elegirResultado(r)}
                style={({ pressed }) => [
                  styles.resultado,
                  { borderTopColor: theme.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
                  pressed && { backgroundColor: theme.surface2 },
                ]}
              >
                <Feather name="map-pin" size={16} color={theme.accent} />
                <Text style={[styles.resultadoTexto, { color: theme.text }]} numberOfLines={2}>
                  {r.nombre}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        {nombreElegido && (
          <Text
            style={[styles.elegido, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            numberOfLines={2}
          >
            {nombreElegido}
          </Text>
        )}
        <Btn
          block
          size="xl"
          icon="flag"
          onPress={() => void confirmar()}
          disabled={!centro || guardando}
          loading={resolviendo || guardando}
        >
          Ir a este destino
        </Btn>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pinWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // La punta del ícono queda en el centro del mapa.
  pinIcon: { marginBottom: 46 },
  top: { position: 'absolute', left: 16, right: 16, top: 0, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPlaceholder: { width: 44 },
  titulo: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 50,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 12 },
  resultados: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  resultadoTexto: { flex: 1, fontSize: 15 },
  errorBusqueda: { padding: 14, fontSize: 15 },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 0, gap: 10 },
  elegido: {
    fontSize: 15,
    fontWeight: '600',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    textAlign: 'center',
  },
})
