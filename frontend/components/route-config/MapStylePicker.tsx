import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MAP_STYLES, type MapStyleId } from './mapStyles'

type Props = {
  value: MapStyleId
  onChange: (id: MapStyleId) => void
}

export function MapStylePicker({ value, onChange }: Props) {
  const insets = useSafeAreaInsets()
  const [abierto, setAbierto] = useState(false)
  const actual = MAP_STYLES.find((s) => s.id === value) ?? MAP_STYLES[0]

  return (
    <View style={[styles.wrap, { top: insets.top + 56 }]} pointerEvents="box-none">
      {abierto ? (
        <View style={styles.panel}>
          {MAP_STYLES.map((style) => {
            const activo = style.id === value
            return (
              <Pressable
                key={style.id}
                style={[styles.opcion, activo && styles.opcionActiva]}
                onPress={() => {
                  onChange(style.id)
                  setAbierto(false)
                }}
              >
                <Feather
                  name={style.icon}
                  size={18}
                  color={activo ? '#2563eb' : '#374151'}
                />
                <Text style={[styles.opcionTxt, activo && styles.opcionTxtActiva]}>
                  {style.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      <Pressable
        style={styles.btn}
        onPress={() => setAbierto((v) => !v)}
        accessibilityLabel="Cambiar estilo del mapa"
      >
        <Feather name={actual.icon} size={20} color="#111827" />
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
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
  opcionActiva: {
    backgroundColor: '#eff6ff',
  },
  opcionTxt: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  opcionTxtActiva: {
    color: '#2563eb',
    fontWeight: '700',
  },
})
