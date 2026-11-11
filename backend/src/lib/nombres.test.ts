import { describe, expect, it } from 'vitest'
import { nombreVisible } from './nombres'

describe('nombreVisible', () => {
  it('no repite el apellido cuando nombre ya es el nombre completo', () => {
    expect(nombreVisible('Franco Giorda', 'Giorda')).toBe('Franco Giorda')
    expect(nombreVisible('Joaquín Peñafort', 'peñafort')).toBe('Joaquín Peñafort')
  })

  it('deja una sola vez un apellido que quedó repetido', () => {
    expect(nombreVisible('Franco Giorda Giorda', 'Giorda')).toBe('Franco Giorda')
    expect(nombreVisible('Franco Giorda giorda Giorda', 'Giorda')).toBe('Franco Giorda')
    expect(nombreVisible('Giorda Giorda', 'Giorda')).toBe('Giorda')
  })

  it('agrega el apellido cuando nombre es solo el nombre de pila', () => {
    expect(nombreVisible('Franco', 'Giorda')).toBe('Franco Giorda')
  })

  it('no confunde un apellido que es sufijo de otra palabra', () => {
    expect(nombreVisible('Mariana', 'Ana')).toBe('Mariana Ana')
  })

  it('tolera valores vacíos', () => {
    expect(nombreVisible('Franco', null)).toBe('Franco')
    expect(nombreVisible('', 'Giorda')).toBe('Giorda')
    expect(nombreVisible(null, undefined)).toBe('')
  })
})
