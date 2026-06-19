import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Marker } from 'react-native-maps'

import { AvatarFallback } from '@/components/AvatarFallback'
import type { MemberLocation } from '@/hooks/useLiveLocations'

type Props = {
  member: MemberLocation
  isMe?: boolean
}

export function MemberMapMarker({ member, isMe = false }: Props) {
  const [tracks, setTracks] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setTracks(false), 500)
    return () => clearTimeout(id)
  }, [])

  return (
    <Marker
      coordinate={{ latitude: member.lat, longitude: member.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
    >
      <View style={[styles.wrap, isMe && styles.meRing]}>
        <AvatarFallback nombre={member.nombre} size={36} />
      </View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meRing: {
    borderWidth: 3,
    borderColor: '#15803d',
    borderRadius: 24,
    padding: 2,
  },
})
