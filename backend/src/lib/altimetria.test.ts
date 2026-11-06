import { describe, expect, it } from 'vitest'
import { calcularAltimetria } from './altimetria'

describe('calcularAltimetria', () => {
  it('sin datos devuelve null', () => {
    expect(calcularAltimetria([])).toBeNull()
    expect(calcularAltimetria([Number.NaN])).toBeNull()
  })

  it('un solo punto: sin desnivel, extremos iguales', () => {
    expect(calcularAltimetria([420])).toEqual({
      desnivel_positivo_m: 0,
      desnivel_negativo_m: 0,
      altitud_max_m: 420,
      altitud_min_m: 420,
    })
  })

  it('ignora el ruido por debajo del umbral (terreno plano)', () => {
    const plano = [400, 403, 398, 402, 397, 401, 399, 404, 400]
    const r = calcularAltimetria(plano)!
    expect(r.desnivel_positivo_m).toBe(0)
    expect(r.desnivel_negativo_m).toBe(0)
  })

  it('suma una subida sostenida y la bajada de vuelta', () => {
    // Sube de 500 a 600 de a 2 m y vuelve a bajar.
    const subida = Array.from({ length: 51 }, (_, i) => 500 + i * 2)
    const bajada = Array.from({ length: 51 }, (_, i) => 600 - i * 2)
    const r = calcularAltimetria([...subida, ...bajada])!
    expect(r.desnivel_positivo_m).toBe(100)
    expect(r.desnivel_negativo_m).toBe(100)
    expect(r.altitud_max_m).toBe(600)
    expect(r.altitud_min_m).toBe(500)
  })

  it('no infla el desnivel con ruido montado sobre una subida', () => {
    // Subida real de 60 m con ±2 m de ruido alternado (lo que queda tras la mediana).
    const serie = Array.from({ length: 61 }, (_, i) => 1000 + i + (i % 2 === 0 ? 2 : -2))
    const r = calcularAltimetria(serie)!
    expect(r.desnivel_positivo_m).toBeGreaterThan(50)
    expect(r.desnivel_positivo_m).toBeLessThanOrEqual(64)
    expect(r.desnivel_negativo_m).toBe(0)
  })

  it('arranca a contar desde el valle real, no desde el primer punto', () => {
    // Baja 3 m (ruido, no llega al umbral) y después sube hasta 420.
    const r = calcularAltimetria([400, 397, 405, 412, 420])!
    expect(r.desnivel_positivo_m).toBe(23)
    expect(r.desnivel_negativo_m).toBe(0)
  })

  it('un tramo que no supera el umbral no cuenta', () => {
    const r = calcularAltimetria([400, 404, 400])!
    expect(r.desnivel_positivo_m).toBe(0)
    expect(r.desnivel_negativo_m).toBe(0)
  })
})
