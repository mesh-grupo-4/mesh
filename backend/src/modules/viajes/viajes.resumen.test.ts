import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const usuarioId = '22222222-2222-2222-2222-222222222222'
const creadorId = '33333333-3333-3333-3333-333333333333'
const otroId = '44444444-4444-4444-4444-444444444444'

vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: vi.fn() }) }),
}))

const computeMetricasMock = vi.fn()
vi.mock('../../lib/postgis', () => ({
  computeLineStringLengthMeters: vi.fn(),
  computeMetricasGpsPorUsuario: (...args: unknown[]) => computeMetricasMock(...args),
}))

type Opciones = {
  estado?: string
  tipoActividad?: string
  resumen?: unknown
  cantidadMetricas?: number
  miMetrica?: unknown
  miIntegrante?: unknown
  /** Si el viaje tiene registros GPS como para poder calcular métricas. */
  hayGps?: boolean
}

function armarPrisma(o: Opciones = {}) {
  const {
    estado = 'finalizado',
    tipoActividad = 'bici',
    resumen = {
      duracion_segundos: 5400,
      distancia_planeada_m: 42000,
      distancia_real_m: 40850,
      cantidad_paradas: 0,
      generado_en: new Date('2026-08-13T18:22:10.000Z'),
    },
    cantidadMetricas = 2,
    miMetrica = {
      distancia_m: 40120.5,
      tiempo_movimiento_seg: 5100,
      velocidad_promedio_kmh: 28.3,
    },
    miIntegrante = { estado: 'confirmado', fecha_salida: null },
    hayGps = true,
  } = o

  const viaje = {
    id: viajeId,
    nombre: 'Salida del domingo',
    es_grupal: true,
    tipo_actividad: tipoActividad,
    estado,
    fecha_inicio_real: new Date('2026-08-13T15:00:00.000Z'),
    fecha_fin_real: new Date('2026-08-13T16:30:00.000Z'),
    creador_id: creadorId,
  }

  const metricaCount = vi.fn().mockResolvedValue(cantidadMetricas)
  const resumenFindUnique = vi.fn().mockResolvedValue(resumen)

  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje) },
    viajeIntegrante: {
      findUnique: vi.fn().mockResolvedValue(miIntegrante),
      count: vi.fn().mockResolvedValue(3),
    },
    resumenViaje: { findUnique: resumenFindUnique, upsert: vi.fn() },
    registroGPS: {
      findFirst: vi.fn().mockResolvedValue(hayGps ? { id: 'gps-1' } : null),
    },
    metricaViaje: {
      count: metricaCount,
      findUnique: vi.fn().mockResolvedValue(miMetrica),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        metricaViaje: { deleteMany: vi.fn(), createMany: vi.fn() },
        resumenViaje: { upsert: vi.fn() },
        // US3: el resumen cuenta las paradas voluntarias registradas.
        parada: { count: vi.fn().mockResolvedValue(0) },
      })
    ),
  } as unknown as PrismaClient

  return { prisma, metricaCount, resumenFindUnique }
}

describe('ViajesService.obtenerResumen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    computeMetricasMock.mockResolvedValue([])
  })

  it('devuelve totales y las métricas propias', async () => {
    const { prisma } = armarPrisma()
    const service = new ViajesService(prisma)

    const r = await service.obtenerResumen(creadorId, viajeId)

    expect(r.totales.duracion_segundos).toBe(5400)
    expect(r.totales.distancia_real_m).toBe(40850)
    // 3 integrantes + el creador, que no tiene fila en viaje_integrante.
    expect(r.totales.cantidad_integrantes).toBe(4)
    expect(r.mis_metricas.distancia_m).toBe(40120.5)
    expect(r.mis_metricas.sali_antes).toBe(false)
  })

  it('409 si el viaje todavía no finalizó', async () => {
    const { prisma } = armarPrisma({ estado: 'en_curso' })
    const service = new ViajesService(prisma)

    await expect(service.obtenerResumen(creadorId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'TRIP_NOT_FINISHED',
    })
  })

  it('hace backfill cuando no hay métricas persistidas', async () => {
    const { prisma } = armarPrisma({ cantidadMetricas: 0 })
    const service = new ViajesService(prisma)

    await service.obtenerResumen(creadorId, viajeId)

    expect(computeMetricasMock).toHaveBeenCalledWith(prisma, viajeId)
  })

  it('no reintenta el cálculo en un viaje sin registros GPS', async () => {
    const { prisma } = armarPrisma({ cantidadMetricas: 0, hayGps: false })
    const service = new ViajesService(prisma)

    const r = await service.obtenerResumen(creadorId, viajeId)

    expect(computeMetricasMock).not.toHaveBeenCalled()
    expect(r.mis_metricas.distancia_m).toBe(40120.5)
  })

  it('no hace backfill si ya hay resumen y métricas', async () => {
    const { prisma } = armarPrisma()
    const service = new ViajesService(prisma)

    await service.obtenerResumen(creadorId, viajeId)

    expect(computeMetricasMock).not.toHaveBeenCalled()
  })

  it('RN-070: ranking deshabilitado en moto', async () => {
    const { prisma } = armarPrisma({ tipoActividad: 'moto' })
    const service = new ViajesService(prisma)

    const r = await service.obtenerResumen(creadorId, viajeId)

    expect(r.ranking_habilitado).toBe(false)
  })

  it('habilita ranking fuera de moto', async () => {
    const { prisma } = armarPrisma({ tipoActividad: 'running' })
    const service = new ViajesService(prisma)

    expect((await service.obtenerResumen(creadorId, viajeId)).ranking_habilitado).toBe(true)
  })

  it('RN-070: la respuesta nunca contiene datos de terceros', async () => {
    const { prisma } = armarPrisma()
    const service = new ViajesService(prisma)

    const r = await service.obtenerResumen(usuarioId, viajeId)

    const serializado = JSON.stringify(r)
    expect(serializado).not.toContain(otroId)
    expect(serializado).not.toContain(creadorId)
    expect(Object.keys(r)).not.toContain('por_integrante')
  })

  it('marca sali_antes cuando el usuario abandonó el viaje', async () => {
    const fechaSalida = new Date('2026-08-13T15:45:00.000Z')
    const { prisma } = armarPrisma({
      miIntegrante: { estado: 'salido', fecha_salida: fechaSalida },
    })
    const service = new ViajesService(prisma)

    const r = await service.obtenerResumen(usuarioId, viajeId)

    expect(r.mis_metricas.sali_antes).toBe(true)
    expect(r.mis_metricas.fecha_salida).toEqual(fechaSalida)
  })

  it('devuelve null (no cero) cuando el usuario no tiene traza GPS', async () => {
    const { prisma } = armarPrisma({ miMetrica: null })
    const service = new ViajesService(prisma)

    const r = await service.obtenerResumen(usuarioId, viajeId)

    expect(r.mis_metricas.distancia_m).toBeNull()
    expect(r.mis_metricas.velocidad_promedio_kmh).toBeNull()
  })
})
