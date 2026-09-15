import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native'

import { AvisoUbicacion } from '@/components/AvisoUbicacion'
import { Btn, useTheme } from '@/components/MeshUI'
import type { TripStartedPayload } from '@/lib/tripBroadcast'

type Props = {
  visible: boolean
  trip: TripStartedPayload | null
  joining: boolean
  onJoin: () => void
}

export function TripStartedModal({ visible, trip, joining, onJoin }: Props) {
  const theme = useTheme()
  const nombreViaje = trip?.nombre?.trim() || 'el viaje'

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.contenedor, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: theme.accentWeak }]}>
            <Text style={[styles.icon, { color: theme.accent }]}>!</Text>
          </View>

          <Text style={[styles.titulo, { color: theme.text }]}>¡El viaje ha comenzado!</Text>

          <Text style={[styles.descripcion, { color: theme.textDim }]}>
            ¡El viaje {nombreViaje} ha comenzado! El líder ha iniciado la ruta. ¿Estás listo para unirte?
          </Text>

          {/* RN-110: unirse enciende el tracking, así que este también es un punto
              de consentimiento y tiene que explicar el uso antes de pedir el permiso. */}
          <ScrollView style={styles.aviso} contentContainerStyle={styles.avisoContenido}>
            <AvisoUbicacion />
          </ScrollView>

          <Btn variant="primary" block onPress={onJoin} loading={joining} disabled={joining}>
            Acepto y me uno al recorrido
          </Btn>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  contenedor: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  icon: {
    fontSize: 28,
    fontWeight: '800',
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  descripcion: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  // Con tipografía grande (RN-052) los cuatro puntos del aviso no entran en
  // pantallas chicas: el scroll evita que el botón de unirse quede fuera de vista.
  aviso: {
    maxHeight: 220,
  },
  avisoContenido: {
    paddingVertical: 4,
  },
})
