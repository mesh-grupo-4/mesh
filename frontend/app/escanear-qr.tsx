import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated'
import { Feather } from '@expo/vector-icons'

import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { parseViajeIdFromInviteData } from '@/lib/inviteLinks'
import { ejecutarUnionPorQr } from '@/lib/joinViajeQr'
import { TopBar, Btn, useTheme } from '@/components/MeshUI'

export default function EscanearQrScreen() {
  const { backendUserId } = useAuth()
  const theme = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [procesando, setProcesando] = useState(false)

  // Animated laser line
  const laserY = useSharedValue(10)
  useEffect(() => {
    if (permission?.granted && !procesando) {
      laserY.value = withRepeat(
        withSequence(
          withTiming(226, { duration: 1800 }),
          withTiming(10, { duration: 1800 })
        ),
        -1
      )
    }
  }, [permission?.granted, procesando])

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserY.value }],
  }))

  const onBarcode = useCallback(
    async (data: string) => {
      if (procesando) return
      const viajeId = parseViajeIdFromInviteData(data)
      if (!viajeId) return

      setProcesando(true)
      try {
        const userId = resolveBackendUserId(backendUserId)
        await ejecutarUnionPorQr(viajeId, userId)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo procesar el código.'
        Alert.alert('Error', msg)
        setProcesando(false)
      }
    },
    [backendUserId, procesando]
  )

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar title="Escanear QR" onBack={() => router.back()} bordered={false} />
        
        <View style={styles.permissionContent}>
          <View style={[styles.iconContainer, { backgroundColor: theme.accentWeak }]}>
            <Feather name="camera" size={32} color={theme.accent} />
          </View>
          <Text style={[styles.permissionTitle, { color: theme.text }]}>Permiso de cámara</Text>
          <Text style={[styles.permissionSub, { color: theme.textDim }]}>
            Mesh necesita acceso a tu cámara para poder escanear los códigos QR de invitaciones a viajes y grupos.
          </Text>
          <View style={styles.permissionActions}>
            <Btn variant="primary" block onPress={() => void requestPermission()}>
              Permitir acceso
            </Btn>
            <Btn variant="ghost" block onPress={() => void Linking.openSettings()}>
              Abrir ajustes del sistema
            </Btn>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={procesando ? undefined : ({ data }) => void onBarcode(data)}
      />

      <View style={styles.overlayContainer}>
        {/* Customized transparent Header */}
        <View style={styles.overlayHeader}>
          <TopBar 
            title="" 
            onBack={() => router.back()} 
            bordered={false} 
            right={
              <Text style={{ color: theme.textDim, fontSize: 13, marginRight: 8, fontFamily: 'SpaceMono' }}>
                Escaneá un QR
              </Text>
            } 
          />
        </View>

        {/* Central Scan Window & Masking */}
        <View style={styles.scannerZone}>
          <View style={styles.maskBlock} />
          
          <View style={styles.scannerRow}>
            <View style={styles.maskBlock} />
            
            <View style={styles.scanBox}>
              {/* Box corners */}
              <View style={[styles.corner, styles.topLeft, { borderColor: theme.accent }]} />
              <View style={[styles.corner, styles.topRight, { borderColor: theme.accent }]} />
              <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.accent }]} />
              <View style={[styles.corner, styles.bottomRight, { borderColor: theme.accent }]} />
              
              {/* Animating laser */}
              {!procesando && (
                <Animated.View 
                  style={[
                    styles.laserLine, 
                    { backgroundColor: theme.accent, shadowColor: theme.accent }, 
                    laserStyle
                  ]} 
                />
              )}
            </View>
            
            <View style={styles.maskBlock} />
          </View>

          <View style={[styles.maskBlock, styles.bottomMask]}>
            <Text style={styles.hintText}>
              {procesando ? 'Procesando código de invitación...' : 'Apuntá la cámara al código QR de Mesh'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  overlayHeader: {
    backgroundColor: 'rgba(10, 10, 10, 0.45)',
  },
  scannerZone: {
    flex: 1,
  },
  scannerRow: {
    flexDirection: 'row',
    height: 240,
  },
  maskBlock: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.65)',
  },
  bottomMask: {
    flex: 1.5,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 32,
  },
  scanBox: {
    width: 240,
    height: 240,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 12,
  },
  laserLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 2.5,
    borderRadius: 2,
    elevation: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  hintText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  permissionContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionSub: {
    fontSize: 14.5,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  permissionActions: {
    width: '100%',
    gap: 10,
  },
})
