import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
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
  const [expandido, setExpandido] = useState(false)
  const [showEta, setShowEta] = useState(false)

  useEffect(() => {
    if (expandido) return
    const id = setInterval(() => setShowEta((v) => !v), 5000)
    return () => clearInterval(id)
  }, [expandido])

  useEffect(() => {
    if (!expandido) return
    const id = setTimeout(() => setExpandido(false), 8000)
    return () => clearTimeout(id)
  }, [expandido])

  const etaLine = !hasRoute
    ? 'Sin ruta configurada'
    : nextStop
      ? `Próx. parada: ${nextStop.stop.name} · ${formatEtaLabel(nextStop.etaSec)} (${formatDistanceShort(nextStop.distanceM)})`
      : 'Calculando próxima parada…'

  const lineaCompacta = hasRoute && nextStop ? etaLine : tripName

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <Pressable
        onPress={() => setExpandido((v) => !v)}
        style={({ pressed }) => [
          styles.card,
          expandido && styles.cardExpanded,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadow,
            opacity: pressed ? 0.96 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={expandido ? 'Contraer panel del viaje' : 'Expandir panel del viaje'}
      >
        <View style={styles.titleRow}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.()
              onBack()
            }}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
            ]}
            accessibilityLabel="Volver"
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>

          <View style={styles.titleCenter}>
            {expandido ? (
              <Animated.Text
                key="name-expanded"
                entering={FadeIn.duration(200)}
                style={[styles.mainTitle, { color: theme.text }]}
                numberOfLines={2}
              >
                {tripName}
              </Animated.Text>
            ) : showEta && hasRoute ? (
              <Animated.Text
                key="eta-compact"
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={[styles.subTitle, { color: theme.textDim }]}
                numberOfLines={2}
              >
                {lineaCompacta}
              </Animated.Text>
            ) : (
              <Animated.Text
                key="name-compact"
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={[styles.mainTitleCompact, { color: theme.text }]}
                numberOfLines={1}
              >
                {tripName}
              </Animated.Text>
            )}
          </View>

          <View style={styles.trailing}>
            <Feather
              name={expandido ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textMute}
            />
          </View>
        </View>

        {expandido ? (
          <Animated.View layout={LinearTransition} entering={FadeIn.duration(220)}>
            <Text style={[styles.etaExpanded, { color: theme.textDim }]} numberOfLines={2}>
              {etaLine}
            </Text>
            {members.length > 0 ? (
              <LiveMembersBar members={members} currentUserId={currentUserId} />
            ) : null}
          </Animated.View>
        ) : (
          <View style={styles.compactMeta}>
            <Feather name="users" size={14} color={theme.textMute} />
            <Text style={[styles.compactCount, { color: theme.textDim }]}>{members.length}</Text>
          </View>
        )}
      </Pressable>
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
    paddingBottom: 8,
    paddingTop: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardExpanded: {
    paddingBottom: 10,
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
  trailing: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCenter: {
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  mainTitleCompact: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
  },
  etaExpanded: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 18,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  compactCount: {
    fontSize: 12,
    fontWeight: '700',
  },
})
