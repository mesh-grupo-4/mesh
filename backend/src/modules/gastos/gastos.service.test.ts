import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { GastosService } from './gastos.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const liderId = '22222222-2222-2222-2222-222222222222'
const integranteId = '33333333-3333-3333-3333-333333333333'
const otroId = '44444444-4444-4444-4444-444444444444'
const ajenoId = '55555555-5555-5555-5555-555555555555'
const gastoId = '66666666-6666-6666-6666-666666666666'

const lider = { id: liderId, nombre: 'Lucía', apellido: 'Gómez' }
const integrante = { id: integranteId, nombre: 'Ana', apellido: 'Pérez' }
const otro = { id: otroId, nombre: 'Beto', apellido: 'Ruiz' }

function armarPrisma(overrides: Record<string, unknown> = {}) {
  const viajeFindUnique = vi
    .fn()
    .mockResolvedValue({ id: viajeId, creador_id: liderId, estado: 'en_curso' })

  // Integrantes confirmados/salidos del viaje: usados para validar participantesIds.
  const integranteFindMany = vi
    .fn()
    .mockResolvedValue([{ usuario_id: integranteId }, { usuario_id: otroId }])

  const integranteFindUnique = vi.fn(
    async ({ where }: { where: { viaje_id_usuario_id: { usuario_id: string } } }) => {
      const id = where.viaje_id_usuario_id.usuario_id
      if (id === integranteId || id === otroId) return { estado: 'confirmado' }
      return null
    }
  )

  const gastoCreate = vi.fn().mockResolvedValue({
    id: gastoId,
    viaje_id: viajeId,
    usuario_id: liderId,
    monto: 100,
    descripcion: 'Nafta',
    created_at: new Date('2026-08-21T14:00:00.000Z'),
    usuario: lider,
    participantes: [
      { usuario_id: liderId, usuario: lider },
      { usuario_id: integranteId, usuario: integrante },
    ],
  })
  const gastoFindMany = vi.fn().mockResolvedValue([])
  const gastoFindUnique = vi
    .fn()
    .mockResolvedValue({ id: gastoId, viaje_id: viajeId, usuario_id: integranteId })
  const gastoUpdate = vi.fn()
  const gastoDelete = vi.fn()

  const gastoParticipanteDeleteMany = vi.fn()
  const gastoParticipanteCreateMany = vi.fn()

  const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      gastoParticipante: {
        deleteMany: gastoParticipanteDeleteMany,
        createMany: gastoParticipanteCreateMany,
      },
      gasto: { update: gastoUpdate },
    })
  )

  const prisma = {
    viaje: { findUnique: viajeFindUnique },
    viajeIntegrante: { findMany: integranteFindMany, findUnique: integranteFindUnique },
    gasto: {
      create: gastoCreate,
      findMany: gastoFindMany,
      findUnique: gastoFindUnique,
      update: gastoUpdate,
      delete: gastoDelete,
    },
    $transaction: transaction,
    ...overrides,
  } as unknown as PrismaClient

  return {
    prisma,
    viajeFindUnique,
    integranteFindMany,
    integranteFindUnique,
    gastoCreate,
    gastoFindMany,
    gastoFindUnique,
    gastoUpdate,
    gastoDelete,
    gastoParticipanteDeleteMany,
    gastoParticipanteCreateMany,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registrarGasto', () => {
  it('registra el gasto y calcula el monto por persona', async () => {
    const m = armarPrisma()
    const service = new GastosService(m.prisma)

    const gasto = await service.registrarGasto(liderId, viajeId, {
      monto: 100,
      descripcion: 'Nafta',
      participantesIds: [liderId, integranteId],
    })

    expect(m.gastoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          viaje_id: viajeId,
          usuario_id: liderId,
          monto: 100,
          descripcion: 'Nafta',
          participantes: {
            createMany: { data: [{ usuario_id: liderId }, { usuario_id: integranteId }] },
          },
        }),
      })
    )
    expect(gasto.monto_por_persona).toBe(50)
    expect(gasto.puede_editar).toBe(true)
  })

  it('rechaza un participante que no forma parte del viaje', async () => {
    const m = armarPrisma()
    const service = new GastosService(m.prisma)

    await expect(
      service.registrarGasto(liderId, viajeId, {
        monto: 10,
        descripcion: 'x',
        participantesIds: [ajenoId],
      })
    ).rejects.toMatchObject({ status: 400, code: 'PARTICIPANTE_INVALIDO' })
    expect(m.gastoCreate).not.toHaveBeenCalled()
  })

  it('rechaza registrar sobre un viaje ya finalizado', async () => {
    const m = armarPrisma({
      viaje: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: viajeId, creador_id: liderId, estado: 'finalizado' }),
      },
    })
    const service = new GastosService(m.prisma)

    await expect(
      service.registrarGasto(liderId, viajeId, {
        monto: 10,
        descripcion: 'x',
        participantesIds: [liderId],
      })
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' })
  })
})

describe('actualizarGasto', () => {
  it('rechaza editar un gasto ajeno', async () => {
    const m = armarPrisma()
    const service = new GastosService(m.prisma)

    await expect(
      service.actualizarGasto(otroId, viajeId, gastoId, { monto: 20 })
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(m.gastoUpdate).not.toHaveBeenCalled()
  })
})

describe('obtenerBalance', () => {
  it('rechaza consultar el balance antes de finalizar el viaje', async () => {
    const m = armarPrisma()
    const service = new GastosService(m.prisma)

    await expect(service.obtenerBalance(liderId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE',
    })
  })

  it('calcula pagado/debe/saldo y minimiza las transferencias entre 3 personas', async () => {
    const m = armarPrisma({
      viaje: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: viajeId, creador_id: liderId, estado: 'finalizado' }),
      },
      gasto: {
        findMany: vi.fn().mockResolvedValue([
          {
            usuario_id: liderId,
            monto: 90,
            usuario: lider,
            participantes: [
              { usuario_id: liderId, usuario: lider },
              { usuario_id: integranteId, usuario: integrante },
              { usuario_id: otroId, usuario: otro },
            ],
          },
          {
            usuario_id: integranteId,
            monto: 30,
            usuario: integrante,
            participantes: [
              { usuario_id: liderId, usuario: lider },
              { usuario_id: integranteId, usuario: integrante },
              { usuario_id: otroId, usuario: otro },
            ],
          },
        ]),
      },
    })
    const service = new GastosService(m.prisma)

    const balance = await service.obtenerBalance(liderId, viajeId)

    const porId = new Map(balance.por_persona.map((p) => [p.usuario_id, p]))
    expect(porId.get(liderId)).toMatchObject({ pagado: 90, debe: 40, saldo: 50 })
    expect(porId.get(integranteId)).toMatchObject({ pagado: 30, debe: 40, saldo: -10 })
    expect(porId.get(otroId)).toMatchObject({ pagado: 0, debe: 40, saldo: -40 })

    expect(balance.transacciones).toEqual([
      { de_id: otroId, de_nombre: 'Beto Ruiz', para_id: liderId, para_nombre: 'Lucía Gómez', monto: 40 },
      { de_id: integranteId, de_nombre: 'Ana Pérez', para_id: liderId, para_nombre: 'Lucía Gómez', monto: 10 },
    ])
  })
})
