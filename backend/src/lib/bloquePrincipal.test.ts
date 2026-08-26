import { describe, expect, it } from 'vitest'
import {
  atrasoMetros,
  identificarBloquePrincipal,
  toleranciaAtrasoMetros,
  type MiembroEnRuta,
} from './bloquePrincipal'

function m(
  usuarioId: string,
  progresoM: number,
  lat: number,
  lng: number
): MiembroEnRuta {
  return { usuarioId, progresoM, lat, lng }
}

describe('identificarBloquePrincipal', () => {
  it('devuelve null con un solo integrante', () => {
    expect(identificarBloquePrincipal([m('a', 100, -31.42, -64.18)], 50)).toBeNull()
  })

  it('elige el cluster mayoritario y la mediana de progreso', () => {
    const bloque = identificarBloquePrincipal(
      [
        m('lider', 500, -31.41, -64.18),
        m('ana', 480, -31.4101, -64.1801),
        m('atrasado', 200, -31.45, -64.19),
      ],
      80
    )

    expect(bloque?.miembros.map((x) => x.usuarioId).sort()).toEqual(['ana', 'lider'])
    expect(bloque?.progresoReferenciaM).toBe(490)
  })
})

describe('atrasoMetros', () => {
  it('no reporta atraso si el integrante va adelante', () => {
    expect(atrasoMetros(400, 450)).toBe(0)
  })

  it('mide metros detrás del bloque', () => {
    expect(atrasoMetros(500, 220)).toBe(280)
  })
})

describe('toleranciaAtrasoMetros', () => {
  it('convierte velocidad y minutos a metros (trekking 5 km/h, 3 min → 250 m)', () => {
    expect(toleranciaAtrasoMetros(5, 3)).toBeCloseTo(250, 0)
  })
})
