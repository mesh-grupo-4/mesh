import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, StyleSheet, View } from 'react-native'

import { getMapStyle } from '@/components/route-config/mapStyles'
import { MapPickOverlay } from '@/components/route-config/MapPickOverlay'
import { MeshMapView, zoomFromLatDelta, type MeshMapViewHandle } from '@/components/maps/MeshMapView'

type Props = {
  visible: boolean
  initialCenter: { latitude: number; longitude: number }
  onConfirm: (ubicacion: { lat: number; lng: number }) => void
  onCancel: () => void
}

/** Selector de punto en el mapa para marcar dónde van a parar (opcional). */
export function AlertaMapPickModal({ visible, initialCenter, onConfirm, onCancel }: Props) {
  const mapRef = useRef<MeshMapViewHandle>(null)
  const capa = getMapStyle('standard')
  const [centro, setCentro] = useState(initialCenter)

  useEffect(() => {
    if (!visible) return
    setCentro(initialCenter)
    mapRef.current?.animateTo(initialCenter, 15)
  }, [visible, initialCenter])

  const confirmar = useCallback(() => {
    onConfirm({ lat: centro.latitude, lng: centro.longitude })
  }, [centro, onConfirm])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.root}>
        <MeshMapView
          ref={mapRef}
          initialCenter={initialCenter}
          initialZoom={zoomFromLatDelta(0.04)}
          mapStyle={capa}
          onRegionChangeComplete={setCentro}
        />
        <MapPickOverlay
          lat={centro.latitude}
          lon={centro.longitude}
          onConfirm={confirmar}
          onCancel={onCancel}
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
})
