import { Pressable, StyleSheet, Text, View } from 'react-native'

/** US2: el líder resuelve la solicitud sin salir del mapa. */
type Props = {
  nombre: string
  motivo: string | null
  restantes: number
  ocupado: boolean
  onAprobar: () => void
  onRechazar: () => void
}

export function SolicitudParadaBanner({
  nombre,
  motivo,
  restantes,
  ocupado,
  onAprobar,
  onRechazar,
}: Props) {
  return (
    <View style={styles.banner}>
      <Text style={styles.titulo}>{nombre} pide parar</Text>
      {motivo ? <Text style={styles.motivo}>“{motivo}”</Text> : null}
      {restantes > 1 ? (
        <Text style={styles.restantes}>+{restantes - 1} solicitud(es) más en espera</Text>
      ) : null}

      <View style={styles.acciones}>
        <Pressable
          style={({ pressed }) => [
            styles.boton,
            styles.rechazar,
            pressed && styles.presionado,
            ocupado && styles.deshabilitado,
          ]}
          onPress={onRechazar}
          disabled={ocupado}
          accessibilityRole="button"
          accessibilityLabel={`Rechazar la parada que pide ${nombre}`}
        >
          <Text style={styles.rechazarTxt}>Rechazar</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.boton,
            styles.aprobar,
            pressed && styles.presionado,
            ocupado && styles.deshabilitado,
          ]}
          onPress={onAprobar}
          disabled={ocupado}
          accessibilityRole="button"
          accessibilityLabel={`Aprobar la parada que pide ${nombre}`}
        >
          <Text style={styles.aprobarTxt}>Aprobar</Text>
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
    fontStyle: 'italic',
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
  rechazar: {
    backgroundColor: '#fff',
    borderColor: '#fca5a5',
  },
  rechazarTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#dc2626',
  },
  aprobar: {
    backgroundColor: '#15803d',
    borderColor: '#15803d',
  },
  aprobarTxt: {
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
