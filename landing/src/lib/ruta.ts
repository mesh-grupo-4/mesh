// Geometría de las cintas: mide un trazo "M x y C ..." sin depender del DOM,
// así el HTML estático y las animaciones ubican las ruedas exactamente en el mismo lugar.
export interface PuntoRuta {
  x: number
  y: number
  /** Normal unitaria, para separar una rueda de la cinta. */
  nx: number
  ny: number
}

export interface Ruta {
  largo: number
  punto(t: number): PuntoRuta
  /** t (0..1) en el que la ruta alcanza por primera vez la altura y. */
  tEnY(y: number): number
}

const MUESTRAS_POR_TRAMO = 48

export function crearRuta(d: string): Ruta {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (nums.length < 8 || (nums.length - 2) % 6 !== 0) throw new Error(`Trazo inválido: ${d}`)

  const xs: number[] = []
  const ys: number[] = []
  const largos: number[] = []
  let total = 0
  let [px, py] = [nums[0]!, nums[1]!]
  xs.push(px)
  ys.push(py)
  largos.push(0)

  for (let i = 2; i < nums.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = nums.slice(i, i + 6) as [number, number, number, number, number, number]
    const [x0, y0] = [px, py]
    for (let k = 1; k <= MUESTRAS_POR_TRAMO; k++) {
      const t = k / MUESTRAS_POR_TRAMO
      const m = 1 - t
      const x = m * m * m * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3
      const y = m * m * m * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3
      total += Math.hypot(x - xs[xs.length - 1]!, y - ys[ys.length - 1]!)
      xs.push(x)
      ys.push(y)
      largos.push(total)
    }
    px = x3
    py = y3
  }

  const indice = (objetivo: number) => {
    let a = 0
    let b = largos.length - 1
    while (b - a > 1) {
      const m = (a + b) >> 1
      if (largos[m]! < objetivo) a = m
      else b = m
    }
    return a
  }

  return {
    largo: total,
    punto(t) {
      const objetivo = Math.min(1, Math.max(0, t)) * total
      const a = indice(objetivo)
      const b = Math.min(a + 1, largos.length - 1)
      const tramo = largos[b]! - largos[a]! || 1
      const f = (objetivo - largos[a]!) / tramo
      const dx = xs[b]! - xs[a]!
      const dy = ys[b]! - ys[a]!
      const n = Math.hypot(dx, dy) || 1
      return { x: xs[a]! + dx * f, y: ys[a]! + dy * f, nx: -dy / n, ny: dx / n }
    },
    tEnY(y) {
      for (let i = 0; i < ys.length; i++) {
        if (ys[i]! >= y) return largos[i]! / total
      }
      return 1
    },
  }
}
