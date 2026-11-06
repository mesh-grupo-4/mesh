// Plan, tabla 4.3: los tokens tienen que seguir dando los contrastes acordados.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const color = (nombre: string) => {
  const m = css.match(new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`Falta el token --${nombre}`)
  return m[1]!
}
const lineal = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminancia = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lineal(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

describe('contrastes de la tabla 4.3', () => {
  const tabla: [string, string, number][] = [
    ['tinta', 'naranja', 5.18],
    ['blanco', 'naranja', 3.6],
    ['naranja', 'crema', 3.2],
    ['naranja-texto', 'crema', 4.89],
    ['naranja', 'noche', 5.32],
    ['tinta', 'crema', 16.61],
    ['tinta-suave', 'crema', 4.94],
    ['hueso-suave', 'noche', 6.4],
    ['moto-acento', 'moto-fondo', 13.89],
  ]
  for (const [texto, fondo, esperado] of tabla) {
    it(`${texto} sobre ${fondo}: ${esperado}`, () => {
      expect(contraste(color(texto), color(fondo))).toBeCloseTo(esperado, 1)
    })
  }

  it('crema sobre el verde de trekking supera 4,5:1', () => {
    expect(contraste(color('crema'), '#3E4F3A')).toBeGreaterThanOrEqual(4.5)
  })
})
