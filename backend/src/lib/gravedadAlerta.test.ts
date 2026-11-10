import { describe, expect, it } from 'vitest'
import { CANAL_POR_GRAVEDAD, gravedadDeAlerta } from './gravedadAlerta'

describe('gravedadDeAlerta', () => {
  it('trata el peligro como crítico: hay una persona en riesgo', () => {
    expect(gravedadDeAlerta('peligro')).toBe('critica')
  })

  it('deja el aviso informativo en el nivel más bajo', () => {
    expect(gravedadDeAlerta('informacion')).toBe('informativa')
  })

  it.each(['parada', 'combustible', 'desvio', 'atraso'])('%s es importante', (tipo) => {
    expect(gravedadDeAlerta(tipo)).toBe('importante')
  })

  it('cada gravedad sale por un canal de Android distinto', () => {
    expect(new Set(Object.values(CANAL_POR_GRAVEDAD)).size).toBe(3)
  })
})
