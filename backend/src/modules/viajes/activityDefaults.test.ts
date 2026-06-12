import { describe, expect, it } from 'vitest'
import { parametrosPorActividad } from './activityDefaults'

describe('parametrosPorActividad', () => {
  it('asigna defaults de moto (RN-021)', () => {
    expect(parametrosPorActividad('moto')).toEqual({
      velocidadEsperada: 120,
      distanciaMaxSeparacion: 1000,
    })
  })

  it('asigna defaults de bici', () => {
    expect(parametrosPorActividad('bici')).toEqual({
      velocidadEsperada: 35,
      distanciaMaxSeparacion: 300,
    })
  })

  it('asigna defaults de running', () => {
    expect(parametrosPorActividad('running')).toEqual({
      velocidadEsperada: 15,
      distanciaMaxSeparacion: 100,
    })
  })

  it('asigna defaults de trekking', () => {
    expect(parametrosPorActividad('trekking')).toEqual({
      velocidadEsperada: 5,
      distanciaMaxSeparacion: 50,
    })
  })
})
