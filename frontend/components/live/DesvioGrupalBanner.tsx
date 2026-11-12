import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'

/**
 * RN-034b: el líder salió de la ruta. En vez de una alerta por cada integrante que lo
 * sigue, se le pregunta una sola vez si recalcular. Sin respuesta, el backend recalcula
 * solo al vencer la cuenta regresiva.
 */
type Props = {
  /** ISO: cuándo se recalcula sola si no responde. */
  recalculoAutomaticoEn: string | null
  recalculando: boolean
  ocupado: boolean
  onRecalcular: () => void
  onVolvemos: () => void
}

function restante(hasta: string | null): string | null {
  if (!hasta) return null
  const seg = Math.max(0, Math.ceil((new Date(hasta).getTime() - Date.now()) / 1000))
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`
}

export function DesvioGrupalBanner({
  recalculoAutomaticoEn,
  recalculando,
  ocupado,
  onRecalcular,
  onVolvemos,
}: Props) {
  const [, forzarRender] = useState(0)

  useEffect(() => {
    if (!recalculoAutomaticoEn) return
    const id = setInterval(() => forzarRender((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [recalculoAutomaticoEn])

  const cuenta = restante(recalculoAutomaticoEn)
  const bloqueado = ocupado || recalculando

  return (
    <View style={styles.banner}>
      <Text style={styles.titulo}>
        {recalculando ? 'Recalculando la ruta…' : 'El grupo salió de la ruta'}
      </Text>
      {!recalculando ? (
        <Text style={styles.subtitulo}>
          ¿Tomaron otro camino? Recalculamos el recorrido para todos.
          {cuenta ? ` Si no respondés, se recalcula solo en ${cuenta}.` : ''}
        </Text>
      ) : null}

      <View style={styles.acciones}>
        <Pressable
          style={({ pressed }) => [
            styles.boton,
            styles.volvemos,
            pressed && styles.presionado,
            bloqueado && styles.deshabilitado,
          ]}
          onPress={onVolvemos}
          disabled={bloqueado}
          accessibilityRole="button"
          accessibilityLabel="No recalcular, volvemos a la ruta"
        >
          <Text style={styles.volvemosTxt}>No, volvemos</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.boton,
            styles.recalcular,
            pressed && styles.presionado,
            bloqueado && styles.deshabilitado,
          ]}
          onPress={onRecalcular}
          disabled={bloqueado}
          accessibilityRole="button"
          accessibilityLabel="Recalcular la ruta desde donde estamos"
        >
          {bloqueado ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.recalcularTxt}>Sí, recalcular</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  subtitulo: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    color: '#1e40af',
    fontWeight: '600',
  },
  acciones: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  boton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  volvemos: {
    backgroundColor: '#fff',
    borderColor: '#93c5fd',
  },
  volvemosTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  recalcular: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  recalcularTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  presionado: {
    opacity: 0.75,
  },
  deshabilitado: {
    opacity: 0.5,
  },
})
