import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { RoutingService } from '../routing/routing.service'
import { recalcularRutaDesde } from './recalculoRuta'

const viajeId = '11111111-1111-1111-1111-111111111111'

const computeFraccionesEnRuta = vi.fn()
const unirTramoRecorridoConNuevo = vi.fn()
vi.mock('../../lib/postgis', () => ({
  computeFraccionesEnRuta: (...a: unknown[]) => computeFraccionesEnRuta(...a),
  unirTramoRecorridoConNuevo: (...a: unknown[]) => unirTramoRecorridoConNuevo(...a),
}))

const vieja = {
  type: 'LineString' as const,
  coordinates: [
    [-64.19, -31.42],
    [-64.1, -31.3],
  ],
}
const tramoNuevo = {
  type: 'LineString' as const,
  coordinates: [
    [-64.2, -31.43],
    [-64.1, -31.3],
  ],
}
const unida = {
  type: 'LineString' as const,
  coordinates: [
    [-64.19, -31.42],
    [-64.2, -31.43],
    [-64.1, -31.3],
  ],
}

function armar(rutaOverrides: Record<string, unknown> = {}) {
  const rutaUpdate = vi.fn().mockResolvedValue({})
  const prisma = {
    ruta: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ruta-1',
        destino_lat: -31.3,
        destino_lng: -64.1,
        linestring_geojson: vieja,
        tiempo_estimado_seg: 1000,
        viaje: { tipo_actividad: 'bici' },
        paradas_intermedias: [
          { lat: -31.4, lng: -64.17 },
          { lat: -31.35, lng: -64.13 },
        ],
        ...rutaOverrides,
      }),
      update: rutaUpdate,
    },
  } as unknown as PrismaClient
  const calcularRuta = vi.fn().mockResolvedValue({
    linestring: tramoNuevo,
    distancia_m: 9000,
    duracion_seg: 700,
    proveedor: 'google',
  })
  const routing = { calcularRuta } as unknown as RoutingService
  return { prisma, routing, calcularRuta, rutaUpdate }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Líder al 40 % de la ruta; la primera parada quedó atrás (20 %), la segunda adelante (70 %).
  computeFraccionesEnRuta.mockResolvedValue([0.4, 0.2, 0.7])
  unirTramoRecorridoConNuevo.mockResolvedValue({ linestring: unida, longitudM: 12000 })
})

describe('recalcularRutaDesde (RN-034b)', () => {
  it('rutea desde el líder por las paradas que quedaban adelante, con el perfil de la actividad', async () => {
    const { prisma, routing, calcularRuta } = armar()

    await recalcularRutaDesde(prisma, routing, viajeId, { lat: -31.43, lng: -64.2 })

    expect(calcularRuta).toHaveBeenCalledWith({
      perfil: 'cycling',
      puntos: [
        { lat: -31.43, lng: -64.2 },
        { lat: -31.35, lng: -64.13 },
        { lat: -31.3, lng: -64.1 },
      ],
    })
  })

  it('conserva el tramo recorrido y guarda trazado, distancia y tiempo proporcional', async () => {
    const { prisma, routing, rutaUpdate } = armar()

    const r = await recalcularRutaDesde(prisma, routing, viajeId, { lat: -31.43, lng: -64.2 })

    expect(unirTramoRecorridoConNuevo).toHaveBeenCalledWith(prisma, vieja, 0.4, tramoNuevo)
    // 40 % de los 1000 s originales + 700 s del tramo nuevo.
    expect(rutaUpdate).toHaveBeenCalledWith({
      where: { id: 'ruta-1' },
      data: { linestring_geojson: unida, distancia_planeada_m: 12000, tiempo_estimado_seg: 1100 },
    })
    expect(r).toEqual({
      linestring: unida,
      distancia_planeada_m: 12000,
      tiempo_estimado_seg: 1100,
      paradas_pendientes: 1,
    })
  })

  it('sin tiempo estimado original usa solo el del tramo nuevo', async () => {
    const { prisma, routing } = armar({ tiempo_estimado_seg: null })

    const r = await recalcularRutaDesde(prisma, routing, viajeId, { lat: -31.43, lng: -64.2 })

    expect(r.tiempo_estimado_seg).toBe(700)
  })

  it('sin ruta planificada responde 409 SIN_RUTA', async () => {
    const { prisma, routing } = armar()
    ;(prisma.ruta.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(
      recalcularRutaDesde(prisma, routing, viajeId, { lat: -31.43, lng: -64.2 })
    ).rejects.toMatchObject({ status: 409, code: 'SIN_RUTA' })
  })

  it('si el ruteo falla no toca la ruta guardada', async () => {
    const { prisma, routing, calcularRuta, rutaUpdate } = armar()
    calcularRuta.mockRejectedValue(new Error('upstream'))

    await expect(
      recalcularRutaDesde(prisma, routing, viajeId, { lat: -31.43, lng: -64.2 })
    ).rejects.toThrow('upstream')
    expect(rutaUpdate).not.toHaveBeenCalled()
  })
})
