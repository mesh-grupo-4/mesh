import { useState, type ComponentProps } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import Colors from '@/constants/Colors'
import {
  elegirPreferenciaTema,
  usePreferenciaTema,
  type PreferenciaTema,
} from '@/lib/temaApp'

type Opcion = {
  id: PreferenciaTema
  etiqueta: string
  icono: ComponentProps<typeof Feather>['name']
}

const OPCIONES: Opcion[] = [
  { id: 'sistema', etiqueta: 'Igual que el teléfono', icono: 'smartphone' },
  { id: 'claro', etiqueta: 'Claro', icono: 'sun' },
  { id: 'oscuro', etiqueta: 'Oscuro', icono: 'moon' },
]

/** Botón de la barra superior que abre el menú para elegir el tema de la app. */
export function SelectorTema({ menuTop }: { menuTop: number }) {
  const theme = useTheme()
  const preferencia = usePreferenciaTema()
  const [abierto, setAbierto] = useState(false)
  const actual = OPCIONES.find((o) => o.id === preferencia) ?? OPCIONES[0]!
  const cerrar = () => setAbierto(false)

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cambiar tema. Actual: ${actual.etiqueta}`}
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [
          styles.boton,
          {
            backgroundColor: pressed ? theme.surface2 : theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        {/* El tema ya resuelto: con "Igual que el teléfono" refleja el modo del celular. */}
        <Feather name={theme === Colors.dark ? 'moon' : 'sun'} size={22} color={theme.accent} />
      </Pressable>

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
          accessibilityLabel="Cerrar menú de tema"
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
          {OPCIONES.map((opcion) => {
            const elegida = opcion.id === preferencia
            return (
              <Pressable
                key={opcion.id}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: elegida }}
                onPress={() => {
                  elegirPreferenciaTema(opcion.id)
                  cerrar()
                }}
                style={({ pressed }) => [
                  styles.fila,
                  elegida && { backgroundColor: theme.accentWeak },
                  pressed && !elegida && { backgroundColor: theme.surface2 },
                ]}
              >
                <Feather
                  name={opcion.icono}
                  size={20}
                  color={elegida ? theme.accent : theme.textDim}
                />
                <Text style={[styles.etiqueta, { color: theme.text }]}>{opcion.etiqueta}</Text>
                {elegida && <Feather name="check" size={20} color={theme.accent} />}
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
    width: 256,
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
