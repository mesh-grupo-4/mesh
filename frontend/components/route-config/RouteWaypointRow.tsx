import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native'
import { Pressable } from '@/components/Pressable'

import { useTheme } from '@/components/MeshUI'
import { useSugerenciasLugares } from '@/hooks/useSugerenciasLugares'
import { MIN_LETRAS_SUGERENCIAS, type LugarSugerencia } from '@/lib/nominatim'

import { ManijaArrastre } from './ParadasReordenables'
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
  onSuggestionsOpenChange?: (open: boolean) => void
  onInputFocus?: () => void
  onPickOnMap: () => void
  mapPickMode?: boolean
  InputComponent?: ComponentType<TextInputProps>
}

export function RouteWaypointRow({
  waypoint,
  stopIndex,
  onUpdate,
  onRemove,
  onSuggestionsOpenChange,
  onInputFocus,
  onPickOnMap,
  mapPickMode = false,
  InputComponent = TextInput,
}: Props) {
  const theme = useTheme()
  const [query, setQuery] = useState(waypoint.name)
  const [focused, setFocused] = useState(false)
  const {
    sugerencias: hits,
    buscando,
    error: searchError,
    sinResultados,
    resolver,
  } = useSugerenciasLugares(query, { activo: focused })
  const selectingRef = useRef(false)
  const inputRef = useRef<TextInput | null>(null)

  const suggestionsVisibles = focused && query.trim().length >= MIN_LETRAS_SUGERENCIAS

  useEffect(() => {
    onSuggestionsOpenChange?.(suggestionsVisibles)
  }, [suggestionsVisibles, onSuggestionsOpenChange])

  useEffect(() => {
    setQuery(waypoint.name)
  }, [waypoint.name])

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

  const onSelectHit = async (sugerencia: LugarSugerencia) => {
    const item = await resolver(sugerencia)
    if (!item || Number.isNaN(item.lat) || Number.isNaN(item.lng)) return
    setQuery(item.nombre)
    setFocused(false)
    inputRef.current?.blur()
    Keyboard.dismiss()
    onUpdate(waypoint.id, { lat: item.lat, lon: item.lng, name: item.nombre })
  }

  // Al perder el foco el hook deja de buscar y vacía sugerencias y error.
  const cerrarSugerencias = () => setFocused(false)

  const esParada = waypoint.type === 'STOP'

  return (
    <View
      style={[
        styles.wrap,
        esParada && [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }],
      ]}
    >
      {esParada ? (
        <ManijaArrastre>
          <View style={styles.cardHeader} accessibilityHint="Mantené presionado y arrastrá para cambiar el orden">
            <Ionicons name="reorder-three" size={20} color={theme.textMute} />
            <Text style={[styles.label, styles.labelCard, { color: theme.textDim }]}>{label}</Text>
            <Text style={[styles.dragHint, { color: theme.textMute }]}>Mantené para mover</Text>
          </View>
        </ManijaArrastre>
      ) : (
        <Text style={[styles.label, { color: theme.textDim }]}>{label}</Text>
      )}
      <View style={styles.inputRow}>
        <InputComponent
          {...({
            ref: inputRef,
            value: query,
            onChangeText: setQuery,
            onFocus: () => {
              setFocused(true)
              onInputFocus?.()
            },
            onBlur: () => {
              setTimeout(() => {
                if (selectingRef.current) {
                  selectingRef.current = false
                  return
                }
                cerrarSugerencias()
              }, 250)
            },
            placeholder,
            placeholderTextColor: theme.textMute,
            style: [
              styles.input,
              {
                backgroundColor: theme.surface2,
                borderColor: focused ? theme.accent : theme.border,
                color: theme.text,
              },
            ],
            autoCorrect: false,
            autoCapitalize: 'none',
            editable: !mapPickMode,
          } as TextInputProps)}
        />
        {waypoint.type === 'STOP' && onRemove ? (
          <Pressable
            onPress={() => onRemove(waypoint.id)}
            hitSlop={8}
            style={[styles.removeBtn, { backgroundColor: theme.dangerWeak }]}
          >
            <Ionicons name="close" size={18} color={theme.danger} />
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

      {suggestionsVisibles ? (
        <View
          style={[
            styles.suggestions,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {searchError ? (
            <Text style={[styles.errorHits, { color: theme.danger }]}>{searchError}</Text>
          ) : hits.length === 0 ? (
            sinResultados && !buscando ? (
              <Text style={[styles.noHits, { color: theme.textDim }]}>
                Sin resultados. Probá otro texto o el mapa.
              </Text>
            ) : (
              <ActivityIndicator size="small" color={theme.accent} style={styles.loader} />
            )
          ) : (
            // Las sugerencias anteriores quedan a la vista mientras llega la siguiente búsqueda.
            hits.map((item, i) => (
              <Pressable
                key={item.placeId ?? `${item.lat},${item.lng}-${i}`}
                style={[styles.hitRow, { borderColor: theme.border }]}
                onPressIn={() => {
                  selectingRef.current = true
                }}
                onPress={() => void onSelectHit(item)}
              >
                <Text style={[styles.hitText, { color: theme.text }]} numberOfLines={2}>
                  {item.nombre}
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
  card: {
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 10,
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
  },
  labelCard: {
    flex: 1,
    marginBottom: 0,
  },
  dragHint: {
    fontSize: 11,
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
