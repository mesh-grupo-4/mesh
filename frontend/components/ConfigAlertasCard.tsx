import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'

import { useTheme } from '@/components/MeshUI'
import type { ViajeDetalleApi } from '@/lib/viajesApi'

export type ConfigAlertasInput = {
  alertaIncidenteHabilitada?: boolean
  alertaIncidenteMinutos?: number | null
  alertasSoloLider?: boolean
}

type Props = {
  viaje: Pick<
    ViajeDetalleApi,
    | 'alerta_incidente_habilitada'
    | 'alerta_incidente_minutos'
    | 'alerta_incidente_minutos_efectivo'
    | 'alertas_solo_lider'
  >
  guardando: boolean
  onGuardar: (input: ConfigAlertasInput) => void
  inicialAbierto?: boolean
}

/**
 * Configuración de alertas del viaje grupal: detección automática de incidente
 * (RN-036) y quién puede crear alertas manuales. Solo se le muestra al líder;
 * el backend valida igual (RN-030).
 */
export function ConfigAlertasCard({ viaje, guardando, onGuardar, inicialAbierto = false }: Props) {
  const theme = useTheme()
  const [abierto, setAbierto] = useState(inicialAbierto)
  const soloLider = viaje.alertas_solo_lider ?? true

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={() => setAbierto((v) => !v)}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.7 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Configurar alertas"
        accessibilityState={{ expanded: abierto }}
      >
        <Feather name="alert-triangle" size={16} color={theme.accent} />
        <Text style={[styles.title, { color: theme.text }]}>Configurar alertas</Text>
        <Feather name={abierto ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textDim} />
      </Pressable>

      {abierto ? (
        <>
          <Text style={[styles.hint, { color: theme.textDim }]}>
            Si alguien queda detenido sin registrar parada, el líder recibe una alerta automática.
          </Text>

          <Pressable
            onPress={() => onGuardar({ alertaIncidenteHabilitada: !viaje.alerta_incidente_habilitada })}
            disabled={guardando}
            style={({ pressed }) => [
              styles.toggleRow,
              { borderColor: theme.border, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={[styles.toggleLabel, { color: theme.text }]}>Detección automática</Text>
            <View
              style={[
                styles.togglePill,
                {
                  backgroundColor: viaje.alerta_incidente_habilitada ? theme.good : theme.surface2,
                  borderColor: viaje.alerta_incidente_habilitada ? theme.good : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.togglePillTxt,
                  { color: viaje.alerta_incidente_habilitada ? '#fff' : theme.textDim },
                ]}
              >
                {viaje.alerta_incidente_habilitada ? 'Activa' : 'Off'}
              </Text>
            </View>
          </Pressable>

          {viaje.alerta_incidente_habilitada ? (
            <View style={styles.minutosRow}>
              <Text style={[styles.minutosLabel, { color: theme.textDim }]}>Minutos quieto sin parada</Text>
              <View style={styles.minutosControls}>
                <Pressable
                  onPress={() => {
                    const base = viaje.alerta_incidente_minutos ?? viaje.alerta_incidente_minutos_efectivo
                    if (base <= 1) return
                    onGuardar({ alertaIncidenteMinutos: base - 1 })
                  }}
                  disabled={guardando || viaje.alerta_incidente_minutos_efectivo <= 1}
                  style={[styles.stepBtn, { borderColor: theme.border }]}
                  accessibilityLabel="Bajar minutos"
                >
                  <Feather
                    name="minus"
                    size={16}
                    color={viaje.alerta_incidente_minutos_efectivo <= 1 ? theme.textDim : theme.text}
                  />
                </Pressable>
                <Text style={[styles.minutosValue, { color: theme.text }]}>
                  {viaje.alerta_incidente_minutos_efectivo} min
                </Text>
                <Pressable
                  onPress={() => {
                    const base = viaje.alerta_incidente_minutos ?? viaje.alerta_incidente_minutos_efectivo
                    if (base >= 30) return
                    onGuardar({ alertaIncidenteMinutos: base + 1 })
                  }}
                  disabled={guardando}
                  style={[styles.stepBtn, { borderColor: theme.border }]}
                  accessibilityLabel="Subir minutos"
                >
                  <Feather name="plus" size={16} color={theme.text} />
                </Pressable>
                {viaje.alerta_incidente_minutos != null ? (
                  <Pressable
                    onPress={() => onGuardar({ alertaIncidenteMinutos: null })}
                    disabled={guardando}
                    hitSlop={6}
                  >
                    <Text style={[styles.resetTxt, { color: theme.accent }]}>Por actividad</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() => onGuardar({ alertasSoloLider: !soloLider })}
            disabled={guardando}
            style={({ pressed }) => [
              styles.toggleRow,
              { borderColor: theme.border, opacity: pressed ? 0.88 : 1, marginTop: 10 },
            ]}
          >
            <Text style={[styles.toggleLabel, { color: theme.text }]}>Solo el líder crea alertas</Text>
            <View
              style={[
                styles.togglePill,
                {
                  backgroundColor: soloLider ? theme.good : theme.surface2,
                  borderColor: soloLider ? theme.good : theme.border,
                },
              ]}
            >
              <Text style={[styles.togglePillTxt, { color: soloLider ? '#fff' : theme.textDim }]}>
                {soloLider ? 'Sí' : 'No'}
              </Text>
            </View>
          </Pressable>
          <Text style={[styles.hint, { color: theme.textDim, marginTop: 6 }]}>
            Si está desactivado, cualquier integrante puede enviar alertas manuales durante el viaje.
          </Text>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.2, borderRadius: 14, padding: 11, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleLabel: { fontSize: 14.5, fontWeight: '600' },
  togglePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  togglePillTxt: { fontSize: 12, fontWeight: '800' },
  minutosRow: { gap: 8 },
  minutosLabel: { fontSize: 12.5, fontWeight: '600' },
  minutosControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minutosValue: { fontSize: 16, fontWeight: '800', minWidth: 56, textAlign: 'center' },
  resetTxt: { fontSize: 12.5, fontWeight: '700', marginLeft: 4 },
})
