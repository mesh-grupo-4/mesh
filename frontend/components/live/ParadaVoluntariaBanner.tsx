import { Pressable, StyleSheet, Text, View } from 'react-native'

/** US1: aviso grupal cuando un integrante registra parada voluntaria. */
type Props = {
  nombre: string
  motivo: string | null
  restantes: number
  ocupado: boolean
  onSeguir: () => void
  onIgnorar: () => void
}

export function ParadaVoluntariaBanner({
  nombre,
  motivo,
  restantes,
  ocupado,
  onSeguir,
  onIgnorar,
}: Props) {
  return (
    <View style={styles.banner}>
      <Text style={styles.titulo}>{nombre} se detuvo</Text>
      {motivo ? <Text style={styles.motivo}>Para {motivo}</Text> : null}
      {restantes > 1 ? (
        <Text style={styles.restantes}>+{restantes - 1} parada(s) más en espera</Text>
      ) : null}

      <View style={styles.acciones}>
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
          accessibilityLabel={`Ignorar la parada de ${nombre}`}
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
          accessibilityLabel={`Seguir la parada de ${nombre}`}
        >
          <Text style={styles.seguirTxt}>{ocupado ? 'Calculando…' : 'Seguir parada'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fbbf24',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  titulo: {
    fontSize: 17,
    fontWeight: '800',
    color: '#92400e',
  },
  motivo: {
    marginTop: 4,
    fontSize: 15,
    color: '#78350f',
  },
  restantes: {
    marginTop: 6,
    fontSize: 13,
    color: '#a16207',
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
    borderColor: '#fca5a5',
  },
  ignorarTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#dc2626',
  },
  seguir: {
    backgroundColor: '#15803d',
    borderColor: '#15803d',
  },
  seguirTxt: {
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
