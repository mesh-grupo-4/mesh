import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'
import { invitarViajeSchema, type CreateViajeInput } from './viajes.schemas'

const creadorId = '11111111-1111-1111-1111-111111111111'
const amigoId = '22222222-2222-2222-2222-222222222222'
const miembroId = '33333333-3333-3333-3333-333333333333'
const viajeId = '44444444-4444-4444-4444-444444444444'
const grupoId = '55555555-5555-5555-5555-555555555555'

function createMockPrisma(viaje: Record<string, unknown> | null) {
  const viajeIntegranteCreateMany = vi.fn().mockResolvedValue({ count: 2 })
  const viajeGrupoCreateMany = vi.fn().mockResolvedValue({ count: 1 })
  const viajeCreate = vi.fn().mockResolvedValue({ id: viajeId })
  const tx = {
    viaje: { create: viajeCreate },
    viajeIntegrante: { create: vi.fn().mockResolvedValue({}), createMany: viajeIntegranteCreateMany },
    viajeGrupo: { createMany: viajeGrupoCreateMany },
  }
  const prisma = {
    usuario: { findUnique: vi.fn().mockResolvedValue({ id: creadorId }) },
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje) },
    grupoMiembro: {
      findMany: vi.fn(({ where }: { where: { usuario_id?: string } }) =>
        Promise.resolve(
          where.usuario_id === creadorId
            ? [{ grupo_id: grupoId }]
            : [
                { usuario_id: creadorId, grupo_id: grupoId },
                { usuario_id: miembroId, grupo_id: grupoId },
              ]
        )
      ),
    },
    amistad: {
      findMany: vi.fn().mockResolvedValue([{ solicitante_id: creadorId, destinatario_id: amigoId }]),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  }
  return {
    prisma: prisma as unknown as PrismaClient,
    viajeCreate,
    viajeIntegranteCreateMany,
    viajeGrupoCreateMany,
  }
}

const planificado = { id: viajeId, creador_id: creadorId, estado: 'planificado', es_grupal: true }

describe('invitarViajeSchema', () => {
  it('rechaza un body sin grupos ni amigos', () => {
    expect(invitarViajeSchema.safeParse({}).success).toBe(false)
  })

  it('acepta solo amigos', () => {
    expect(invitarViajeSchema.safeParse({ amigoIds: [amigoId] }).success).toBe(true)
  })
})

describe('ViajesService.invitar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invita a los miembros del grupo y a los amigos, sin duplicar al creador', async () => {
    const { prisma, viajeIntegranteCreateMany, viajeGrupoCreateMany } = createMockPrisma(planificado)
    const service = new ViajesService(prisma)

    const r = await service.invitar(creadorId, viajeId, { grupoIds: [grupoId], amigoIds: [amigoId] })

    expect(r).toEqual({ viaje_id: viajeId, invitaciones_enviadas: 2 })
    expect(viajeIntegranteCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ usuario_id: miembroId, origen: 'grupo', grupo_origen_id: grupoId }),
        expect.objectContaining({ usuario_id: amigoId, origen: 'amigo', estado: 'pendiente' }),
      ],
      skipDuplicates: true,
    })
    expect(viajeGrupoCreateMany).toHaveBeenCalledWith({
      data: [{ viaje_id: viajeId, grupo_id: grupoId }],
      skipDuplicates: true,
    })
  })

  it('404 si el viaje no existe', async () => {
    const { prisma } = createMockPrisma(null)
    await expect(
      new ViajesService(prisma).invitar(creadorId, viajeId, { grupoIds: [], amigoIds: [amigoId] })
    ).rejects.toMatchObject({ status: 404, code: 'VIAJE_NOT_FOUND' })
  })

  it('403 si quien invita no es el líder (RN-030)', async () => {
    const { prisma } = createMockPrisma({ ...planificado, creador_id: miembroId })
    await expect(
      new ViajesService(prisma).invitar(creadorId, viajeId, { grupoIds: [], amigoIds: [amigoId] })
    ).rejects.toMatchObject({ status: 403, code: 'NOT_CREATOR' })
  })

  it('409 si el viaje ya arrancó', async () => {
    const { prisma } = createMockPrisma({ ...planificado, estado: 'en_curso' })
    await expect(
      new ViajesService(prisma).invitar(creadorId, viajeId, { grupoIds: [], amigoIds: [amigoId] })
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' })
  })

  it('409 si el viaje es individual', async () => {
    const { prisma } = createMockPrisma({ ...planificado, es_grupal: false })
    await expect(
      new ViajesService(prisma).invitar(creadorId, viajeId, { grupoIds: [], amigoIds: [amigoId] })
    ).rejects.toMatchObject({ status: 409, code: 'INDIVIDUAL_TRIP' })
  })
})

describe('ViajesService.crearViaje — inmediato (Viaje YA)', () => {
  it('toma la hora actual como fecha_programada', async () => {
    const { prisma, viajeCreate } = createMockPrisma(null)
    const antes = Date.now()
    await new ViajesService(prisma).crearViaje(creadorId, {
      nombre: 'Viaje rápido',
      esGrupal: true,
      tipoActividad: 'bici',
      modo: 'recreativo',
      inmediato: true,
      grupoIds: [],
      amigoIds: [],
    } as CreateViajeInput)

    const fecha = viajeCreate.mock.calls[0]![0].data.fecha_programada as Date
    expect(fecha.getTime()).toBeGreaterThanOrEqual(antes)
    expect(fecha.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('sin inmediato y sin fecha devuelve FECHA_PASADA', async () => {
    const { prisma } = createMockPrisma(null)
    await expect(
      new ViajesService(prisma).crearViaje(creadorId, {
        nombre: 'x',
        esGrupal: false,
        tipoActividad: 'bici',
        modo: 'recreativo',
        inmediato: false,
        grupoIds: [],
        amigoIds: [],
      } as CreateViajeInput)
    ).rejects.toMatchObject({ status: 400, code: 'FECHA_PASADA' })
  })
})
