import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvatarFallback } from '@/components/AvatarFallback'
import { useTheme } from '@/components/MeshUI'
import { tamanoOutdoor } from '@/constants/Typography'
import { uiConfigPorActividad } from '@/lib/activityUi'
import { ICONO_VOLVER } from '@/lib/plataforma'
import { formatDistanceShort, formatEtaLabel, type NextStopInfo } from '@/lib/geo/nextStop'
import type { TipoActividadApi } from '@/lib/viajesApi'

import { LiveMembersBar, type LiveMember } from './LiveMembersBar'

type Props = {
  tripName: string
  nextStop: NextStopInfo | null
  hasRoute: boolean
  members: LiveMember[]
  currentUserId: string
  onBack: () => void
  /** Para que el mapa esconda sus controles flotantes mientras el panel está abierto. */
  onExpandedChange?: (expanded: boolean) => void
  tipoActividad?: TipoActividadApi
}

const MAX_AVATARES_COMPACTOS = 4
const ICONO_VOLVER_TAM = 18

/** Alto del header cerrado sin contar el safe area: los flotantes del mapa arrancan debajo. */
export const ALTO_HEADER_COMPACTO = 37

export function LiveTripHeader({
  tripName,
  nextStop,
  hasRoute,
  members,
  currentUserId,
  onBack,
  onExpandedChange,
  tipoActividad = 'otro',
}: Props) {
  const { altoContraste } = uiConfigPorActividad(tipoActividad)
  const theme = useTheme(altoContraste)
  const insets = useSafeAreaInsets()
  const [expandido, setExpandido] = useState(false)
  const [showEta, setShowEta] = useState(false)
  const [listaAbierta, setListaAbierta] = useState(false)

  useEffect(() => {
    onExpandedChange?.(expandido)
  }, [expandido, onExpandedChange])

  useEffect(() => {
    if (expandido) return
    const id = setInterval(() => setShowEta((v) => !v), 5000)
    return () => clearInterval(id)
  }, [expandido])

  useEffect(() => {
    // La lista de integrantes vive dentro del panel: cerrarlo la cerraría a ella también.
    if (!expandido || listaAbierta) return
    const id = setTimeout(() => setExpandido(false), 8000)
    return () => clearTimeout(id)
  }, [expandido, listaAbierta])

  const etaLine = !hasRoute
    ? 'Sin ruta configurada'
    : nextStop
      ? `Próx. parada: ${nextStop.stop.name} · ${formatEtaLabel(nextStop.etaSec)} (${formatDistanceShort(nextStop.distanceM)})`
      : 'Calculando próxima parada…'

  const lineaCompacta = hasRoute && nextStop ? etaLine : tripName
  const avataresCompactos = members.slice(0, MAX_AVATARES_COMPACTOS)
  const restantes = members.length - avataresCompactos.length

  // Cada tanto los avatares dejan paso a la próxima parada, y vuelven.
  const enFaseParada = !expandido && showEta && hasRoute && !!nextStop

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 2,
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => setExpandido((v) => !v)}
        style={({ pressed }) => [styles.bar, expandido && styles.barExpanded, pressed && styles.barPressed]}
        accessibilityRole="button"
        accessibilityLabel={expandido ? 'Contraer panel del viaje' : 'Expandir panel del viaje'}
      >
        <View style={styles.titleRow}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.()
              onBack()
            }}
            // La flecha es chica, pero el área táctil sigue siendo cómoda (RN-052).
            hitSlop={14}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityLabel="Volver"
          >
            <Feather name={ICONO_VOLVER} size={ICONO_VOLVER_TAM} color={theme.text} />
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
                style={[styles.subTitle, { color: theme.textDim, fontSize: tamanoOutdoor(12) }]}
                numberOfLines={1}
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

          {!expandido && members.length > 0 && !enFaseParada ? (
            <Animated.View
              key="avatares"
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(160)}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.compactAvatars}
                contentContainerStyle={styles.compactAvatarsContent}
              >
                {avataresCompactos.map((m) => (
                  <View
                    key={m.id}
                    style={[
                      styles.compactAvatarWrap,
                      m.id === currentUserId && { borderColor: theme.good, borderWidth: 1.5 },
                      (!m.enMapa || m.sinSenal) && styles.compactAvatarOffline,
                    ]}
                  >
                    <AvatarFallback nombre={m.nombre} size={24} />
                  </View>
                ))}
                {restantes > 0 ? (
                  <View style={[styles.compactMore, { backgroundColor: theme.surface2 }]}>
                    <Text style={[styles.compactMoreTxt, { color: theme.textDim }]}>+{restantes}</Text>
                  </View>
                ) : null}
              </ScrollView>
            </Animated.View>
          ) : null}

          {enFaseParada ? (
            <Animated.View
              key="parada-flag"
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(160)}
              style={[styles.paradaFlag, { backgroundColor: theme.accentWeak }]}
            >
              <Feather name="flag" size={14} color={theme.accent} />
            </Animated.View>
          ) : null}

          <View style={styles.trailing}>
            <Feather
              name={expandido ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textMute}
            />
          </View>
        </View>

        {expandido ? (
          <Animated.View
            layout={LinearTransition}
            entering={FadeIn.duration(220)}
            style={[styles.expandedBlock, { borderTopColor: theme.border }]}
          >
            <Text
              style={[styles.etaExpanded, { color: theme.textDim, fontSize: tamanoOutdoor(13) }]}
              numberOfLines={2}
            >
              {etaLine}
            </Text>
            {members.length > 0 ? (
              <LiveMembersBar
                members={members}
                currentUserId={currentUserId}
                onListaAbiertaChange={setListaAbierta}
              />
            ) : null}
          </Animated.View>
        ) : null}
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
    zIndex: 50,
    elevation: 50,
    borderBottomWidth: 1,
  },
  bar: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  barExpanded: {
    paddingBottom: 12,
  },
  barPressed: {
    opacity: 0.96,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  backBtnPressed: {
    opacity: 0.6,
  },
  trailing: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCenter: {
    flex: 1,
    minWidth: 0,
    minHeight: 28,
    justifyContent: 'center',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'left',
    letterSpacing: -0.3,
  },
  mainTitleCompact: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'left',
    letterSpacing: -0.2,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 16,
  },
  etaExpanded: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
    lineHeight: 18,
  },
  expandedBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 4,
  },
  compactAvatars: {
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: 108,
  },
  paradaFlag: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAvatarsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactAvatarWrap: {
    borderRadius: 14,
    padding: 1,
  },
  compactAvatarOffline: {
    opacity: 0.55,
  },
  compactMore: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  compactMoreTxt: {
    fontSize: 10,
    fontWeight: '800',
  },
})
