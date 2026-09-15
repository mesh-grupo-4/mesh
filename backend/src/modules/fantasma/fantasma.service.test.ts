import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { FantasmaService, interpolarRitmoConstante } from './fantasma.service'

const yo = '11111111-1111-1111-1111-111111111111'
const otro = '22222222-2222-2222-2222-222222222222'
const viajeId = '33333333-3333-3333-3333-333333333333'
const refId = '44444444-4444-4444-4444-444444444444'
const plantillaId = '55555555-5555-5555-5555-555555555555'

const computeTrazaFantasma = vi.fn()
vi.mock('../../lib/postgis', () => ({
  computeTrazaFantasma: (...a: unknown[]) => computeTrazaFantasma(...a),
}))

function armar(opts: { tipo?: string; modo?: string; refEstado?: string; refCreador?: string } = {}) {
  const viajeActual = {
    creador_id: yo,
    tipo_actividad: opts.tipo ?? 'running',
    modo: opts.modo ?? 'entrenamiento',
    integrantes: [],
  }
  const viajeRef = {
    nombre: 'Vuelta al lago',
    estado: opts.refEstado ?? 'finalizado',
    tipo_actividad: 'running',
    creador_id: opts.refCreador ?? yo,
    integrantes: [],
  }
  const viajeFindUnique = vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === viajeId ? viajeActual : where.id === refId ? viajeRef : null
  )
  const prisma = {
    viaje: { findUnique: viajeFindUnique },
    metricaViaje: {
      findMany: vi.fn().mockResolvedValue([
        {
          viaje_id: refId,
          usuario_id: otro,
          distancia_m: 9000,
          tiempo_movimiento_seg: 3000,
          usuario: { nombre: 'Ana', apellido: 'Pérez' },
          viaje: { nombre: 'Vuelta al lago', tipo_actividad: 'running', fecha_fin_real: new Date('2026-09-01T12:00:00Z') },
        },
        {
          viaje_id: refId,
          usuario_id: yo,
          distancia_m: 9100,
          tiempo_movimiento_seg: 2900,
          usuario: { nombre: 'Yo', apellido: null },
          viaje: { nombre: 'Vuelta al lago', tipo_actividad: 'running', fecha_fin_real: new Date('2026-09-01T12:00:00Z') },
        },
      ]),
    },
    rutaPlantilla: {
      findMany: vi.fn().mockResolvedValue([
        { id: plantillaId, nombre: 'Circuito', tipo_actividad: 'bici', distancia_planeada_m: 20000, tiempo_estimado_seg: 3600, created_at: new Date('2026-08-01T00:00:00Z') },
      ]),
      findUnique: vi.fn().mockResolvedValue({
        usuario_id: yo,
        nombre: 'Circuito',
        tipo_actividad: 'bici',
        linestring_geojson: { type: 'LineString', coordinates: [[-64.19, -31.42], [-64.18, -31.42], [-64.17, -31.42]] },
        tiempo_estimado_seg: 600,
      }),
    },
    usuario: { findUnique: vi.fn().mockResolvedValue({ nombre: 'Ana', apellido: 'Pérez' }) },
  } as unknown as PrismaClient
  return { prisma }
}

beforeEach(() => {
  vi.clearAllMocks()
  computeTrazaFantasma.mockResolvedValue([
    { t_seg: 0, lat: -31.42, lng: -64.19, d_m: 0 },
    { t_seg: 60, lat: -31.42, lng: -64.18, d_m: 950 },
  ])
})

describe('RN-073 — fantasma', () => {
  it('lista candidatos: mi traza, la de otros integrantes y plantillas; propios y misma actividad primero', async () => {
    const m = armar()
    const out = await new FantasmaService(m.prisma).listarCandidatos(yo, viajeId)

    expect(out.map((c) => c.ref)).toEqual([
      `viaje:${refId}:${yo}`,
      `viaje:${refId}:${otro}`,
      `plantilla:${plantillaId}`,
    ])
    expect(out[0]!.autor).toBe('Vos')
    expect(out[1]!.autor).toBe('Ana Pérez')
  })

  it('RN-072: en modo recreativo no hay fantasma', async () => {
    const m = armar({ modo: 'recreativo' })
    await expect(new FantasmaService(m.prisma).listarCandidatos(yo, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'FANTASMA_NO_DISPONIBLE',
    })
  })

  it('RN-070: en moto no hay fantasma', async () => {
    const m = armar({ tipo: 'moto' })
    await expect(new FantasmaService(m.prisma).listarCandidatos(yo, viajeId)).rejects.toMatchObject({
      code: 'FANTASMA_NO_DISPONIBLE',
    })
  })

  it('devuelve la traza real de un viaje en el que participé (de otro integrante)', async () => {
    const m = armar()
    const out = await new FantasmaService(m.prisma).obtener(yo, viajeId, { viajeRef: refId, usuarioRef: otro })

    expect(computeTrazaFantasma).toHaveBeenCalledWith(m.prisma, refId, otro, 1500)
    expect(out).toMatchObject({ tipo: 'viaje', autor: 'Ana Pérez', distancia_m: 950, duracion_seg: 60, interpolado: false })
  })

  it('RN-030: no se puede usar la traza de un viaje ajeno', async () => {
    const m = armar({ refCreador: otro })
    await expect(
      new FantasmaService(m.prisma).obtener(yo, viajeId, { viajeRef: refId })
    ).rejects.toMatchObject({ status: 403 })
  })

  it('una plantilla se recorre a ritmo constante según su tiempo estimado', async () => {
    const m = armar()
    const out = await new FantasmaService(m.prisma).obtener(yo, viajeId, { plantillaId })

    expect(out.interpolado).toBe(true)
    expect(out.puntos[0]).toMatchObject({ t_seg: 0, d_m: 0 })
    expect(out.puntos.at(-1)!.t_seg).toBe(600)
    // El vértice del medio está a mitad de camino → mitad del tiempo.
    expect(out.puntos[1]!.t_seg).toBeCloseTo(300, 0)
  })

  it('interpolarRitmoConstante conserva primer y último punto al submuestrear', () => {
    const coords: [number, number][] = Array.from({ length: 10 }, (_, i) => [-64.19 + i * 0.001, -31.42])
    const puntos = interpolarRitmoConstante(coords, 100, 4)
    expect(puntos[0]!.d_m).toBe(0)
    expect(puntos.at(-1)!.t_seg).toBe(100)
    expect(puntos.length).toBeLessThanOrEqual(5)
  })
})
