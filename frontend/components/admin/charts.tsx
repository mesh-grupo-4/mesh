import { Feather } from '@expo/vector-icons'
import { useMemo, useState, type ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'

import { useTheme } from '@/components/MeshUI'

/**
 * Gráficos del panel de reportería. Paleta validada con el validador de dataviz
 * contra las superficies de la app (#1c1c1c oscuro / #ffffff claro):
 * - Categórica, máximo 3 series por gráfico (las 3 pasan todos los pares).
 *   En claro el aqua queda < 3:1, por eso todo gráfico de líneas tiene leyenda
 *   y vista de tabla.
 * - Secuencial: un solo tono (azul), de la superficie hacia el azul intenso.
 * El texto nunca usa el color de la serie: valores y rótulos van en tinta de texto.
 */
const SERIES = {
  dark: ['#3987e5', '#d95926', '#199e70'],
  light: ['#2a78d6', '#eb6834', '#1baf7a'],
}
const AZUL_SECUENCIAL = { dark: [0x6d, 0xa7, 0xec], light: [0x10, 0x42, 0x81] }

export function useVizTheme() {
  const theme = useTheme()
  const modo = useColorScheme() === 'light' ? 'light' : 'dark'
  return useMemo(() => {
    const sup = hexARgb(theme.surface)
    const fin = AZUL_SECUENCIAL[modo]
    return {
      ...theme,
      series: SERIES[modo],
      grid: theme.border,
      /** Color secuencial para t ∈ [0, 1]: 0 se funde con la superficie. */
      secuencial(t: number) {
        const k = 0.08 + 0.92 * Math.max(0, Math.min(1, t))
        const c = sup.map((s, i) => Math.round(s + (fin[i] - s) * k))
        return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
      },
      /** Tinta legible sobre una celda secuencial. */
      tintaSobre(t: number) {
        if (modo === 'dark') return t > 0.6 ? '#0f0f0f' : theme.text
        return t > 0.5 ? '#ffffff' : theme.text
      },
    }
  }, [theme, modo])
}

function hexARgb(hex: string): number[] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

// ── Formatos (es-AR) ──────────────────────────────────────────────────────

export function fmtNum(n: number | null | undefined, decimales = 0): string {
  if (n == null) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}

export function fmtPct(t: number | null | undefined, decimales = 0): string {
  if (t == null) return '—'
  return `${fmtNum(t * 100, decimales)} %`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Rótulo de un balde. El balde ya es una fecha calendario argentina (AAAA-MM-DD)
 * calculada por el backend (RN-105): se formatea a mano, sin pasar por `Date`,
 * para que la zona del dispositivo no lo corra un día.
 */
export function fmtBalde(balde: string, granularidad: 'dia' | 'semana' | 'mes'): string {
  const [anio, mes, dia] = balde.split('-').map(Number)
  if (granularidad === 'mes') return `${MESES[mes - 1]} ${String(anio).slice(2)}`
  return `${dia} ${MESES[mes - 1]}`
}

/** Tope "redondo" del eje para que las líneas de grilla caigan en números legibles. */
function topeEje(max: number): number {
  if (max <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(max))
  const f = max / exp
  const paso = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return paso * exp
}

// ── Piezas comunes ────────────────────────────────────────────────────────

export function Leyenda({ items }: { items: { label: string; color: string }[] }) {
  const t = useVizTheme()
  return (
    <View style={styles.leyenda}>
      {items.map((i) => (
        <View key={i.label} style={styles.leyendaItem}>
          <View style={[styles.leyendaMarca, { backgroundColor: i.color }]} />
          <Text style={[styles.leyendaTexto, { color: t.textDim }]}>{i.label}</Text>
        </View>
      ))}
    </View>
  )
}

export type Tabla = { titulo: string; columnas: string[]; filas: (string | number | null)[][] }

export function TablaDatos({ tabla }: { tabla: Tabla }) {
  const t = useVizTheme()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={[styles.tablaFila, { borderBottomColor: t.border }]}>
          {tabla.columnas.map((c, i) => (
            <Text key={c} style={[styles.tablaCelda, styles.tablaCabecera, i > 0 && styles.derecha, { color: t.textDim }]}>
              {c}
            </Text>
          ))}
        </View>
        {tabla.filas.map((fila, r) => (
          <View key={r} style={[styles.tablaFila, { borderBottomColor: t.border }]}>
            {fila.map((v, i) => (
              <Text key={i} style={[styles.tablaCelda, i > 0 && styles.derecha, { color: t.text }]}>
                {typeof v === 'number' ? fmtNum(v, Number.isInteger(v) ? 0 : 1) : v ?? '—'}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

/** Tarjeta de gráfico con título, subtítulo y, si hay tabla, el conmutador gráfico/tabla. */
export function TarjetaGrafico({
  titulo,
  sub,
  tabla,
  children,
}: {
  titulo: string
  sub?: string
  tabla?: Tabla
  children: ReactNode
}) {
  const t = useVizTheme()
  const [verTabla, setVerTabla] = useState(false)
  return (
    <View style={[styles.tarjeta, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.tarjetaCabecera}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tarjetaTitulo, { color: t.text }]}>{titulo}</Text>
          {sub ? <Text style={[styles.tarjetaSub, { color: t.textDim }]}>{sub}</Text> : null}
        </View>
        {tabla ? (
          <Pressable
            onPress={() => setVerTabla((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={verTabla ? 'Ver gráfico' : 'Ver tabla'}
          >
            <Feather name={verTabla ? 'bar-chart-2' : 'list'} size={18} color={t.textDim} />
          </Pressable>
        ) : null}
      </View>
      {verTabla && tabla ? <TablaDatos tabla={tabla} /> : children}
    </View>
  )
}

/** Número principal con su variación contra el período anterior. */
export function Indicador({
  label,
  valor,
  variacion,
  unidadVariacion = '%',
  invertir = false,
  pie,
}: {
  label: string
  valor: string
  /** Variación; null = sin base de comparación. */
  variacion?: number | null
  unidadVariacion?: '%' | 'pp'
  /** true cuando subir es malo (p. ej. incidentes). */
  invertir?: boolean
  pie?: string
}) {
  const t = useVizTheme()
  const sube = (variacion ?? 0) > 0
  const bueno = variacion == null || variacion === 0 ? null : sube !== invertir
  return (
    <View style={[styles.indicador, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[styles.indicadorLabel, { color: t.textDim }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.indicadorValor, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      {variacion !== undefined ? (
        <View style={styles.indicadorDelta}>
          {variacion != null && variacion !== 0 ? (
            <Feather
              name={sube ? 'arrow-up-right' : 'arrow-down-right'}
              size={14}
              color={bueno ? '#0ca30c' : '#d03b3b'}
            />
          ) : null}
          <Text style={[styles.indicadorDeltaTexto, { color: t.textDim }]}>
            {variacion == null
              ? 'sin base para comparar'
              : `${variacion > 0 ? '+' : ''}${fmtNum(variacion, 1)} ${unidadVariacion === 'pp' ? 'pp' : '%'} vs. anterior`}
          </Text>
        </View>
      ) : null}
      {pie ? <Text style={[styles.indicadorDeltaTexto, { color: t.textMute }]}>{pie}</Text> : null}
    </View>
  )
}

export function FilaIndicadores({ children }: { children: ReactNode }) {
  return <View style={styles.filaIndicadores}>{children}</View>
}

// ── Línea ─────────────────────────────────────────────────────────────────

const ALTO_LINEA = 180
const MARGEN = { izq: 40, der: 12, arr: 10, abj: 22 }

/**
 * Serie temporal de 1 a 3 medidas en la misma escala. Tocar o arrastrar sobre el
 * gráfico muestra la línea guía y el valor de cada serie en ese balde.
 */
export function GraficoLineas<K extends string>({
  datos,
  series,
  granularidad,
  formato = (n) => fmtNum(n),
}: {
  datos: ({ balde: string } & Record<K, number>)[]
  series: { clave: K; label: string }[]
  granularidad: 'dia' | 'semana' | 'mes'
  formato?: (n: number) => string
}) {
  const t = useVizTheme()
  const [ancho, setAncho] = useState(0)
  const [sel, setSel] = useState<number | null>(null)

  const max = topeEje(Math.max(0, ...datos.flatMap((d) => series.map((s) => d[s.clave]))))
  const anchoPlot = Math.max(1, ancho - MARGEN.izq - MARGEN.der)
  const altoPlot = ALTO_LINEA - MARGEN.arr - MARGEN.abj
  const x = (i: number) => MARGEN.izq + (datos.length <= 1 ? anchoPlot / 2 : (i / (datos.length - 1)) * anchoPlot)
  const y = (v: number) => MARGEN.arr + altoPlot - (v / max) * altoPlot

  const elegir = (e: GestureResponderEvent) => {
    if (!datos.length) return
    const rel = (e.nativeEvent.locationX - MARGEN.izq) / anchoPlot
    setSel(Math.max(0, Math.min(datos.length - 1, Math.round(rel * (datos.length - 1)))))
  }

  const rotulosX = datos.length
    ? [...new Set([0, Math.floor((datos.length - 1) / 2), datos.length - 1])]
    : []

  return (
    <View>
      {series.length > 1 ? (
        <Leyenda items={series.map((s, i) => ({ label: s.label, color: t.series[i] }))} />
      ) : null}
      <View
        onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={elegir}
        onResponderMove={elegir}
        style={{ height: ALTO_LINEA }}
        accessibilityLabel="Gráfico de líneas. Tocá para ver los valores."
      >
        {ancho > 0 ? (
          <Svg width={ancho} height={ALTO_LINEA}>
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={MARGEN.izq}
                x2={ancho - MARGEN.der}
                y1={y(max * f)}
                y2={y(max * f)}
                stroke={t.grid}
                strokeWidth={1}
              />
            ))}
            {sel != null ? (
              <Line x1={x(sel)} x2={x(sel)} y1={MARGEN.arr} y2={MARGEN.arr + altoPlot} stroke={t.textMute} strokeWidth={1} />
            ) : null}
            {series.map((s, i) => (
              <Path
                key={s.clave}
                d={datos.map((d, j) => `${j ? 'L' : 'M'}${x(j)},${y(d[s.clave])}`).join(' ')}
                stroke={t.series[i]}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {sel != null
              ? series.map((s, i) => (
                  <Circle
                    key={s.clave}
                    cx={x(sel)}
                    cy={y(datos[sel][s.clave])}
                    r={4}
                    fill={t.series[i]}
                    stroke={t.surface}
                    strokeWidth={2}
                  />
                ))
              : null}
          </Svg>
        ) : null}
        {[0, 0.5, 1].map((f) => (
          <Text key={f} style={[styles.ejeY, { top: y(max * f) - 7, color: t.textMute }]}>
            {formato(max * f)}
          </Text>
        ))}
        {rotulosX.map((i) => (
          <Text
            key={i}
            style={[
              styles.ejeX,
              { color: t.textMute, left: Math.min(Math.max(x(i) - 30, MARGEN.izq - 10), ancho - 60) },
            ]}
          >
            {datos[i] ? fmtBalde(datos[i].balde, granularidad) : ''}
          </Text>
        ))}
      </View>
      {sel != null && datos[sel] ? (
        <View style={[styles.tooltip, { backgroundColor: t.surface2, borderColor: t.border }]}>
          <Text style={[styles.tooltipTitulo, { color: t.text }]}>
            {granularidad === 'semana' ? 'Semana del ' : ''}
            {fmtBalde(datos[sel].balde, granularidad)}
          </Text>
          {series.map((s, i) => (
            <View key={s.clave} style={styles.tooltipFila}>
              <View style={[styles.leyendaMarca, { backgroundColor: t.series[i] }]} />
              <Text style={[styles.tooltipTexto, { color: t.textDim }]}>{s.label}</Text>
              <Text style={[styles.tooltipValor, { color: t.text }]}>{formato(datos[sel][s.clave])}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.ayuda, { color: t.textMute }]}>Tocá o arrastrá sobre el gráfico para ver los valores.</Text>
      )}
    </View>
  )
}

// ── Barras horizontales ───────────────────────────────────────────────────

/**
 * Ranking o distribución de una sola medida. Cada barra lleva su valor escrito al
 * lado, así que no necesita tooltip ni leyenda (una sola serie).
 */
export function BarrasHorizontales({
  items,
  formato = (n) => fmtNum(n),
  max: maxFijo,
}: {
  items: { label: string; valor: number; detalle?: string }[]
  formato?: (n: number) => string
  /** Para tasas: 1. Por defecto, el mayor valor. */
  max?: number
}) {
  const t = useVizTheme()
  const max = maxFijo ?? Math.max(1, ...items.map((i) => i.valor))
  if (!items.length) {
    return <Text style={[styles.ayuda, { color: t.textMute }]}>Sin datos en el período.</Text>
  }
  return (
    <View style={{ gap: 10 }}>
      {items.map((i) => (
        <View key={i.label}>
          <View style={styles.barraCabecera}>
            <Text style={[styles.barraLabel, { color: t.text }]} numberOfLines={1}>
              {i.label}
            </Text>
            <Text style={[styles.barraValor, { color: t.text }]}>
              {formato(i.valor)}
              {i.detalle ? <Text style={{ color: t.textDim }}> · {i.detalle}</Text> : null}
            </Text>
          </View>
          <View style={[styles.barraPista, { backgroundColor: t.surface2 }]}>
            <View
              style={[
                styles.barra,
                { backgroundColor: t.series[0], width: `${Math.max(i.valor > 0 ? 1.5 : 0, (i.valor / max) * 100)}%` },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  )
}

// ── Mapa de calor ─────────────────────────────────────────────────────────

/**
 * Grilla de magnitudes con un solo tono. Con `mostrarValores` cada celda lleva su
 * número (cohortes); si no, tocar una celda muestra su valor abajo (horarios).
 */
export function MapaCalor({
  filas,
  columnas,
  valor,
  max,
  formato = (n) => fmtNum(n),
  mostrarValores = false,
  describir,
  anchoCelda = 14,
  anchoRotulo = 36,
}: {
  filas: string[]
  columnas: string[]
  valor: (fila: number, col: number) => number | null
  max: number
  formato?: (n: number) => string
  mostrarValores?: boolean
  describir?: (fila: number, col: number, v: number | null) => string
  anchoCelda?: number
  anchoRotulo?: number
}) {
  const t = useVizTheme()
  const [sel, setSel] = useState<[number, number] | null>(null)
  const alto = mostrarValores ? 28 : 16
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: 'row', marginLeft: anchoRotulo }}>
            {columnas.map((c, j) => (
              <Text key={j} style={[styles.calorCol, { width: anchoCelda, color: t.textMute }]}>
                {c}
              </Text>
            ))}
          </View>
          {filas.map((f, i) => (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.calorFila, { width: anchoRotulo, color: t.textDim }]} numberOfLines={1}>
                {f}
              </Text>
              {columnas.map((_, j) => {
                const v = valor(i, j)
                const k = v == null || max <= 0 ? 0 : v / max
                return (
                  <Pressable
                    key={j}
                    onPress={() => setSel([i, j])}
                    style={{ width: anchoCelda, height: alto, padding: 1 }}
                  >
                    <View
                      style={[
                        styles.calorCelda,
                        {
                          backgroundColor: v == null ? 'transparent' : t.secuencial(k),
                          borderColor: sel && sel[0] === i && sel[1] === j ? t.text : 'transparent',
                        },
                      ]}
                    >
                      {mostrarValores && v != null ? (
                        <Text style={[styles.calorValor, { color: t.tintaSobre(k) }]}>{formato(v)}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.calorPie}>
        <Text style={[styles.ayuda, { color: t.textMute, marginTop: 0 }]}>
          {sel && describir ? describir(sel[0], sel[1], valor(sel[0], sel[1])) : 'Tocá una celda para ver el valor.'}
        </Text>
        <View style={styles.calorEscala}>
          <Text style={[styles.ayuda, { color: t.textMute, marginTop: 0 }]}>menos</Text>
          {[0, 0.25, 0.5, 0.75, 1].map((k) => (
            <View key={k} style={[styles.calorEscalaPaso, { backgroundColor: t.secuencial(k) }]} />
          ))}
          <Text style={[styles.ayuda, { color: t.textMute, marginTop: 0 }]}>más</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  tarjeta: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tarjetaTitulo: { fontSize: 16, fontWeight: '700' },
  tarjetaSub: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaMarca: { width: 10, height: 10, borderRadius: 3 },
  leyendaTexto: { fontSize: 13 },
  ejeY: { position: 'absolute', left: 0, width: MARGEN.izq - 6, textAlign: 'right', fontSize: 11 },
  ejeX: { position: 'absolute', bottom: 0, width: 60, textAlign: 'center', fontSize: 11 },
  tooltip: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8, gap: 4 },
  tooltipTitulo: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  tooltipFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tooltipTexto: { fontSize: 13, flex: 1 },
  tooltipValor: { fontSize: 13, fontWeight: '700' },
  ayuda: { fontSize: 12, marginTop: 8 },
  barraCabecera: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  barraLabel: { fontSize: 14, flex: 1 },
  barraValor: { fontSize: 14, fontWeight: '700' },
  barraPista: { height: 10, borderRadius: 4, overflow: 'hidden' },
  barra: { height: 10, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  calorCol: { fontSize: 9, textAlign: 'center' },
  calorFila: { fontSize: 11 },
  calorCelda: { flex: 1, borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  calorValor: { fontSize: 11, fontWeight: '600' },
  calorPie: { marginTop: 8, gap: 6 },
  calorEscala: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calorEscalaPaso: { width: 16, height: 10, borderRadius: 2 },
  indicador: { flexBasis: '47%', flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  indicadorLabel: { fontSize: 13 },
  indicadorValor: { fontSize: 26, fontWeight: '800' },
  indicadorDelta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  indicadorDeltaTexto: { fontSize: 12 },
  filaIndicadores: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tablaFila: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tablaCelda: { width: 96, paddingVertical: 6, paddingHorizontal: 4, fontSize: 13 },
  tablaCabecera: { fontWeight: '700', fontSize: 12 },
  derecha: { textAlign: 'right' },
})
