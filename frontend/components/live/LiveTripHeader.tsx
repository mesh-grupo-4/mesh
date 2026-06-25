import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/components/MeshUI'
import { formatDistanceShort, formatEtaLabel, type NextStopInfo } from '@/lib/geo/nextStop'

import { LiveMembersBar, type LiveMember } from './LiveMembersBar'

type Props = {
  tripName: string
  nextStop: NextStopInfo | null
  hasRoute: boolean
  members: LiveMember[]
  currentUserId: string
  onBack: () => void
}

export function LiveTripHeader({ tripName, nextStop, hasRoute, members, currentUserId, onBack }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [showEta, setShowEta] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setShowEta((v) => !v), 5000)
    return () => clearInterval(id)
  }, [])

  const etaLine = !hasRoute
    ? 'Sin ruta configurada'
    : nextStop
      ? `Próx. parada: ${nextStop.stop.name} · ${formatEtaLabel(nextStop.etaSec)} (${formatDistanceShort(nextStop.distanceM)})`
      : 'Calculando próxima parada…'

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
            ]}
            accessibilityLabel="Volver"
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>

          <View style={styles.titleCenter}>
            {showEta ? (
              <Animated.Text
                key="eta"
                entering={FadeIn.duration(280)}
                exiting={FadeOut.duration(200)}
                style={[styles.subTitle, { color: theme.textDim }]}
                numberOfLines={2}
              >
                {etaLine}
              </Animated.Text>
            ) : (
              <Animated.Text
                key="name"
                entering={FadeIn.duration(280)}
                exiting={FadeOut.duration(200)}
                style={[styles.mainTitle, { color: theme.text }]}
                numberOfLines={2}
              >
                {tripName}
              </Animated.Text>
            )}
          </View>

          <View style={styles.backSpacer} />
        </View>

        {members.length > 0 ? (
          <LiveMembersBar members={members} currentUserId={currentUserId} />
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1.2,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backSpacer: {
    width: 38,
  },
  titleCenter: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
})
