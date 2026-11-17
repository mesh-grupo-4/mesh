import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'

/** RN-036: confirmación visible cuando el motor detecta posible incidente.
 *  Vive fuera del panel desplegable para que siempre esté al alcance.
 *  "Estoy mal" avisa a todo el grupo; volver a tocarlo deshace (con confirmación).
 *  Sin respuesta en un minuto, se pide ayuda sola (como si tocara "Estoy mal"). */
type Props = {
  paradaDesde: string
  ocupado: boolean
  bottomOffset: number
  onConfirmar: () => void
  necesitaAyuda: boolean
  onEstoyMal: () => void
}

/** Minuto que tiene el integrante para responder desde que aparece el aviso. */
const ESPERA_RESPUESTA_MS = 60_000

/** Fracción del minuto ya consumida en el instante `ahora` (0 a 1). */
function fraccionConsumida(desde: string, ahora: number): number {
  const ms = ahora - new Date(desde).getTime()
  return Math.min(1, Math.max(0, ms / ESPERA_RESPUESTA_MS))
}

function cuentaRegresiva(desde: string): string {
  const restanteMs = ESPERA_RESPUESTA_MS * (1 - fraccionConsumida(desde, Date.now()))
  const seg = Math.ceil(restanteMs / 1000)
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`
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
  const progreso = useRef(new Animated.Value(fraccionConsumida(paradaDesde, Date.now()))).current
  // Lo que lee el tic sin reiniciar el intervalo cada vez que cambian las props.
  const estadoRef = useRef({ ocupado, necesitaAyuda, onEstoyMal })
  estadoRef.current = { ocupado, necesitaAyuda, onEstoyMal }

  // La barra del botón se va pintando a medida que se consume el minuto. Se
  // recalcula contra el reloj en cada tic (y no con una sola animación de 60 s)
  // para no desfasarse si la app pasó por segundo plano.
  useEffect(() => {
    // Solo se pide ayuda sola si el minuto venció con este aviso en pantalla: al
    // reabrir la app con el minuto ya vencido (p. ej. después de deshacer el
    // pedido) no se vuelve a disparar. Una sola vez por incidente.
    let pedidoAutomatico = fraccionConsumida(paradaDesde, Date.now()) >= 1

    const tic = () => {
      const ahora = Date.now()
      const fraccion = fraccionConsumida(paradaDesde, ahora)
      const { ocupado: estaOcupado, necesitaAyuda: yaPidio, onEstoyMal: pedirAyuda } =
        estadoRef.current
      if (fraccion >= 1 && !pedidoAutomatico) {
        // Si ya había pedido ayuda a mano, el minuto se da por respondido.
        if (yaPidio) pedidoAutomatico = true
        else if (!estaOcupado) {
          pedidoAutomatico = true
          pedirAyuda()
        }
      }
      progreso.setValue(fraccion)
      Animated.timing(progreso, {
        toValue: fraccionConsumida(paradaDesde, ahora + 1000),
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start()
      forzarRender((t) => t + 1)
    }
    tic()
    const id = setInterval(tic, 1000)
    return () => {
      clearInterval(id)
      progreso.stopAnimation()
    }
  }, [paradaDesde, progreso])

  const anchoBarra = progreso.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.titulo}>{necesitaAyuda ? 'Pediste ayuda' : '¿Estás bien?'}</Text>
        <Text style={styles.subtitulo}>
          {necesitaAyuda
            ? 'Todo el grupo fue avisado. Tocá el botón rojo de nuevo si querés deshacerlo.'
            : 'Detectamos que llevás un rato detenido. Confirmá si estás bien: si no respondés en un minuto, le avisamos al grupo que necesitás ayuda.'}
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
          {!necesitaAyuda ? (
            <Animated.View pointerEvents="none" style={[styles.barra, { width: anchoBarra }]} />
          ) : null}
          {ocupado ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.botonTxt}>Estoy bien</Text>
              {!necesitaAyuda ? (
                <Text style={styles.cronometro}>{cuentaRegresiva(paradaDesde)}</Text>
              ) : null}
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
    overflow: 'hidden',
  },
  barra: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#7f1d1d',
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
