import { Pressable, StyleSheet, Text, View } from 'react-native'

import { metaTipoAlerta, type AlertaApi } from '@/lib/alertasApi'

/** US1: la alerta recién llegada, sobre el mapa en vivo. */
type Props = {
  alerta: AlertaApi
  onCerrar: () => void
  onVerHistorial: () => void
}

/** Lo posiciona el stack de banners de la pantalla en vivo, no él mismo. */
export function AlertaBanner({ alerta, onCerrar, onVerHistorial }: Props) {
  const meta = metaTipoAlerta(alerta.tipo)

  return (
    <View style={[styles.banner, { borderColor: meta.color }]}>
      <Pressable style={styles.contenido} onPress={onVerHistorial}>
        <Text style={styles.titulo}>
          {meta.emoji} {meta.label}
        </Text>
        {alerta.mensaje ? <Text style={styles.mensaje}>{alerta.mensaje}</Text> : null}
        {alerta.creada_por_nombre ? (
          <Text style={styles.autor}>{alerta.creada_por_nombre}</Text>
        ) : null}
      </Pressable>
      <Pressable
        style={styles.cerrar}
        onPress={onCerrar}
        accessibilityRole="button"
        accessibilityLabel="Cerrar la alerta"
        hitSlop={10}
      >
        <Text style={styles.cerrarTxt}>✕</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  contenido: {
    flex: 1,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  mensaje: {
    marginTop: 4,
    fontSize: 16,
    color: '#1f2937',
  },
  autor: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
  },
  cerrar: {
    paddingLeft: 12,
    paddingTop: 2,
  },
  cerrarTxt: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '700',
  },
})
