import { describe, expect, it } from 'vitest'
import { obtenerTablaPosicionesQuery } from './tabla-posiciones.schemas'

describe('obtenerTablaPosicionesQuery', () => {
  it.each(['bici', 'running', 'trekking', 'otro'])(
    'acepta tipoActividad=%s',
    (tipoActividad) => {
      expect(() => obtenerTablaPosicionesQuery.parse({ tipoActividad })).not.toThrow()
    }
  )

  it.each(['moto', 'auto'])('rechaza %s (RN-070: nunca tabla de posiciones para motorizados)', (tipoActividad) => {
    expect(() => obtenerTablaPosicionesQuery.parse({ tipoActividad })).toThrow()
  })

  it('aplica los valores por defecto periodo=semanal y orden=distancia', () => {
    const q = obtenerTablaPosicionesQuery.parse({ tipoActividad: 'bici' })
    expect(q).toEqual({ tipoActividad: 'bici', periodo: 'semanal', orden: 'distancia' })
  })
})
