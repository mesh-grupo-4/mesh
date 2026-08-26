import { describe, expect, it } from 'vitest'
import { itemsSugeridos } from './checklistDefaults'

const ACTIVIDADES = ['moto', 'bici', 'running', 'trekking', 'otro'] as const

describe('RN-026 — ítems sugeridos por tipo de actividad', () => {
  it('cubre las cinco actividades de RN-021 con al menos un ítem', () => {
    for (const actividad of ACTIVIDADES) {
      expect(itemsSugeridos(actividad).length).toBeGreaterThan(0)
    }
  })

  it('no repite textos dentro de una misma actividad', () => {
    for (const actividad of ACTIVIDADES) {
      const items = itemsSugeridos(actividad)
      expect(new Set(items).size).toBe(items.length)
    }
  })

  it('respeta el límite de 120 caracteres del campo texto', () => {
    for (const actividad of ACTIVIDADES) {
      for (const item of itemsSugeridos(actividad)) {
        expect(item.trim()).toBe(item)
        expect(item.length).toBeGreaterThan(0)
        expect(item.length).toBeLessThanOrEqual(120)
      }
    }
  })

  it('sugiere equipamiento propio de cada actividad, no una lista genérica', () => {
    expect(itemsSugeridos('moto')).toContain('Casco')
    expect(itemsSugeridos('bici')).toContain('Inflador')
    expect(itemsSugeridos('trekking')).toContain('Calzado de trekking')
    expect(itemsSugeridos('running')).toContain('Zapatillas de running')
    expect(itemsSugeridos('moto')).not.toEqual(itemsSugeridos('bici'))
  })
})
