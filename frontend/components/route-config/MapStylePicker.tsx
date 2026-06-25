import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/components/MeshUI'

import { MAP_STYLES, type MapStyleId } from './mapStyles'

type Props = {
  value: MapStyleId
  onChange: (id: MapStyleId) => void
  /** Offset desde safe area top; default 72 (debajo del TopBar). */
  topOffset?: number
}

export function MapStylePicker({ value, onChange, topOffset = 72 }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [abierto, setAbierto] = useState(false)
  const actual = MAP_STYLES.find((s) => s.id === value) ?? MAP_STYLES[0]

  return (
    <View style={[styles.wrap, { top: insets.top + topOffset }]} pointerEvents="box-none">
      {abierto ? (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          {MAP_STYLES.map((style) => {
            const activo = style.id === value
            return (
              <Pressable
                key={style.id}
                style={[styles.opcion, activo && { backgroundColor: theme.accentWeak }]}
                onPress={() => {
                  onChange(style.id)
                  setAbierto(false)
                }}
              >
                <Feather
                  name={style.icon}
                  size={18}
                  color={activo ? theme.accent : theme.textDim}
                />
                <Text
                  style={[
                    styles.opcionTxt,
                    { color: theme.textDim },
                    activo && { color: theme.accent, fontWeight: '700' },
                  ]}
                >
                  {style.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      <Pressable
        style={[
          styles.btn,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
        onPress={() => setAbierto((v) => !v)}
        accessibilityLabel="Cambiar estilo del mapa"
      >
        <Feather name={actual.icon} size={20} color={theme.text} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
    alignItems: 'flex-end',
    gap: 8,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    minWidth: 140,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  opcionTxt: {
    fontSize: 15,
    fontWeight: '500',
  },
})
