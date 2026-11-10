import { StyleSheet, View } from 'react-native'

import { colorFromName } from '@/components/AvatarFallback'
import type { MemberLocation } from '@/hooks/useLiveLocations'

/**
 * Flecha de rumbo de un integrante: un triángulo apenas por fuera del anillo
 * del avatar. Va en un marcador aparte y plano (`flat`), para que el avatar y
 * sus iniciales no giren y para que la flecha siga apuntando bien con el mapa rotado.
 *
 * Se gira acá adentro y no con la `rotation` del marcador porque, en Android con
 * la nueva arquitectura, react-native-maps 1.29 solo aplica esa prop al crearlo:
 * la flecha quedaba fija en el primer rumbo.
 */
export const RUMBO_BOX = 48
const PUNTA_ANCHO = 7
const PUNTA_ALTO = 9
const BORDE = 2

/** Color de "vos", el mismo que el anillo de `MemberMarker`. */
const COLOR_PROPIO = '#15803d'

/**
 * La flecha solo tiene sentido si la persona se está moviendo y la posición es
 * fresca. Detenida, el rumbo es el último conocido y ya no dice nada.
 */
export function mostrarRumbo(member: MemberLocation): member is MemberLocation & { rumbo: number } {
  return member.rumbo != null && member.estado === 'en_movimiento' && !member.isStale
}

export function rumboColor(member: MemberLocation, isMe: boolean): string {
  return isMe ? COLOR_PROPIO : colorFromName(member.nombre)
}

/**
 * Se redondea a pasos de 10° para no redibujar el marcador por cada décima.
 */
export function rumboEnPasos(rumbo: number): number {
  return (Math.round(rumbo / 10) * 10) % 360
}

export function RumboMarker({ color, giro = 0 }: { color: string; giro?: number }) {
  return (
    <View style={[styles.box, giro ? { transform: [{ rotate: `${giro}deg` }] } : null]} pointerEvents="none">
      {/* Contorno blanco detrás, para que se lea sobre cualquier capa del mapa. */}
      <View
        style={[
          styles.triangulo,
          {
            top: 0,
            borderLeftWidth: PUNTA_ANCHO + BORDE,
            borderRightWidth: PUNTA_ANCHO + BORDE,
            borderBottomWidth: PUNTA_ALTO + BORDE * 1.5,
            borderBottomColor: '#ffffff',
          },
        ]}
      />
      <View
        style={[
          styles.triangulo,
          {
            top: BORDE,
            borderLeftWidth: PUNTA_ANCHO,
            borderRightWidth: PUNTA_ANCHO,
            borderBottomWidth: PUNTA_ALTO,
            borderBottomColor: color,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: RUMBO_BOX, height: RUMBO_BOX, alignItems: 'center' },
  triangulo: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderStyle: 'solid',
  },
})
