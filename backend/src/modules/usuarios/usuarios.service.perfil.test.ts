import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

vi.mock('../../config/firebase', () => ({
  firebaseAuth: { getUser: vi.fn(), verifyIdToken: vi.fn() },
}))
vi.mock('../../config/prisma', () => ({ prisma: {} }))

const { UsuariosService } = await import('./usuarios.service')

const yoId = '11111111-1111-1111-1111-111111111111'
const otroId = '22222222-2222-2222-2222-222222222222'

function armarPrisma(overrides: Record<string, unknown> = {}) {
  const usuarioFindUnique = vi.fn().mockResolvedValue({
    id: otroId,
    nombre: 'Ana',
    apellido: 'Pérez',
    actividad_preferida: 'bici',
  })
  const amistadFindFirst = vi.fn().mockResolvedValue(null)

  const prisma = {
    usuario: { findUnique: usuarioFindUnique },
    viaje: {
      count: vi.fn().mockResolvedValue(3),
      groupBy: vi.fn().mockResolvedValue([{ tipo_actividad: 'bici', _count: { tipo_actividad: 2 } }]),
    },
    metricaViaje: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { distancia_m: 42000, tiempo_movimiento_seg: 7200 } }),
    },
    insignia: { findMany: vi.fn().mockResolvedValue([]) },
    usuarioInsignia: { findMany: vi.fn().mockResolvedValue([]) },
    rachaActividad: { findUnique: vi.fn().mockResolvedValue(null) },
    amistad: { findFirst: amistadFindFirst },
    ...overrides,
  } as unknown as PrismaClient

  return { prisma, usuarioFindUnique, amistadFindFirst }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UsuariosService.perfilPublico', () => {
  it('404 si el usuario no existe', async () => {
    const m = armarPrisma({ usuario: { findUnique: vi.fn().mockResolvedValue(null) } })
    const service = new UsuariosService(m.prisma)

    await expect(service.perfilPublico(otroId, yoId)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    })
  })

  it('compone datos básicos, estadísticas agregadas, insignias y racha de otro usuario', async () => {
    const m = armarPrisma()
    const service = new UsuariosService(m.prisma)

    const perfil = await service.perfilPublico(otroId, yoId)

    expect(perfil).toMatchObject({
      id: otroId,
      nombre: 'Ana',
      apellido: 'Pérez',
      actividad_preferida: 'bici',
      es_yo: false,
      estadisticas: {
        viajes_finalizados: 3,
        distancia_total_m: 42000,
        tiempo_total_seg: 7200,
        actividad_favorita: 'bici',
      },
      insignias: [],
      racha: { semanas_consecutivas: 0, en_riesgo: false },
    })
  })

  it('marca es_yo cuando el solicitante consulta su propio perfil, sin calcular relación de amistad', async () => {
    const m = armarPrisma({
      usuario: {
        findUnique: vi.fn().mockResolvedValue({
          id: yoId,
          nombre: 'Yo',
          apellido: null,
          actividad_preferida: null,
        }),
      },
    })
    const service = new UsuariosService(m.prisma)

    const perfil = await service.perfilPublico(yoId, yoId)

    expect(perfil.es_yo).toBe(true)
    expect(perfil.relacion_amistad).toBeNull()
    expect(m.amistadFindFirst).not.toHaveBeenCalled()
  })

  it('informa la relación de amistad cuando no es uno mismo', async () => {
    const m = armarPrisma({
      amistad: {
        findFirst: vi.fn().mockResolvedValue({ solicitante_id: yoId, estado: 'pendiente' }),
      },
    })
    const service = new UsuariosService(m.prisma)

    const perfil = await service.perfilPublico(otroId, yoId)

    expect(perfil.relacion_amistad).toBe('solicitud_enviada')
  })
})
