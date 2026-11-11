import { StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { Pressable } from '@/components/Pressable'
import { ActivityTile, useTheme } from '@/components/MeshUI'
import { ACTIVIDADES } from '@/lib/activityDefaults'
import type { TipoActividadApi } from '@/lib/viajesApi'

type Props = {
  onElegir: (actividad: TipoActividadApi) => void
  /** Marca la actividad ya elegida (al volver a este paso). */
  seleccionada?: TipoActividadApi | null
  /** Actividades que no se pueden elegir (ej. moto/auto con modo competitivo, RN-070). */
  deshabilitada?: (actividad: TipoActividadApi) => boolean
}

/** Grilla de tiles grandes: un toque elige la actividad. La usan "Viaje YA" y "Planificar". */
export function ActividadGrid({ onElegir, seleccionada = null, deshabilitada }: Props) {
  const theme = useTheme()
  return (
    <View style={styles.grid}>
      {ACTIVIDADES.map((a) => {
        const activa = seleccionada === a.id
        const bloqueada = deshabilitada?.(a.id) ?? false
        return (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityState={{ selected: activa, disabled: bloqueada }}
            disabled={bloqueada}
            onPress={() => onElegir(a.id)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: pressed || activa ? theme.accentWeak : theme.surface,
                borderColor: pressed || activa ? theme.accentLine : theme.border,
                opacity: bloqueada ? 0.4 : 1,
              },
            ]}
          >
            <ActivityTile activity={a.id} size={64} />
            <Text style={[styles.label, { color: theme.text }]}>{a.label}</Text>
            {activa ? (
              <Feather name="check-circle" size={20} color={theme.accent} style={styles.check} />
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    flexGrow: 1,
    minHeight: 130,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: { fontSize: 18, fontWeight: '700' },
  check: { position: 'absolute', top: 10, right: 10 },
})
