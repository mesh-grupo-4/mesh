import { describe, expect, it } from 'vitest'
import { esMotorizado } from './actividad'

describe('esMotorizado — RN-070', () => {
  it.each(['moto', 'auto'])('%s es motorizado (sin rankings ni velocidades)', (tipo) => {
    expect(esMotorizado(tipo)).toBe(true)
  })

  it.each(['bici', 'running', 'trekking', 'otro'])('%s no es motorizado', (tipo) => {
    expect(esMotorizado(tipo)).toBe(false)
  })

  it('tolera valores nulos', () => {
    expect(esMotorizado(null)).toBe(false)
    expect(esMotorizado(undefined)).toBe(false)
  })
})
