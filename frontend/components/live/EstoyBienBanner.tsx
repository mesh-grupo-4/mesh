import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

/** RN-036: confirmación visible cuando el motor detecta posible incidente.
 *  Vive fuera del panel desplegable para que siempre esté al alcance.
 *  "Estoy mal" avisa a todo el grupo; volver a tocarlo deshace (con confirmación). */
type Props = {
  paradaDesde: string
  ocupado: boolean
  bottomOffset: number
  onConfirmar: () => void
  necesitaAyuda: boolean
  onEstoyMal: () => void
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

export function EstoyBienBanner({
  paradaDesde,
  ocupado,
  bottomOffset,
  onConfirmar,
  necesitaAyuda,
  onEstoyMal,
}: Props) {
  const [, forzarRender] = useState(0)

  useEffect(() => {
    const id = setInterval(() => forzarRender((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.titulo}>{necesitaAyuda ? 'Pediste ayuda' : '¿Estás bien?'}</Text>
        <Text style={styles.subtitulo}>
          {necesitaAyuda
            ? 'Todo el grupo fue avisado. Tocá el botón rojo de nuevo si querés deshacerlo.'
            : 'Detectamos que llevás un rato detenido. Confirmá si estás bien o avisá si necesitás ayuda.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.boton,
            pressed && styles.presionado,
            ocupado && styles.deshabilitado,
          ]}
          onPress={onConfirmar}
          disabled={ocupado}
          accessibilityRole="button"
          accessibilityLabel="Confirmar que estoy bien"
        >
          {ocupado ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.botonTxt}>Estoy bien</Text>
              <Text style={styles.cronometro}>{transcurrido(paradaDesde)}</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.botonMal,
            necesitaAyuda && styles.botonMalActivo,
            pressed && styles.presionado,
            ocupado && styles.deshabilitado,
          ]}
          onPress={onEstoyMal}
          disabled={ocupado}
          accessibilityRole="button"
          accessibilityState={{ selected: necesitaAyuda }}
          accessibilityLabel={
            necesitaAyuda ? 'Deshacer el pedido de ayuda' : 'Avisar al grupo que necesito ayuda'
          }
        >
          <Text style={[styles.botonMalTxt, necesitaAyuda && styles.botonMalActivoTxt]}>
            {necesitaAyuda ? 'Ayuda pedida · Deshacer' : 'Estoy mal · Pedir ayuda'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 35,
  },
  banner: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#dc2626',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#991b1b',
  },
  subtitulo: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: '#b91c1c',
    fontWeight: '600',
  },
  boton: {
    marginTop: 14,
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: '#dc2626',
    borderWidth: 1.5,
    borderColor: '#b91c1c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  botonTxt: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  cronometro: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fecaca',
    fontVariant: ['tabular-nums'],
  },
  botonMal: {
    marginTop: 10,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#991b1b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  botonMalActivo: {
    backgroundColor: '#991b1b',
  },
  botonMalTxt: {
    fontSize: 18,
    fontWeight: '800',
    color: '#991b1b',
  },
  botonMalActivoTxt: {
    color: '#fff',
  },
  presionado: {
    opacity: 0.85,
  },
  deshabilitado: {
    opacity: 0.55,
  },
})
