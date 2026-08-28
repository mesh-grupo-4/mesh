import { Pressable, StyleSheet, Text, View } from 'react-native'

import { mensajeAlertaVisible, metaTipoAlerta, type AlertaApi } from '@/lib/alertasApi'

/** Banner grupal cuando llega una alerta con punto en el mapa (Seguir / Ignorar). */
type Props = {
  alerta: AlertaApi
  restantes: number
  ocupado: boolean
  onSeguir: () => void
  onIgnorar: () => void
}

export function AlertaGrupalBanner({
  alerta,
  restantes,
  ocupado,
  onSeguir,
  onIgnorar,
}: Props) {
  const meta = metaTipoAlerta(alerta.tipo)
  const msg = mensajeAlertaVisible(alerta.mensaje)
  const tieneUbicacion = alerta.lat != null && alerta.lng != null
  const autor = alerta.creada_por_nombre ?? (alerta.origen === 'sistema' ? 'Sistema' : 'Un integrante')

  return (
    <View style={[styles.banner, { borderColor: meta.color }]}>
      <Text style={styles.titulo}>
        {meta.emoji} {meta.label}
      </Text>
      {msg ? <Text style={styles.mensaje}>{msg}</Text> : null}
      <Text style={styles.autor}>{autor}</Text>
      {restantes > 1 ? (
        <Text style={styles.restantes}>+{restantes - 1} alerta(s) más en espera</Text>
      ) : null}

      <View style={styles.acciones}>
        {tieneUbicacion ? (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.boton,
                styles.ignorar,
                pressed && styles.presionado,
                ocupado && styles.deshabilitado,
              ]}
              onPress={onIgnorar}
              disabled={ocupado}
              accessibilityRole="button"
              accessibilityLabel="Ignorar la alerta"
            >
              <Text style={styles.ignorarTxt}>Ignorar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.boton,
                styles.seguir,
                pressed && styles.presionado,
                ocupado && styles.deshabilitado,
              ]}
              onPress={onSeguir}
              disabled={ocupado}
              accessibilityRole="button"
              accessibilityLabel="Seguir hasta el punto marcado"
            >
              <Text style={styles.seguirTxt}>{ocupado ? 'Calculando…' : 'Seguir'}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.boton,
              styles.entendido,
              pressed && styles.presionado,
            ]}
            onPress={onIgnorar}
            accessibilityRole="button"
            accessibilityLabel="Entendido"
          >
            <Text style={styles.entendidoTxt}>Entendido</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
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
  titulo: {
    fontSize: 17,
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
  restantes: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  acciones: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  boton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  ignorar: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  ignorarTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6b7280',
  },
  seguir: {
    backgroundColor: '#4338ca',
    borderColor: '#4338ca',
  },
  seguirTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  entendido: {
    backgroundColor: '#4338ca',
    borderColor: '#4338ca',
  },
  entendidoTxt: {
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
