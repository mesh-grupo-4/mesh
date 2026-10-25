import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { InsigniasService } from './insignias.service'

const usuarioId = '11111111-1111-1111-1111-111111111111'
const viajeId = '22222222-2222-2222-2222-222222222222'

const INSIGNIA_PRIMER_RECORRIDO = {
  id: 'i1',
  codigo: 'primer_recorrido',
  nombre: 'Primer recorrido',
  descripcion: null,
  icono: 'flag',
  criterio_distancia_m: null,
  criterio_duracion_seg: null,
  criterio_actividad: null,
}
const INSIGNIA_10K_RUNNING = {
  id: 'i2',
  codigo: 'diez_k_running',
  nombre: '10K',
  descripcion: null,
  icono: 'zap',
  criterio_distancia_m: 10000,
  criterio_duracion_seg: null,
  criterio_actividad: 'running',
}
const INSIGNIA_HORA_MARCHA = {
  id: 'i3',
  codigo: 'hora_en_marcha',
  nombre: 'Hora en marcha',
  descripcion: null,
  icono: 'clock',
  criterio_distancia_m: null,
  criterio_duracion_seg: 3600,
  criterio_actividad: null,
}
const CATALOGO = [INSIGNIA_PRIMER_RECORRIDO, INSIGNIA_10K_RUNNING, INSIGNIA_HORA_MARCHA]

function armarPrisma(overrides: Record<string, unknown> = {}) {
  const insigniaFindMany = vi.fn().mockResolvedValue(CATALOGO)
  const usuarioInsigniaCreateMany = vi.fn().mockResolvedValue({ count: 0 })
  const usuarioFindUnique = vi.fn().mockResolvedValue({ id: usuarioId })
  const usuarioInsigniaFindMany = vi.fn().mockResolvedValue([])

  const prisma = {
    insignia: { findMany: insigniaFindMany },
    usuario: { findUnique: usuarioFindUnique },
    usuarioInsignia: {
      createMany: usuarioInsigniaCreateMany,
      findMany: usuarioInsigniaFindMany,
    },
    ...overrides,
  } as unknown as PrismaClient

  return { prisma, insigniaFindMany, usuarioInsigniaCreateMany, usuarioFindUnique, usuarioInsigniaFindMany }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('InsigniasService.evaluarYOtorgar', () => {
  it('otorga la insignia sin criterio (primer recorrido) sin importar la actividad', async () => {
    const m = armarPrisma()
    const service = new InsigniasService(m.prisma)

    await service.evaluarYOtorgar(usuarioId, viajeId, 'trekking', 500, 60)

    expect(m.usuarioInsigniaCreateMany).toHaveBeenCalledWith({
      data: [{ usuario_id: usuarioId, insignia_id: INSIGNIA_PRIMER_RECORRIDO.id, viaje_id: viajeId }],
      skipDuplicates: true,
    })
  })

  it('otorga la de distancia+actividad solo si corre 10km o más', async () => {
    const m = armarPrisma()
    const service = new InsigniasService(m.prisma)

    await service.evaluarYOtorgar(usuarioId, viajeId, 'running', 10500, 3000)

    const data = m.usuarioInsigniaCreateMany.mock.calls[0]?.[0]?.data as { insignia_id: string }[]
    expect(data.map((d) => d.insignia_id)).toContain(INSIGNIA_10K_RUNNING.id)
  })

  it('no otorga la de actividad si corrió menos de 10km', async () => {
    const m = armarPrisma()
    const service = new InsigniasService(m.prisma)

    await service.evaluarYOtorgar(usuarioId, viajeId, 'running', 5000, 3000)

    const data = m.usuarioInsigniaCreateMany.mock.calls[0]?.[0]?.data as { insignia_id: string }[]
    expect(data.map((d) => d.insignia_id)).not.toContain(INSIGNIA_10K_RUNNING.id)
  })

  it('no otorga la de actividad distinta aunque cumpla la distancia', async () => {
    const m = armarPrisma()
    const service = new InsigniasService(m.prisma)

    // 15km en bici: no corresponde a la insignia de running aunque supere el umbral.
    await service.evaluarYOtorgar(usuarioId, viajeId, 'bici', 15000, 3000)

    const data = m.usuarioInsigniaCreateMany.mock.calls[0]?.[0]?.data as { insignia_id: string }[]
    expect(data.map((d) => d.insignia_id)).not.toContain(INSIGNIA_10K_RUNNING.id)
  })

  it('evalúa duración sin criterio de actividad (nunca por velocidad, RN-070)', async () => {
    const m = armarPrisma()
    const service = new InsigniasService(m.prisma)

    // Moto, 1h de movimiento: debe poder ganar insignias de duración/distancia igual que cualquier actividad.
    await service.evaluarYOtorgar(usuarioId, viajeId, 'moto', 1000, 3601)

    const data = m.usuarioInsigniaCreateMany.mock.calls[0]?.[0]?.data as { insignia_id: string }[]
    expect(data.map((d) => d.insignia_id)).toContain(INSIGNIA_HORA_MARCHA.id)
  })

  it('no crea nada si ninguna insignia aplica', async () => {
    const m = armarPrisma({
      insignia: { findMany: vi.fn().mockResolvedValue([INSIGNIA_10K_RUNNING]) },
    })
    const service = new InsigniasService(m.prisma)

    await service.evaluarYOtorgar(usuarioId, viajeId, 'bici', 100, 60)

    expect(m.usuarioInsigniaCreateMany).not.toHaveBeenCalled()
  })
})

describe('InsigniasService.listarDeUsuario', () => {
  it('404 si el usuario no existe', async () => {
    const m = armarPrisma({ usuario: { findUnique: vi.fn().mockResolvedValue(null) } })
    const service = new InsigniasService(m.prisma)

    await expect(service.listarDeUsuario('inexistente')).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    })
  })

  it('mapea las insignias obtenidas, más reciente primero', async () => {
    const obtenida_at = new Date('2026-10-20T12:00:00.000Z')
    const m = armarPrisma({
      usuarioInsignia: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'ui1',
            insignia_id: INSIGNIA_PRIMER_RECORRIDO.id,
            viaje_id: viajeId,
            obtenida_at,
            insignia: INSIGNIA_PRIMER_RECORRIDO,
          },
        ]),
      },
    })
    const service = new InsigniasService(m.prisma)

    const out = await service.listarDeUsuario(usuarioId)

    expect(out).toEqual([
      {
        id: 'ui1',
        insignia_id: INSIGNIA_PRIMER_RECORRIDO.id,
        codigo: 'primer_recorrido',
        nombre: 'Primer recorrido',
        descripcion: null,
        icono: 'flag',
        viaje_id: viajeId,
        obtenida_at: obtenida_at.toISOString(),
      },
    ])
  })
})
