import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'
import { invitarViajeSchema, type CreateViajeInput } from './viajes.schemas'

const creadorId = '11111111-1111-1111-1111-111111111111'
const amigoId = '22222222-2222-2222-2222-222222222222'
const miembroId = '33333333-3333-3333-3333-333333333333'
const viajeId = '44444444-4444-4444-4444-444444444444'
const grupoId = '55555555-5555-5555-5555-555555555555'

const sendExpoPush = vi.fn()
vi.mock('../../lib/expoPush', () => ({
  sendExpoPush: (...args: unknown[]) => sendExpoPush(...args),
}))

function createMockPrisma(
  viaje: Record<string, unknown> | null,
  /** Quiénes de los invitados ya figuraban en el viaje. */
  yaFiguran: string[] = []
) {
  const viajeIntegranteCreateMany = vi.fn().mockResolvedValue({ count: 2 })
  const viajeGrupoCreateMany = vi.fn().mockResolvedValue({ count: 1 })
  const viajeCreate = vi.fn().mockResolvedValue({ id: viajeId })
  const tx = {
    viaje: { create: viajeCreate },
    viajeIntegrante: { create: vi.fn().mockResolvedValue({}), createMany: viajeIntegranteCreateMany },
    viajeGrupo: { createMany: viajeGrupoCreateMany },
  }
  const usuarioFindMany = vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
    Promise.resolve(where.id.in.map((id) => ({ push_token: `ExponentPushToken[${id}]` })))
  )
  const prisma = {
    usuario: { findUnique: vi.fn().mockResolvedValue({ id: creadorId }), findMany: usuarioFindMany },
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje) },
    viajeIntegrante: {
      findMany: vi.fn().mockResolvedValue(yaFiguran.map((usuario_id) => ({ usuario_id }))),
    },
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

const planificado = {
  id: viajeId,
  creador_id: creadorId,
  estado: 'planificado',
  es_grupal: true,
  nombre: 'Vuelta al dique',
  modo: 'recreativo',
  creador: { nombre: 'Lucía' },
}

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
    // La push sale sin esperar: se deja terminar para que no caiga en el test siguiente.
    await vi.waitFor(() => expect(sendExpoPush).toHaveBeenCalledTimes(1))
  })

  it('avisa por push solo a quienes no figuraban en el viaje (RN-029f)', async () => {
    const { prisma } = createMockPrisma(planificado, [miembroId])

    await new ViajesService(prisma).invitar(creadorId, viajeId, {
      grupoIds: [grupoId],
      amigoIds: [amigoId],
    })

    await vi.waitFor(() => expect(sendExpoPush).toHaveBeenCalledTimes(1))
    expect(sendExpoPush).toHaveBeenCalledWith([
      {
        to: `ExponentPushToken[${amigoId}]`,
        title: 'Nueva invitación a un viaje',
        body: 'Lucía te invitó a "Vuelta al dique".',
        data: { tipo: 'invitacion_viaje' },
        sound: 'default',
      },
    ])
  })

  it('la push nombra el entrenamiento cuando el viaje es de ese modo', async () => {
    const { prisma } = createMockPrisma({ ...planificado, modo: 'entrenamiento' })

    await new ViajesService(prisma).invitar(creadorId, viajeId, { grupoIds: [], amigoIds: [amigoId] })

    await vi.waitFor(() => expect(sendExpoPush).toHaveBeenCalledTimes(1))
    expect(sendExpoPush.mock.calls[0]![0][0]).toMatchObject({
      title: 'Nueva invitación a un entrenamiento',
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
  beforeEach(() => vi.clearAllMocks())

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

  it('avisa por push a los invitados al crear (RN-029f)', async () => {
    const { prisma } = createMockPrisma(planificado)
    await new ViajesService(prisma).crearViaje(creadorId, {
      nombre: 'Vuelta al dique',
      esGrupal: true,
      tipoActividad: 'bici',
      modo: 'recreativo',
      inmediato: true,
      grupoIds: [],
      amigoIds: [amigoId],
    } as CreateViajeInput)

    await vi.waitFor(() => expect(sendExpoPush).toHaveBeenCalledTimes(1))
    expect(sendExpoPush.mock.calls[0]![0]).toEqual([
      expect.objectContaining({
        to: `ExponentPushToken[${amigoId}]`,
        data: { tipo: 'invitacion_viaje' },
      }),
    ])
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
