import { useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'

import { MAP_STYLES, type MapStyleId } from './mapStyles'

type Props = {
  value: MapStyleId
  onChange: (id: MapStyleId) => void
  /** Distancia desde arriba de la pantalla a la que se abre el menú. */
  menuTop: number
}

/** Botón de capas para una barra superior: abre el menú para elegir la vista del mapa. */
export function SelectorCapaMapa({ value, onChange, menuTop }: Props) {
  const theme = useTheme()
  const [abierto, setAbierto] = useState(false)
  const actual = MAP_STYLES.find((s) => s.id === value) ?? MAP_STYLES[0]!
  const cerrar = () => setAbierto(false)

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cambiar vista del mapa. Actual: ${actual.label}`}
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [
          styles.boton,
          {
            backgroundColor: pressed ? theme.surface2 : theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <Feather name="layers" size={22} color={theme.accent} />
      </Pressable>

      {/* En un Modal porque en Android un menú que sobresale de la barra no recibe toques. */}
      <Modal
        visible={abierto}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={cerrar}
      >
        <Pressable
          feedback={false}
          accessibilityLabel="Cerrar menú de vista del mapa"
          onPress={cerrar}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityRole="menu"
          style={[
            styles.menu,
            { top: menuTop, backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {MAP_STYLES.map((estilo) => {
            const elegido = estilo.id === value
            return (
              <Pressable
                key={estilo.id}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: elegido }}
                onPress={() => {
                  onChange(estilo.id)
                  cerrar()
                }}
                style={({ pressed }) => [
                  styles.fila,
                  elegido && { backgroundColor: theme.accentWeak },
                  pressed && !elegido && { backgroundColor: theme.surface2 },
                ]}
              >
                <Feather
                  name={estilo.icon}
                  size={20}
                  color={elegido ? theme.accent : theme.textDim}
                />
                <Text style={[styles.etiqueta, { color: theme.text }]}>{estilo.label}</Text>
                {elegido && <Feather name="check" size={20} color={theme.accent} />}
              </Pressable>
            )
          })}
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  boton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    right: 16,
    width: 200,
    padding: 6,
    gap: 2,
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.28)',
  },
  fila: {
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  etiqueta: { flex: 1, fontSize: 16, fontWeight: '600' },
})
