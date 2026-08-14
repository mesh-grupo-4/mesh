import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Marker } from 'react-native-maps'

import { AvatarFallback } from '@/components/AvatarFallback'
import type { MemberLocation } from '@/hooks/useLiveLocations'

type Props = {
  member: MemberLocation
  isMe?: boolean
}

/**
 * react-native-maps rasteriza la vista custom del marcador a un bitmap. Si el
 * contenedor no tiene dimensiones resueltas, la captura sale recortada; por eso
 * la caja mide fijo y el anillo se dibuja adentro en vez de agrandarla.
 */
const AVATAR_SIZE = 36
const RING_WIDTH = 3
const MARKER_BOX = 48

export function MemberMapMarker({ member, isMe = false }: Props) {
  const [tracks, setTracks] = useState(true)

  // Cualquier cosa que cambie el pixel del marcador tiene que reactivar la captura:
  // el color y las iniciales dependen del nombre, y la opacidad de isStale.
  useEffect(() => {
    setTracks(true)
    const id = setTimeout(() => setTracks(false), 500)
    return () => clearTimeout(id)
  }, [member.isStale, member.nombre, isMe])

  return (
    <Marker
      coordinate={{ latitude: member.lat, longitude: member.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
    >
      <View style={[styles.box, member.isStale && styles.stale]}>
        <View style={[styles.ring, isMe && styles.meRing]}>
          <AvatarFallback nombre={member.nombre} size={AVATAR_SIZE} />
        </View>
      </View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  box: {
    width: MARKER_BOX,
    height: MARKER_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    // Borde transparente del mismo grosor que `meRing`, para que el avatar mida
    // igual con y sin anillo y ningún marcador se salga de la caja.
    borderWidth: RING_WIDTH,
    borderColor: 'transparent',
    borderRadius: (AVATAR_SIZE + RING_WIDTH * 2) / 2,
  },
  meRing: {
    borderColor: '#15803d',
  },
  stale: {
    opacity: 0.45,
  },
})
