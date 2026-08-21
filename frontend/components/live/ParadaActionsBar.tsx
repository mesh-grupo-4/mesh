import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

/** Botonera de paradas del viaje en curso (US1–US3).
 *
 * Vive sobre la barra de Finalizar/Salir para que ambas acciones queden al
 * alcance del pulgar (RN-052: uso a una mano, botones grandes en movimiento).
 */
type Props = {
  /** Inicio de la parada en curso; null si el integrante está en movimiento. */
  paradaDesde: string | null
  /** El botón de solicitar no se muestra al líder ni en viajes individuales. */
  puedeSolicitar: boolean
  /** Hay una solicitud propia esperando respuesta del líder. */
  solicitudPendiente: boolean
  ocupado: boolean
  onDetenerse: () => void
  onRetomar: () => void
  onSolicitar: () => void
}

function transcurrido(desde: string): string {
  const seg = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 1000))
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const dosDigitos = (n: number) => String(n).padStart(2, '0')
  return h > 0
    ? `${h}:${dosDigitos(m)}:${dosDigitos(s)}`
    : `${dosDigitos(m)}:${dosDigitos(s)}`
}

export function ParadaActionsBar({
  paradaDesde,
  puedeSolicitar,
  solicitudPendiente,
  ocupado,
  onDetenerse,
  onRetomar,
  onSolicitar,
}: Props) {
  const [, forzarRender] = useState(0)

  // Cronómetro de la parada en curso.
  useEffect(() => {
    if (!paradaDesde) return
    const id = setInterval(() => forzarRender((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [paradaDesde])

  if (paradaDesde) {
    return (
      <View style={styles.fila}>
        <Pressable
          style={({ pressed }) => [
            styles.boton,
            styles.retomar,
            pressed && styles.presionado,
            ocupado && styles.deshabilitado,
          ]}
          onPress={onRetomar}
          disabled={ocupado}
          accessibilityRole="button"
          accessibilityLabel="Retomar el viaje y finalizar la parada"
        >
          {ocupado ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.retomarTxt}>Retomar viaje</Text>
              <Text style={styles.cronometro}>{transcurrido(paradaDesde)}</Text>
            </>
          )}
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.fila}>
      <Pressable
        style={({ pressed }) => [
          styles.boton,
          styles.detenerse,
          pressed && styles.presionado,
          ocupado && styles.deshabilitado,
        ]}
        onPress={onDetenerse}
        disabled={ocupado}
        accessibilityRole="button"
        accessibilityLabel="Registrar que me detuve"
      >
        <Text style={styles.detenerseTxt}>Me detuve</Text>
      </Pressable>

      {puedeSolicitar ? (
        <Pressable
          style={({ pressed }) => [
            styles.boton,
            styles.solicitar,
            solicitudPendiente && styles.solicitarPendiente,
            pressed && styles.presionado,
            ocupado && styles.deshabilitado,
          ]}
          onPress={onSolicitar}
          disabled={ocupado}
          accessibilityRole="button"
          accessibilityLabel={
            solicitudPendiente
              ? 'Solicitud de parada enviada, esperando al líder'
              : 'Pedir una parada al líder'
          }
        >
          <Text style={[styles.solicitarTxt, solicitudPendiente && styles.solicitarTxtPendiente]}>
            {solicitudPendiente ? 'Esperando al líder…' : 'Pedir parada'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
  },
  boton: {
    flex: 1,
    minHeight: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 12,
  },
  detenerse: {
    backgroundColor: '#fffbeb',
    borderColor: '#fbbf24',
  },
  detenerseTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#b45309',
  },
  solicitar: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  solicitarPendiente: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  solicitarTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#4338ca',
    textAlign: 'center',
  },
  solicitarTxtPendiente: {
    color: '#6b7280',
    fontSize: 15,
  },
  retomar: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#15803d',
    borderColor: '#15803d',
  },
  retomarTxt: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  cronometro: {
    fontSize: 18,
    fontWeight: '700',
    color: '#dcfce7',
    fontVariant: ['tabular-nums'],
  },
  presionado: {
    opacity: 0.75,
  },
  deshabilitado: {
    opacity: 0.5,
  },
})
