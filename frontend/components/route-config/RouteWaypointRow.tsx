import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { buscarLugares, type NominatimHit } from '@/lib/nominatim'

import { StopCategoryPicker } from './StopCategoryPicker'
import { labelTipoWaypoint, type RouteWaypoint, type StopCategory } from './routeTypes'

type Props = {
  waypoint: RouteWaypoint
  stopIndex?: number
  onUpdate: (
    id: string,
    patch: Partial<Pick<RouteWaypoint, 'lat' | 'lon' | 'name' | 'category'>>
  ) => void
  onRemove?: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onSuggestionsOpenChange?: (open: boolean) => void
  onPickOnMap: () => void
  mapPickMode?: boolean
}

export function RouteWaypointRow({
  waypoint,
  stopIndex,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onSuggestionsOpenChange,
  onPickOnMap,
  mapPickMode = false,
}: Props) {
  const theme = useTheme()
  const [query, setQuery] = useState(waypoint.name)
  const [debounced, setDebounced] = useState(waypoint.name)
  const [focused, setFocused] = useState(false)
  const [hits, setHits] = useState<NominatimHit[]>([])
  const [buscando, setBuscando] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const selectingRef = useRef(false)
  const inputRef = useRef<TextInput>(null)

  const suggestionsVisibles = focused && debounced.length >= 3

  useEffect(() => {
    onSuggestionsOpenChange?.(suggestionsVisibles)
  }, [suggestionsVisibles, onSuggestionsOpenChange])

  useEffect(() => {
    setQuery(waypoint.name)
  }, [waypoint.name])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 500)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    let cancel = false
    async function run() {
      if (!focused || debounced.length < 3) {
        setHits([])
        setSearchError(null)
        return
      }
      setBuscando(true)
      setSearchError(null)
      try {
        const r = await buscarLugares(debounced)
        if (!cancel) setHits(r)
      } catch {
        if (!cancel) {
          setHits([])
          setSearchError('Sin conexión. Probá seleccionar en el mapa.')
        }
      } finally {
        if (!cancel) setBuscando(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [debounced, focused])

  const placeholder =
    waypoint.type === 'ORIGIN'
      ? 'Buscar origen'
      : waypoint.type === 'DESTINATION'
        ? 'Buscar destino'
        : `Parada ${(stopIndex ?? 0) + 1}`

  const label =
    waypoint.type === 'STOP'
      ? `Parada ${(stopIndex ?? 0) + 1}`
      : labelTipoWaypoint(waypoint.type)

  const onSelectHit = (item: NominatimHit) => {
    const lat = Number(item.lat)
    const lon = Number(item.lon)
    if (Number.isNaN(lat) || Number.isNaN(lon)) return
    const name = item.display_name
    setQuery(name)
    setHits([])
    setFocused(false)
    inputRef.current?.blur()
    Keyboard.dismiss()
    onUpdate(waypoint.id, { lat, lon, name })
  }

  const cerrarSugerencias = () => {
    setFocused(false)
    setHits([])
    setSearchError(null)
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.textDim }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => {
              if (selectingRef.current) {
                selectingRef.current = false
                return
              }
              cerrarSugerencias()
            }, 250)
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.textMute}
          style={[
            styles.input,
            {
              backgroundColor: theme.surface2,
              borderColor: focused ? theme.accent : theme.border,
              color: theme.text,
            },
          ]}
          autoCorrect={false}
          autoCapitalize="none"
          editable={!mapPickMode}
        />
        {waypoint.type === 'STOP' && onRemove ? (
          <Pressable
            onPress={() => onRemove(waypoint.id)}
            hitSlop={8}
            style={[styles.removeBtn, { backgroundColor: theme.dangerWeak }]}
          >
            <Text style={[styles.removeTxt, { color: theme.danger }]}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={[styles.mapPickBtn, mapPickMode && styles.mapPickBtnActive]}
        onPress={onPickOnMap}
        disabled={mapPickMode}
      >
        <Ionicons
          name="map-outline"
          size={16}
          color={mapPickMode ? theme.textMute : theme.accent}
        />
        <Text
          style={[
            styles.mapPickTxt,
            { color: mapPickMode ? theme.textMute : theme.accent },
          ]}
        >
          Seleccionar en mapa
        </Text>
      </Pressable>

      {waypoint.type === 'STOP' ? (
        <StopCategoryPicker
          value={(waypoint.category ?? 'otro') as StopCategory}
          onChange={(category) => onUpdate(waypoint.id, { category })}
        />
      ) : null}

      {waypoint.type === 'STOP' && (onMoveUp || onMoveDown) ? (
        <View style={styles.reorderRow}>
          {onMoveUp ? (
            <Pressable
              onPress={() => onMoveUp(waypoint.id)}
              disabled={!canMoveUp}
              style={[
                styles.reorderBtn,
                { backgroundColor: theme.surface3 },
                !canMoveUp && styles.reorderBtnOff,
              ]}
            >
              <Text style={[styles.reorderTxt, { color: theme.text }]}>↑</Text>
            </Pressable>
          ) : null}
          {onMoveDown ? (
            <Pressable
              onPress={() => onMoveDown(waypoint.id)}
              disabled={!canMoveDown}
              style={[
                styles.reorderBtn,
                { backgroundColor: theme.surface3 },
                !canMoveDown && styles.reorderBtnOff,
              ]}
            >
              <Text style={[styles.reorderTxt, { color: theme.text }]}>↓</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {suggestionsVisibles ? (
        <View
          style={[
            styles.suggestions,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {buscando ? (
            <ActivityIndicator size="small" color={theme.accent} style={styles.loader} />
          ) : searchError ? (
            <Text style={[styles.errorHits, { color: theme.danger }]}>{searchError}</Text>
          ) : hits.length === 0 ? (
            <Text style={[styles.noHits, { color: theme.textDim }]}>
              Sin resultados. Probá otro texto o el mapa.
            </Text>
          ) : (
            hits.map((item, i) => (
              <Pressable
                key={`${item.lat},${item.lon}-${i}`}
                style={[styles.hitRow, { borderColor: theme.border }]}
                onPressIn={() => {
                  selectingRef.current = true
                }}
                onPress={() => onSelectHit(item)}
              >
                <Text style={[styles.hitText, { color: theme.text }]} numberOfLines={2}>
                  {item.display_name}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTxt: {
    fontSize: 16,
    fontWeight: '700',
  },
  mapPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  mapPickBtnActive: {
    opacity: 0.5,
  },
  mapPickTxt: {
    fontSize: 14,
    fontWeight: '600',
  },
  reorderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  reorderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reorderBtnOff: { opacity: 0.35 },
  reorderTxt: { fontSize: 16, fontWeight: '700' },
  suggestions: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    maxHeight: 180,
  },
  loader: { padding: 12 },
  noHits: { padding: 12, fontSize: 14 },
  errorHits: { padding: 12, fontSize: 14 },
  hitRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hitText: { fontSize: 14 },
})
