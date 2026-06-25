import { Ionicons } from '@expo/vector-icons'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Btn, useTheme } from '@/components/MeshUI'

type Props = {
  lat: number | null
  lon: number | null
  onConfirm: () => void
  onCancel: () => void
}

export function MapPickOverlay({ lat, lon, onConfirm, onCancel }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const coordsText =
    lat != null && lon != null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'Mové el mapa para elegir'

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={[styles.cancelWrap, { top: insets.top + 8 }]}>
        <Btn variant="secondary" size="sm" icon="x" onPress={onCancel}>
          Cancelar
        </Btn>
      </View>

      <View style={styles.pinWrap} pointerEvents="none">
        <Ionicons name="location" size={44} color={theme.accent} style={styles.pinIcon} />
        <View style={[styles.pinDot, { backgroundColor: theme.text, opacity: 0.35 }]} />
      </View>

      <Text
        style={[
          styles.coords,
          {
            color: theme.textDim,
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
        pointerEvents="none"
      >
        {coordsText}
      </Text>

      <View style={[styles.confirmWrap, { bottom: Platform.OS === 'ios' ? 120 : 100 }]}>
        <Btn block size="lg" icon="check" onPress={onConfirm}>
          Confirmar punto
        </Btn>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  cancelWrap: {
    position: 'absolute',
    left: 16,
  },
  pinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -22,
    marginTop: -44,
    alignItems: 'center',
  },
  pinIcon: {
    marginBottom: -8,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  coords: {
    position: 'absolute',
    top: '50%',
    marginTop: 12,
    alignSelf: 'center',
    left: 16,
    right: 16,
    textAlign: 'center',
    fontSize: 13,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  confirmWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
  },
})
