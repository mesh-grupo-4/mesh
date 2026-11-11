import { Feather } from '@expo/vector-icons'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { AvatarFallback, colorFromName } from '@/components/AvatarFallback'
import { ChipFiltro, DivisorChipsFiltro, FilaChipsFiltro } from '@/components/BarraFiltros'
import { useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import { formatMonto } from '@/lib/format'
import type { BalanceGastosApi, GastoApi } from '@/lib/gastosApi'
import { formatearEnArg } from '@/lib/tiempoArg'

type Theme = ReturnType<typeof useTheme>

/** Diferencias menores a un centavo son redondeo, no deuda. */
const SALDO_MINIMO = 0.01
const MAX_AVATARES = 5

// ── Totales propios ─────────────────────────────────────────────────────────

export type TotalesGastos = {
  total: number
  /** Lo que pagó quien mira. */
  pagado: number
  /** Lo que le toca a quien mira, sumando su parte de cada gasto. */
  parte: number
  /** `pagado - parte`: positivo = le deben, negativo = debe. */
  saldo: number
}

export function totalesGastos(gastos: GastoApi[], miId: string): TotalesGastos {
  let total = 0
  let pagado = 0
  let parte = 0
  for (const g of gastos) {
    total += g.monto
    if (g.usuario_id === miId) pagado += g.monto
    if (g.participantes.some((p) => p.usuario_id === miId)) parte += g.monto_por_persona
  }
  return { total, pagado, parte, saldo: pagado - parte }
}

function colorSaldo(saldo: number, theme: Theme): string {
  if (saldo > SALDO_MINIMO) return theme.good
  if (saldo < -SALDO_MINIMO) return theme.danger
  return theme.textDim
}

/** Tarjeta de cabecera: total del viaje y cómo queda parado quien mira. */
export function ResumenGastosCard({
  gastos,
  miId,
  theme,
}: {
  gastos: GastoApi[]
  miId: string
  theme: Theme
}) {
  const t = totalesGastos(gastos, miId)
  const color = colorSaldo(t.saldo, theme)
  const estado =
    t.saldo > SALDO_MINIMO
      ? `Te deben ${formatMonto(t.saldo)}`
      : t.saldo < -SALDO_MINIMO
        ? `Debés ${formatMonto(-t.saldo)}`
        : 'Estás al día'

  return (
    <View style={[styles.resumen, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.resumenTotal}>
        <Text style={[styles.resumenLabel, { color: theme.textDim }]}>TOTAL DEL VIAJE</Text>
        <Text style={[styles.resumenMonto, { color: theme.text }]}>{formatMonto(t.total)}</Text>
        <Text style={[styles.resumenCantidad, { color: theme.textMute }]}>
          {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}
        </Text>
      </View>

      <View style={[styles.resumenFila, { borderTopColor: theme.border }]}>
        <View style={styles.resumenDato}>
          <Text style={[styles.resumenDatoLabel, { color: theme.textMute }]}>Pagaste</Text>
          <Text style={[styles.resumenDatoValor, { color: theme.text }]}>{formatMonto(t.pagado)}</Text>
        </View>
        <View style={[styles.resumenDivisor, { backgroundColor: theme.border }]} />
        <View style={styles.resumenDato}>
          <Text style={[styles.resumenDatoLabel, { color: theme.textMute }]}>Tu parte</Text>
          <Text style={[styles.resumenDatoValor, { color: theme.text }]}>{formatMonto(t.parte)}</Text>
        </View>
        <View style={[styles.resumenDivisor, { backgroundColor: theme.border }]} />
        <View style={styles.resumenDato}>
          <Text style={[styles.resumenDatoLabel, { color: theme.textMute }]}>Tu saldo</Text>
          <Text style={[styles.resumenDatoValor, { color }]} numberOfLines={1} adjustsFontSizeToFit>
            {estado}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ── Filtros ─────────────────────────────────────────────────────────────────

/** `todos`, lo que pagó quien mira, lo que lo incluye, o lo que pagó otra persona (`pago:<id>`). */
export type FiltroGastos = 'todos' | 'pague' | 'incluido' | `pago:${string}`

export function filtrarGastos(gastos: GastoApi[], filtro: FiltroGastos, miId: string): GastoApi[] {
  if (filtro === 'todos') return gastos
  if (filtro === 'pague') return gastos.filter((g) => g.usuario_id === miId)
  if (filtro === 'incluido') {
    return gastos.filter((g) => g.participantes.some((p) => p.usuario_id === miId))
  }
  const pagador = filtro.slice('pago:'.length)
  return gastos.filter((g) => g.usuario_id === pagador)
}

/** Chips de filtro: los fijos y uno por cada persona que pagó algo. */
export function FiltrosGastos({
  gastos,
  miId,
  filtro,
  onChange,
}: {
  gastos: GastoApi[]
  miId: string
  filtro: FiltroGastos
  onChange: (filtro: FiltroGastos) => void
}) {
  const pagadores = new Map<string, string>()
  for (const g of gastos) {
    if (g.usuario_id !== miId) pagadores.set(g.usuario_id, g.usuario_nombre)
  }

  return (
    <View style={styles.filtros}>
      <FilaChipsFiltro>
        <ChipFiltro label="Todos" activo={filtro === 'todos'} onPress={() => onChange('todos')} />
        <ChipFiltro label="Pagué yo" activo={filtro === 'pague'} onPress={() => onChange('pague')} />
        <ChipFiltro
          label="Me incluyen"
          activo={filtro === 'incluido'}
          onPress={() => onChange('incluido')}
        />
        {pagadores.size > 0 ? <DivisorChipsFiltro /> : null}
        {[...pagadores].map(([id, nombre]) => (
          <ChipFiltro
            key={id}
            label={`Pagó ${nombre.split(' ')[0]}`}
            activo={filtro === `pago:${id}`}
            onPress={() => onChange(`pago:${id}`)}
          />
        ))}
      </FilaChipsFiltro>
    </View>
  )
}

// ── Gasto ───────────────────────────────────────────────────────────────────

export function GastoFila({
  gasto,
  miId,
  theme,
  enEdicion = false,
  onEditar,
  onEliminar,
}: {
  gasto: GastoApi
  /** Quien mira: define qué parte le toca y cómo se pinta el gasto. */
  miId: string
  theme: Theme
  enEdicion?: boolean
  /** Sin handlers la fila es de solo lectura. */
  onEditar?: () => void
  onEliminar?: () => void
}) {
  const fecha = formatearEnArg(
    gasto.created_at,
    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    ''
  )
  const pagueYo = gasto.usuario_id === miId
  const meIncluye = gasto.participantes.some((p) => p.usuario_id === miId)
  const colorPagador = colorFromName(gasto.usuario_nombre)
  const visibles = gasto.participantes.slice(0, MAX_AVATARES)
  const ocultos = gasto.participantes.length - visibles.length
  const acciones = gasto.puede_editar && (onEditar || onEliminar)

  // Lo que este gasto mueve para quien mira: recupera lo que pagó por otros o debe su parte.
  const miParte = meIncluye ? gasto.monto_por_persona : 0
  const efecto = pagueYo ? gasto.monto - miParte : -miParte
  const etiquetaEfecto =
    efecto > SALDO_MINIMO
      ? `Te deben ${formatMonto(efecto)}`
      : efecto < -SALDO_MINIMO
        ? `Tu parte ${formatMonto(-efecto)}`
        : pagueYo
          ? 'Lo pagaste para vos'
          : 'No participás'

  return (
    <View
      style={[
        styles.gasto,
        { backgroundColor: theme.surface, borderColor: enEdicion ? theme.accent : theme.border },
      ]}
    >
      <View style={[styles.gastoBanda, { backgroundColor: colorPagador }]} />

      <View style={styles.gastoCuerpo}>
        <View style={styles.gastoHead}>
          <AvatarFallback nombre={gasto.usuario_nombre || '?'} size={36} />
          <View style={styles.gastoTitulos}>
            <Text style={[styles.gastoDescripcion, { color: theme.text }]} numberOfLines={2}>
              {gasto.descripcion}
            </Text>
            <Text style={[styles.gastoMeta, { color: theme.textMute }]} numberOfLines={1}>
              {pagueYo ? 'Pagaste vos' : `Pagó ${gasto.usuario_nombre}`}
              {fecha ? ` · ${fecha}` : ''}
            </Text>
          </View>
          <Text style={[styles.gastoMonto, { color: theme.text }]}>{formatMonto(gasto.monto)}</Text>
        </View>

        <View style={styles.gastoReparto}>
          <View style={styles.avatares}>
            {visibles.map((p, i) => (
              <View
                key={p.usuario_id}
                style={[styles.avatarAro, { borderColor: theme.surface, marginLeft: i === 0 ? 0 : -7 }]}
              >
                <AvatarFallback nombre={p.nombre || '?'} size={20} />
              </View>
            ))}
            {ocultos > 0 ? (
              <Text style={[styles.avataresMas, { color: theme.textMute }]}>+{ocultos}</Text>
            ) : null}
          </View>
          <Text style={[styles.gastoPorPersona, { color: theme.textDim }]} numberOfLines={1}>
            {formatMonto(gasto.monto_por_persona)} c/u · {gasto.participantes.length}{' '}
            {gasto.participantes.length === 1 ? 'persona' : 'personas'}
          </Text>
        </View>

        <View style={styles.gastoPie}>
          <View
            style={[
              styles.efecto,
              {
                backgroundColor:
                  efecto > SALDO_MINIMO
                    ? `${theme.good}22`
                    : efecto < -SALDO_MINIMO
                      ? theme.dangerWeak
                      : theme.surface2,
              },
            ]}
          >
            <Text style={[styles.efectoTxt, { color: colorSaldo(efecto, theme) }]}>{etiquetaEfecto}</Text>
          </View>

          {acciones ? (
            <View style={styles.gastoAcciones}>
              {onEditar ? (
                <Pressable
                  onPress={onEditar}
                  hitSlop={8}
                  style={styles.accionBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${gasto.descripcion}`}
                >
                  <Feather name="edit-2" size={17} color={theme.textDim} />
                </Pressable>
              ) : null}
              {onEliminar ? (
                <Pressable
                  onPress={onEliminar}
                  hitSlop={8}
                  style={styles.accionBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Eliminar ${gasto.descripcion}`}
                >
                  <Feather name="trash-2" size={17} color={theme.danger} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

// ── Balance ─────────────────────────────────────────────────────────────────

export function BalanceCard({
  balance,
  miId,
  theme,
}: {
  balance: BalanceGastosApi | null
  miId: string
  theme: Theme
}) {
  if (!balance) {
    return (
      <View style={[styles.balanceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  const saldos = [...balance.por_persona].sort((a, b) => b.saldo - a.saldo)

  return (
    <View style={[styles.balanceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.balanceTitulo, { color: theme.text }]}>Cómo saldar las cuentas</Text>

      {balance.transacciones.length === 0 ? (
        <View style={styles.balanceAlDia}>
          <Feather name="check-circle" size={18} color={theme.good} />
          <Text style={[styles.balanceVacio, { color: theme.textDim }]}>
            Todos pagaron su parte: no hay nada que saldar.
          </Text>
        </View>
      ) : (
        balance.transacciones.map((t) => {
          const debo = t.de_id === miId
          const meDeben = t.para_id === miId
          const color = debo ? theme.danger : meDeben ? theme.good : theme.text
          return (
            <View
              key={`${t.de_id}-${t.para_id}`}
              style={[
                styles.transaccion,
                {
                  backgroundColor: debo
                    ? theme.dangerWeak
                    : meDeben
                      ? `${theme.good}22`
                      : theme.surface2,
                },
              ]}
            >
              <AvatarFallback nombre={t.de_nombre || '?'} size={26} />
              <Feather name="arrow-right" size={14} color={theme.textMute} />
              <AvatarFallback nombre={t.para_nombre || '?'} size={26} />
              <View style={styles.transaccionTexto}>
                <Text style={[styles.transaccionNombres, { color: theme.text }]} numberOfLines={2}>
                  {debo ? 'Vos' : t.de_nombre}
                  <Text style={{ color: theme.textMute }}>{debo ? ' le pagás a ' : ' le paga a '}</Text>
                  {meDeben ? 'vos' : t.para_nombre}
                </Text>
              </View>
              <Text style={[styles.transaccionMonto, { color }]}>{formatMonto(t.monto)}</Text>
            </View>
          )
        })
      )}

      {saldos.length > 0 ? (
        <View style={[styles.saldos, { borderTopColor: theme.border }]}>
          <Text style={[styles.resumenLabel, { color: theme.textDim }]}>SALDO POR PERSONA</Text>
          {saldos.map((s) => (
            <View key={s.usuario_id} style={styles.saldoFila}>
              <AvatarFallback nombre={s.nombre || '?'} size={22} />
              <View style={styles.saldoTexto}>
                <Text style={[styles.saldoNombre, { color: theme.text }]} numberOfLines={1}>
                  {s.usuario_id === miId ? `${s.nombre} (vos)` : s.nombre}
                </Text>
                <Text style={[styles.saldoDetalle, { color: theme.textMute }]} numberOfLines={1}>
                  Pagó {formatMonto(s.pagado)} · le tocaba {formatMonto(s.debe)}
                </Text>
              </View>
              <Text style={[styles.saldoMonto, { color: colorSaldo(s.saldo, theme) }]}>
                {s.saldo > SALDO_MINIMO ? '+' : ''}
                {Math.abs(s.saldo) < SALDO_MINIMO ? formatMonto(0) : formatMonto(s.saldo)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  resumen: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  resumenTotal: { alignItems: 'center', paddingTop: 16, paddingBottom: 14, gap: 2 },
  resumenLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  resumenMonto: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  resumenCantidad: { fontSize: 12.5, fontWeight: '600' },
  resumenFila: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 12 },
  resumenDato: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  resumenDatoLabel: { fontSize: 11.5, fontWeight: '600' },
  resumenDatoValor: { fontSize: 14.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  resumenDivisor: { width: 1, height: 30 },

  // La fila de chips trae su propio margen lateral: compensa el padding de la lista.
  filtros: { marginHorizontal: -16 },

  gasto: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  gastoBanda: { width: 5 },
  gastoCuerpo: { flex: 1, padding: 12, gap: 10 },
  gastoHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gastoTitulos: { flex: 1, gap: 2 },
  gastoDescripcion: { fontSize: 15, fontWeight: '700' },
  gastoMeta: { fontSize: 12.5 },
  gastoMonto: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  gastoReparto: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatares: { flexDirection: 'row', alignItems: 'center' },
  avatarAro: { borderWidth: 1.5, borderRadius: 12 },
  avataresMas: { fontSize: 11.5, fontWeight: '700', marginLeft: 4 },
  gastoPorPersona: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  gastoPie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  efecto: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  efectoTxt: { fontSize: 12.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  gastoAcciones: { flexDirection: 'row', gap: 6 },
  accionBtn: { padding: 6 },

  balanceCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  balanceTitulo: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  balanceAlDia: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceVacio: { flex: 1, fontSize: 14, lineHeight: 20 },
  transaccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  transaccionTexto: { flex: 1 },
  transaccionNombres: { fontSize: 13.5, fontWeight: '700' },
  transaccionMonto: { fontSize: 14.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  saldos: { borderTopWidth: 1, marginTop: 6, paddingTop: 12, gap: 10 },
  saldoFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saldoTexto: { flex: 1 },
  saldoNombre: { fontSize: 13.5, fontWeight: '700' },
  saldoDetalle: { fontSize: 12 },
  saldoMonto: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
})
