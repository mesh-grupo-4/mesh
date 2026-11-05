import { describe, expect, it } from 'vitest'
import { obtenerTablaPosicionesQuery } from './tabla-posiciones.schemas'

describe('obtenerTablaPosicionesQuery', () => {
  it.each(['bici', 'running', 'trekking', 'otro'])(
    'acepta tipoActividad=%s',
    (tipoActividad) => {
      expect(() => obtenerTablaPosicionesQuery.parse({ tipoActividad })).not.toThrow()
    }
  )

  it('rechaza moto (RN-070: nunca tabla de posiciones para moto)', () => {
    expect(() => obtenerTablaPosicionesQuery.parse({ tipoActividad: 'moto' })).toThrow()
  })

  it('aplica los valores por defecto periodo=semanal y orden=distancia', () => {
    const q = obtenerTablaPosicionesQuery.parse({ tipoActividad: 'bici' })
    expect(q).toEqual({ tipoActividad: 'bici', periodo: 'semanal', orden: 'distancia' })
  })
})
