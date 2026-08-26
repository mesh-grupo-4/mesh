import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'
import type { CreateViajeInput } from './viajes.schemas'

const creadorId = '11111111-1111-1111-1111-111111111111'
const grupoAId = '55555555-5555-5555-5555-555555555555'
const grupoBId = '66666666-6666-6666-6666-666666666666'
const usuarioCompartido = '22222222-2222-2222-2222-222222222222'
const viajeId = '44444444-4444-4444-4444-444444444444'

function baseInput(overrides: Partial<CreateViajeInput> = {}): CreateViajeInput {
  return {
    nombre: 'Salida de prueba',
    esGrupal: true,
    tipoActividad: 'bici',
    fechaProgramada: new Date(Date.now() + 24 * 60 * 60 * 1000),
    grupoIds: [grupoAId, grupoBId],
    amigoIds: [],
    ...overrides,
  } as CreateViajeInput
}

function createMockPrisma() {
  const usuarioFindUnique = vi.fn()
  const grupoMiembroFindMany = vi.fn()
  const viajeCreate = vi.fn()
  const viajeIntegranteCreate = vi.fn()
  const viajeIntegranteCreateMany = vi.fn()
  const viajeGrupoCreateMany = vi.fn()

  const tx = {
    viaje: { create: viajeCreate },
    viajeIntegrante: { create: viajeIntegranteCreate, createMany: viajeIntegranteCreateMany },
    viajeGrupo: { createMany: viajeGrupoCreateMany },
  }

  const prisma = {
    usuario: { findUnique: usuarioFindUnique },
    grupoMiembro: { findMany: grupoMiembroFindMany },
    amistad: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  }

  viajeCreate.mockResolvedValue({ id: viajeId })
  viajeIntegranteCreate.mockResolvedValue({})
  viajeIntegranteCreateMany.mockResolvedValue({})
  viajeGrupoCreateMany.mockResolvedValue({})

  return {
    prisma: prisma as unknown as PrismaClient,
    usuarioFindUnique,
    grupoMiembroFindMany,
    viajeIntegranteCreateMany,
  }
}

describe('ViajesService.crearViaje — grupo_origen_id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cuando una persona es miembro de varios grupos invitados, guarda el primero de grupoIds como grupo_origen_id', async () => {
    const { prisma, usuarioFindUnique, grupoMiembroFindMany, viajeIntegranteCreateMany } =
      createMockPrisma()

    usuarioFindUnique.mockResolvedValue({ id: creadorId })
    // El creador es miembro de ambos grupos (chequeo de autorización para invitarlos).
    grupoMiembroFindMany.mockImplementation(({ where }: { where: { usuario_id?: string } }) => {
      if (where.usuario_id === creadorId) {
        return Promise.resolve([{ grupo_id: grupoAId }, { grupo_id: grupoBId }])
      }
      // usuarioCompartido pertenece a los dos grupos invitados.
      return Promise.resolve([
        { usuario_id: usuarioCompartido, grupo_id: grupoAId },
        { usuario_id: usuarioCompartido, grupo_id: grupoBId },
      ])
    })

    const service = new ViajesService(prisma)
    await service.crearViaje(creadorId, baseInput({ grupoIds: [grupoAId, grupoBId] }))

    expect(viajeIntegranteCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          usuario_id: usuarioCompartido,
          origen: 'grupo',
          grupo_origen_id: grupoAId,
        }),
      ],
      skipDuplicates: true,
    })
  })
})
