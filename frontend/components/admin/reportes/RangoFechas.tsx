import { useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Feather } from '@expo/vector-icons'

import { Pressable } from '@/components/Pressable'
import { Btn, useTheme } from '@/components/MeshUI'

/** Fechas calendario AAAA-MM-DD en hora argentina (RN-105), ambas inclusive. */
export type Rango = { desde: string; hasta: string }

/** Tope del backend: el período no puede superar los 2 años (`DIAS_MAXIMOS`). */
export const DIAS_MAXIMOS_RANGO = 731

const MS_DIA = 86_400_000

/** Hoy en hora argentina (RN-105), como fecha calendario AAAA-MM-DD. */
export function hoyArg(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
}

export function sumarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * MS_DIA).toISOString().slice(0, 10)
}

/** Días del rango, contando ambos extremos. */
export function diasDelRango(r: Rango): number {
  return Math.round((Date.parse(r.hasta) - Date.parse(r.desde)) / MS_DIA) + 1
}

/** Mensaje de error del rango, o null si el backend lo va a aceptar. */
export function errorDeRango(r: Rango): string | null {
  if (r.desde > r.hasta) return 'La fecha "desde" no puede ser posterior a "hasta".'
  if (diasDelRango(r) > DIAS_MAXIMOS_RANGO) return 'El período no puede superar los 2 años.'
  return null
}

function aFechaCalendario(dia: string): Date {
  // Fecha pura: el picker la muestra en la zona del dispositivo, así que se arma
  // con sus campos locales para que muestre exactamente ese día.
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(a, m - 1, d)
}

function desdeFechaCalendario(f: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`
}

function formatear(dia: string): string {
  const [a, m, d] = dia.split('-')
  return `${d}/${m}/${a}`
}

type Campo = 'desde' | 'hasta'

/**
 * Desde/hasta de la reportería, siempre editables. Los atajos (últimos 30 días,
 * etc.) solo los completan: el período que manda es el que se ve acá.
 */
export function RangoFechas({ rango, onChange }: { rango: Rango; onChange: (r: Rango) => void }) {
  const theme = useTheme()
  const [editando, setEditando] = useState<Campo | null>(null)
  const hoy = hoyArg()

  const elegir = (campo: Campo, dia: string) => {
    onChange({ ...rango, [campo]: dia })
  }

  const onPicker = (event: DateTimePickerEvent, elegida?: Date) => {
    const campo = editando
    // Android cierra el diálogo solo; iOS (inline) espera a "Listo".
    if (Platform.OS !== 'ios') setEditando(null)
    if (event.type === 'dismissed' || !elegida || !campo) return
    elegir(campo, desdeFechaCalendario(elegida))
  }

  const error = errorDeRango(rango)

  const boton = (campo: Campo, label: string) => {
    const activo = editando === campo
    return (
      <Pressable
        onPress={() => setEditando(activo ? null : campo)}
        style={[
          styles.campo,
          {
            backgroundColor: activo ? theme.accentWeak : theme.surface,
            borderColor: activo ? theme.accentLine : theme.border,
          },
        ]}
      >
        <Text style={[styles.label, { color: theme.textDim }]}>{label}</Text>
        <View style={styles.valor}>
          <Feather name="calendar" size={14} color={activo ? theme.accent : theme.textDim} />
          <Text style={[styles.fecha, { color: activo ? theme.accent : theme.text }]}>
            {formatear(rango[campo])}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.fila}>
        {boton('desde', 'Desde')}
        {boton('hasta', 'Hasta')}
      </View>
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
      {editando ? (
        <DateTimePicker
          key={editando}
          value={aFechaCalendario(rango[editando])}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={aFechaCalendario(hoy)}
          onChange={onPicker}
        />
      ) : null}
      {Platform.OS === 'ios' && editando ? (
        <Btn variant="secondary" size="sm" onPress={() => setEditando(null)} style={styles.listo}>
          Listo
        </Btn>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { gap: 8 },
  fila: { flexDirection: 'row', gap: 8 },
  campo: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, gap: 2 },
  label: { fontSize: 12, fontWeight: '600' },
  valor: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fecha: { fontSize: 16, fontWeight: '700' },
  error: { fontSize: 13 },
  listo: { alignSelf: 'flex-end' },
})
