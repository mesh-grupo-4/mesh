import { Feather } from '@expo/vector-icons'
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AjustesViajeCards } from '@/components/AjustesViajeCards'
import { useTheme } from '@/components/MeshUI'
import type { ViajeActualizadoApi, ViajeDetalleApi } from '@/lib/viajesApi'

type Props = {
  visible: boolean
  viaje: ViajeDetalleApi
  userId: string
  onActualizado: (actualizado: ViajeActualizadoApi) => void
  onCerrar: () => void
}

/** Ajustes del viaje en curso, para el líder: corrige parámetros que disparan alertas de más. */
export function AjustesViajeSheet({ visible, viaje, userId, onActualizado, onCerrar }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityLabel="Cerrar ajustes" />
        <View
          style={[
            styles.hoja,
            { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <View style={styles.encabezado}>
            <Text style={[styles.titulo, { color: theme.text }]}>Ajustes del viaje</Text>
            <Pressable onPress={onCerrar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Feather name="x" size={24} color={theme.textDim} />
            </Pressable>
          </View>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Los cambios aplican al instante para todo el grupo.
          </Text>
          <ScrollView contentContainerStyle={styles.contenido}>
            <AjustesViajeCards viaje={viaje} userId={userId} onActualizado={onActualizado} inicialAbierto />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  hoja: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 3, marginBottom: 12 },
  contenido: { paddingBottom: 8 },
})
