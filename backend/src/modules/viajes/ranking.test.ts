import { describe, expect, it } from 'vitest'
import { aplicarPuestosRanking, puestosCompeticionDesc } from './ranking'

describe('puestosCompeticionDesc', () => {
  it('asigna 1, 2, 3 en orden descendente', () => {
    expect(puestosCompeticionDesc([10, 30, 20])).toEqual([3, 1, 2])
  })

  it('empate: mismo puesto y se salta el siguiente (1, 2, 2, 4)', () => {
    expect(puestosCompeticionDesc([40, 30, 30, 10])).toEqual([1, 2, 2, 4])
  })

  it('nulls quedan sin puesto y no ocupan lugar', () => {
    expect(puestosCompeticionDesc([null, 20, null, 10])).toEqual([null, 1, null, 2])
  })
})

describe('aplicarPuestosRanking', () => {
  const filas = [
    { distancia_m: 10_000, tiempo_movimiento_seg: 3600, velocidad_promedio_kmh: 20 },
    { distancia_m: 12_000, tiempo_movimiento_seg: 3000, velocidad_promedio_kmh: 25 },
    { distancia_m: null, tiempo_movimiento_seg: null, velocidad_promedio_kmh: null },
  ]

  it('deshabilitado: todos los puestos null', () => {
    const out = aplicarPuestosRanking(filas, false)
    expect(out.every((f) => f.puesto_distancia == null && f.puesto_tiempo == null && f.puesto_velocidad == null)).toBe(
      true
    )
  })

  it('habilitado: distancia, tiempo y velocidad independientes', () => {
    const out = aplicarPuestosRanking(filas, true)
    expect(out[0].puesto_distancia).toBe(2)
    expect(out[1].puesto_distancia).toBe(1)
    expect(out[2].puesto_distancia).toBeNull()
    expect(out[0].puesto_tiempo).toBe(1)
    expect(out[1].puesto_tiempo).toBe(2)
    expect(out[1].puesto_velocidad).toBe(1)
    expect(out[0].puesto_velocidad).toBe(2)
  })
})
