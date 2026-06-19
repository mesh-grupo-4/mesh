import { Ionicons } from '@expo/vector-icons'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

type Props = {
  lat: number | null
  lon: number | null
  onConfirm: () => void
  onCancel: () => void
}

export function MapPickOverlay({ lat, lon, onConfirm, onCancel }: Props) {
  const coordsText =
    lat != null && lon != null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'Mové el mapa para elegir'

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={styles.cancelBtn} onPress={onCancel} hitSlop={8}>
        <Ionicons name="close" size={22} color="#111827" />
        <Text style={styles.cancelTxt}>Cancelar</Text>
      </Pressable>

      <View style={styles.pinWrap} pointerEvents="none">
        <Ionicons name="location" size={44} color="#b91c1c" style={styles.pinIcon} />
        <View style={styles.pinDot} />
      </View>

      <Text style={styles.coords} pointerEvents="none">
        {coordsText}
      </Text>

      <Pressable style={styles.confirmBtn} onPress={onConfirm}>
        <Text style={styles.confirmTxt}>Confirmar punto</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  cancelBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cancelTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
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
    backgroundColor: '#111827',
    opacity: 0.35,
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
    color: '#374151',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  confirmBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    left: 24,
    right: 24,
    backgroundColor: '#15803d',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  confirmTxt: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
})
