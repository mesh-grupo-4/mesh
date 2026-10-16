import { StyleSheet, Text, View } from 'react-native'

import { colorFromName, inicialesDe } from '@/components/AvatarFallback'
import type { MemberLocation } from '@/hooks/useLiveLocations'

/**
 * Marcador de integrante: avatar con iniciales, anillo de 2px (rojo si hay
 * posible incidente, ámbar si está detenido, verde si soy yo) y badge "II"/"!"
 * cuando corresponde. Opacidad reducida si la posición quedó vieja.
 *
 * Tamaño compacto para no tapar el recorrido cuando hay varios participantes.
 */
const MARKER_BOX = 34
const AVATAR_SIZE = 26
const RING_WIDTH = 2
const BADGE_SIZE = 12

type Props = { member: MemberLocation; isMe: boolean }

/** Clave de aspecto: cambia solo cuando cambia algo visible del marcador. */
export function memberMarkerKey({ member, isMe }: Props): string {
  return [member.nombre, member.estado, member.isStale ? 1 : 0, isMe ? 1 : 0].join('|')
}

export function MemberMarker({ member, isMe }: Props) {
  const detenido = member.estado === 'detenido_voluntario'
  const incidente = member.estado === 'posible_incidente'
  const ringColor = incidente ? '#dc2626' : detenido ? '#f59e0b' : isMe ? '#15803d' : 'transparent'

  return (
    <View style={[styles.box, { opacity: member.isStale ? 0.45 : 1 }]}>
      <View style={[styles.anillo, { borderColor: ringColor }]}>
        <View style={[styles.avatar, { backgroundColor: colorFromName(member.nombre) }]}>
          <Text style={styles.iniciales}>{inicialesDe(member.nombre)}</Text>
        </View>
      </View>
      {detenido || incidente ? (
        <View style={[styles.badge, { backgroundColor: incidente ? '#dc2626' : '#f59e0b' }]}>
          <Text style={styles.badgeTxt}>{incidente ? '!' : 'II'}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: MARKER_BOX, height: MARKER_BOX, alignItems: 'center', justifyContent: 'center' },
  anillo: {
    width: AVATAR_SIZE + RING_WIDTH * 2,
    height: AVATAR_SIZE + RING_WIDTH * 2,
    borderRadius: (AVATAR_SIZE + RING_WIDTH * 2) / 2,
    borderWidth: RING_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciales: { color: '#fff', fontWeight: '700', fontSize: Math.round(AVATAR_SIZE * 0.38) },
  badge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 1,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 6, fontWeight: '900' },
})
