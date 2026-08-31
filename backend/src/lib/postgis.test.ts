import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { computeTrazaRecorrido } from './postgis'

const viajeId = '22222222-2222-2222-2222-222222222222'
const usuarioId = '11111111-1111-1111-1111-111111111111'

/**
 * `computeTrazaRecorrido` arma la traza con una sola consulta SQL que hace todo el
 * trabajo de "gaps and islands" en la base (LAG + SUM(es_corte) OVER + GROUP BY
 * grupo_id). Sin una instancia real de Postgres/PostGIS en este entorno no podemos
 * ejercitar ese SQL, así que estos tests fijan lo que la fila cruda de PostGIS
 * devolvería (`grupo_id`, `lat`, `lng`, `orden`) para dos escenarios — sin cortes y
 * con un corte por hueco temporal/salto de distancia — y verifican que el paso de
 * plegado en JS arma los tramos (`[number, number][][]`) correctamente.
 */
function armarPrisma(filas: { grupo_id: number; lat: number; lng: number; orden: number }[]) {
  const queryRaw = vi.fn().mockResolvedValue(filas)
  const prisma = {
    $queryRaw: queryRaw,
    viaje: { findUnique: vi.fn().mockResolvedValue({ tipo_actividad: 'bici' }) },
  } as unknown as PrismaClient
  return { prisma, queryRaw }
}

describe('computeTrazaRecorrido', () => {
  it('sin cortes devuelve un único tramo con todos los puntos en orden', async () => {
    const { prisma } = armarPrisma([
      { grupo_id: 1, lat: -31.42, lng: -64.18, orden: 1 },
      { grupo_id: 1, lat: -31.421, lng: -64.181, orden: 2 },
      { grupo_id: 1, lat: -31.422, lng: -64.182, orden: 3 },
    ])

    const segmentos = await computeTrazaRecorrido(prisma, viajeId, usuarioId)

    expect(segmentos).toEqual([
      [
        [-31.42, -64.18],
        [-31.421, -64.181],
        [-31.422, -64.182],
      ],
    ])
  })

  it('un hueco temporal largo o un salto de distancia imposible corta en dos tramos', async () => {
    // grupo_id salta de 1 a 2: así es como el SQL marca un corte (LAG NULL, o
    // distancia > f.segmentoMaxM, o EXTRACT(EPOCH ...) > SEGMENTO_MAX_SEG).
    const { prisma } = armarPrisma([
      { grupo_id: 1, lat: -31.42, lng: -64.18, orden: 1 },
      { grupo_id: 1, lat: -31.421, lng: -64.181, orden: 2 },
      { grupo_id: 2, lat: -31.5, lng: -64.3, orden: 1 },
      { grupo_id: 2, lat: -31.501, lng: -64.301, orden: 2 },
    ])

    const segmentos = await computeTrazaRecorrido(prisma, viajeId, usuarioId)

    expect(segmentos).toHaveLength(2)
    expect(segmentos[0]).toEqual([
      [-31.42, -64.18],
      [-31.421, -64.181],
    ])
    expect(segmentos[1]).toEqual([
      [-31.5, -64.3],
      [-31.501, -64.301],
    ])
  })

  it('sin filas devuelve traza vacía en vez de fallar', async () => {
    const { prisma } = armarPrisma([])

    const segmentos = await computeTrazaRecorrido(prisma, viajeId, usuarioId)

    expect(segmentos).toEqual([])
  })
})
