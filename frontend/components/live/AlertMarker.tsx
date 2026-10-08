import { StyleSheet, Text, View } from 'react-native'

import { mensajeAlertaVisible, metaTipoAlerta, type AlertaApi } from '@/lib/alertasApi'

const MARKER_SIZE = 36

/** Marcador de alerta activa en el mapa en vivo (RN-034: ubicación del desvío). */
export function AlertMarker({ alerta }: { alerta: AlertaApi }) {
  const meta = metaTipoAlerta(alerta.tipo)
  return (
    <View style={[styles.circulo, { backgroundColor: meta.color }]}>
      <Text style={styles.emoji}>{meta.emoji}</Text>
    </View>
  )
}

export function alertMarkerKey(alerta: AlertaApi): string {
  return `${alerta.tipo}|${metaTipoAlerta(alerta.tipo).color}`
}

export function alertMarkerPopup(alerta: AlertaApi): { title: string; description?: string } {
  const meta = metaTipoAlerta(alerta.tipo)
  const detalle = [
    mensajeAlertaVisible(alerta.mensaje),
    alerta.creada_por_nombre,
    alerta.origen === 'sistema' ? 'Alerta automática' : null,
  ].filter(Boolean)
  return { title: meta.label, description: detalle.length ? detalle.join(' · ') : undefined }
}

const styles = StyleSheet.create({
  circulo: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18, lineHeight: 22 },
})
