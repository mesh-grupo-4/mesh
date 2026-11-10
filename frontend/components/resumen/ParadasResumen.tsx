import { StyleSheet, Text, View } from 'react-native'

import { Badge, useTheme } from '@/components/MeshUI'
import { formatDurationHm, formatHoraCorta } from '@/lib/format'
import { CATEGORIAS_PARADA } from '@/lib/paradasApi'
import type { ParadaResumenApi } from '@/lib/viajesApi'

function duracionLegible(segundos: number): string {
  return segundos < 60 ? 'menos de 1 min' : formatDurationHm(segundos)
}

function titulo(parada: ParadaResumenApi): string {
  if (parada.tipo === 'incidente_detectado') return '⚠️ Posible incidente'
  const categoria = CATEGORIAS_PARADA.find((c) => c.id === parada.categoria)
  return categoria ? `${categoria.emoji} ${categoria.label}` : 'Parada'
}

function horario(parada: ParadaResumenApi): string {
  const inicio = formatHoraCorta(parada.inicio)
  if (parada.fin == null || parada.duracion_seg == null) return `Desde las ${inicio}`
  return `${inicio} a ${formatHoraCorta(parada.fin)} · ${duracionLegible(parada.duracion_seg)}`
}

function quien(parada: ParadaResumenApi, esGrupal: boolean): string | null {
  if (parada.grupal) return `La pidió ${parada.nombre}`
  if (!esGrupal) return null
  return parada.es_propia ? 'Vos' : parada.nombre
}

/** Detalle de las paradas para el cierre; no se renderiza si no hubo ninguna. */
export function ParadasResumen({
  paradas,
  esGrupal,
}: {
  paradas: ParadaResumenApi[]
  esGrupal: boolean
}) {
  const theme = useTheme()
  if (paradas.length === 0) return null

  const masLarga = Math.max(...paradas.map((p) => p.duracion_seg ?? 0))
  const resumen = [
    paradas.length === 1 ? '1 parada' : `${paradas.length} paradas`,
    paradas.length > 1 && masLarga > 0 ? `la más larga: ${duracionLegible(masLarga)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <View style={styles.cabecera}>
        <Text style={[styles.seccion, { color: theme.text }]}>Paradas</Text>
        <Text style={[styles.resumen, { color: theme.textDim }]}>{resumen}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {paradas.map((parada, idx) => {
          const persona = quien(parada, esGrupal)
          return (
            <View key={parada.id}>
              {idx > 0 ? <View style={[styles.separador, { backgroundColor: theme.border }]} /> : null}
              <View style={styles.fila}>
                <View style={styles.encabezadoFila}>
                  <Text style={[styles.titulo, { color: theme.text }]} numberOfLines={1}>
                    {titulo(parada)}
                  </Text>
                  {parada.grupal ? <Badge tone="accent">Todo el grupo</Badge> : null}
                </View>
                <Text style={[styles.detalle, { color: theme.textDim }]}>{horario(parada)}</Text>
                {persona ? (
                  <Text style={[styles.detalle, { color: theme.textDim }]}>{persona}</Text>
                ) : null}
                {parada.tipo === 'incidente_detectado' && parada.confirmado_bien ? (
                  <Text style={[styles.detalle, { color: theme.textDim }]}>
                    Confirmó que estaba bien
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  cabecera: { marginTop: 6, gap: 2 },
  seccion: { fontSize: 15, fontWeight: '700' },
  resumen: { fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1.2, borderRadius: 12, overflow: 'hidden' },
  separador: { height: 1, marginHorizontal: 12 },
  fila: { paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  encabezadoFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titulo: { flex: 1, fontSize: 14, fontWeight: '600' },
  detalle: { fontSize: 13, lineHeight: 18 },
})
