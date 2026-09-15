import { describe, expect, it } from 'vitest'
import { armarLeaderboard } from './leaderboard'

const base = { lat: 0, lng: 0, actualizadoEn: '2026-09-01T13:00:00.000Z' }

describe('RN-071 — leaderboard', () => {
  it('ordena por progreso y expresa la diferencia con el líder en metros y segundos', () => {
    const filas = armarLeaderboard(
      [
        { usuarioId: 'b', nombre: 'B', progresoM: 4000, ...base },
        { usuarioId: 'a', nombre: 'A', progresoM: 5000, ...base },
        { usuarioId: 'c', nombre: 'C', progresoM: 4000, ...base },
      ],
      36 // km/h → 10 m/s
    )
    expect(filas.map((f) => [f.usuarioId, f.puesto, f.deltaM, f.gapSeg])).toEqual([
      ['a', 1, 0, 0],
      ['b', 2, 1000, 100],
      ['c', 2, 1000, 100],
    ])
  })

  it('sin integrantes devuelve vacío', () => {
    expect(armarLeaderboard([], 20)).toEqual([])
  })
})
