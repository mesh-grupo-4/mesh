import { Feather } from '@expo/vector-icons'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'

/**
 * RN-110: texto del consentimiento informado de geolocalización. Vive acá y no
 * suelto en cada pantalla para que el modal de permisos, el aviso al unirse a un
 * viaje en curso y la pantalla de privacidad digan exactamente lo mismo — es el
 * texto cuya versión (`VERSION_CONSENTIMIENTO_UBICACION`, en el backend) queda
 * registrada al aceptar. Si cambia el texto, hay que subir esa versión.
 */
export const PUNTOS_CONSENTIMIENTO_UBICACION = [
  {
    icono: 'map-pin' as const,
    texto:
      'Tu posición se lee cada 5 segundos mientras el viaje está en curso, y deja de leerse al finalizarlo.',
  },
  {
    icono: 'users' as const,
    texto:
      'Solo la ven los integrantes de este viaje, para saber dónde está el grupo y detectar desvíos o incidentes.',
  },
  {
    icono: 'eye-off' as const,
    texto:
      'Podés apagar el compartir cuando quieras, viaje por viaje. Tu recorrido se sigue guardando para tus métricas, pero nadie más lo ve.',
  },
  {
    icono: 'list' as const,
    texto: 'Podés consultar en cualquier momento quiénes accedieron a tu posición.',
  },
]

/** Explicación de por qué la app pide el permiso de ubicación del sistema. */
export function textoPermisoSistema(): string {
  return Platform.OS === 'ios'
    ? 'Para que el grupo te siga viendo con la pantalla apagada, elegí "Siempre" cuando iOS lo pregunte (o en Ajustes → Mesh → Ubicación).'
    : 'Android pide además permiso en segundo plano: es lo que sostiene la notificación fija y los envíos cada 5 segundos con la pantalla apagada.'
}

export function AvisoUbicacion({ compacto = false }: { compacto?: boolean }) {
  const theme = useTheme()
  const puntos = compacto
    ? PUNTOS_CONSENTIMIENTO_UBICACION.slice(0, 2)
    : PUNTOS_CONSENTIMIENTO_UBICACION

  return (
    <View style={styles.lista}>
      {puntos.map((p) => (
        <View key={p.icono} style={styles.fila}>
          <Feather name={p.icono} size={16} color={theme.accent} style={styles.icono} />
          <Text style={[styles.texto, { color: theme.textDim }]}>{p.texto}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  lista: {
    gap: 10,
  },
  fila: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  icono: {
    marginTop: 2,
  },
  texto: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
})
