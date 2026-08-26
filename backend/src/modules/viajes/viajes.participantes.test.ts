import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const viajeId = '44444444-4444-4444-4444-444444444444'
const creadorId = '11111111-1111-1111-1111-111111111111'
const grupoXId = '55555555-5555-5555-5555-555555555555'
const usuarioB = '22222222-2222-2222-2222-222222222222'
const usuarioC = '33333333-3333-3333-3333-333333333333'
const usuarioD = '66666666-6666-6666-6666-666666666666'

function usuario(id: string, nombre: string) {
  return { id, nombre, apellido: null, email: `${nombre.toLowerCase()}@example.com` }
}

function createMockPrisma() {
  const viajeFindUnique = vi.fn()
  const viajeFindUniqueOrThrow = vi.fn()
  const viajeIntegranteFindMany = vi.fn()
  const grupoFindMany = vi.fn()
  const grupoMiembroFindMany = vi.fn()
  const registroGPSGroupBy = vi.fn()

  const prisma = {
    viaje: { findUnique: viajeFindUnique, findUniqueOrThrow: viajeFindUniqueOrThrow },
    viajeIntegrante: { findMany: viajeIntegranteFindMany },
    grupo: { findMany: grupoFindMany },
    grupoMiembro: { findMany: grupoMiembroFindMany },
    registroGPS: { groupBy: registroGPSGroupBy },
  }

  return {
    prisma: prisma as unknown as PrismaClient,
    viajeFindUnique,
    viajeFindUniqueOrThrow,
    viajeIntegranteFindMany,
    grupoFindMany,
    grupoMiembroFindMany,
    registroGPSGroupBy,
  }
}

describe('ViajesService.listarParticipantes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deriva rol y grupo_origen; union_efectiva es false para todos si el viaje no arrancó', async () => {
    const mocks = createMockPrisma()

    // assertPuedeVerViaje: lo consulta el propio creador, short-circuit sin tocar viajeIntegrante.
    mocks.viajeFindUnique.mockResolvedValue({ creador_id: creadorId })
    mocks.viajeFindUniqueOrThrow.mockResolvedValue({ creador_id: creadorId, fecha_inicio_real: null })

    mocks.viajeIntegranteFindMany.mockResolvedValue([
      {
        usuario_id: creadorId,
        usuario: usuario(creadorId, 'Creador'),
        estado: 'confirmado',
        origen: 'creador',
        created_at: new Date('2026-08-20T14:00:00.000Z'),
        grupo_origen_id: null,
      },
      {
        usuario_id: usuarioB,
        usuario: usuario(usuarioB, 'Marcos'),
        estado: 'confirmado',
        origen: 'grupo',
        created_at: new Date('2026-08-20T14:05:00.000Z'),
        grupo_origen_id: grupoXId,
      },
      {
        // Se unió invitado desde el mismo grupo, pero ya no es miembro (salió del grupo).
        usuario_id: usuarioC,
        usuario: usuario(usuarioC, 'Rocío'),
        estado: 'confirmado',
        origen: 'grupo',
        created_at: new Date('2026-08-20T14:06:00.000Z'),
        grupo_origen_id: grupoXId,
      },
      {
        usuario_id: usuarioD,
        usuario: usuario(usuarioD, 'Nico'),
        estado: 'confirmado',
        origen: 'qr',
        created_at: new Date('2026-08-24T09:50:00.000Z'),
        grupo_origen_id: null,
      },
    ])
    mocks.grupoFindMany.mockResolvedValue([{ id: grupoXId, nombre: 'Club Bici Córdoba' }])
    mocks.grupoMiembroFindMany.mockResolvedValue([
      { grupo_id: grupoXId, usuario_id: usuarioB, rol: 'lider' },
    ])

    const service = new ViajesService(mocks.prisma)
    const result = await service.listarParticipantes(creadorId, viajeId)

    expect(mocks.registroGPSGroupBy).not.toHaveBeenCalled()

    expect(result).toEqual([
      expect.objectContaining({
        usuario: usuario(creadorId, 'Creador'),
        rol: 'lider',
        union_efectiva: false,
        grupo_origen: null,
      }),
      expect.objectContaining({
        usuario: usuario(usuarioB, 'Marcos'),
        rol: 'lider',
        union_efectiva: false,
        grupo_origen: { id: grupoXId, nombre: 'Club Bici Córdoba' },
      }),
      expect.objectContaining({
        usuario: usuario(usuarioC, 'Rocío'),
        rol: 'participante',
        union_efectiva: false,
        grupo_origen: { id: grupoXId, nombre: 'Club Bici Córdoba' },
      }),
      expect.objectContaining({
        usuario: usuario(usuarioD, 'Nico'),
        rol: 'participante',
        union_efectiva: false,
        grupo_origen: null,
      }),
    ])
  })

  it('calcula union_efectiva desde RegistroGPS posterior al inicio real del viaje', async () => {
    const mocks = createMockPrisma()
    const fechaInicioReal = new Date('2026-08-24T10:00:00.000Z')

    mocks.viajeFindUnique.mockResolvedValue({ creador_id: creadorId })
    mocks.viajeFindUniqueOrThrow.mockResolvedValue({ creador_id: creadorId, fecha_inicio_real: fechaInicioReal })
    mocks.viajeIntegranteFindMany.mockResolvedValue([
      {
        usuario_id: usuarioB,
        usuario: usuario(usuarioB, 'Marcos'),
        estado: 'confirmado',
        origen: 'qr',
        created_at: new Date('2026-08-24T09:50:00.000Z'),
        grupo_origen_id: null,
      },
      {
        usuario_id: usuarioC,
        usuario: usuario(usuarioC, 'Rocío'),
        estado: 'confirmado',
        origen: 'qr',
        created_at: new Date('2026-08-24T09:51:00.000Z'),
        grupo_origen_id: null,
      },
    ])
    mocks.grupoFindMany.mockResolvedValue([])
    mocks.grupoMiembroFindMany.mockResolvedValue([])
    // Solo Marcos mandó GPS después de que el viaje arrancó; Rocío confirmó pero nunca se unió.
    mocks.registroGPSGroupBy.mockResolvedValue([{ usuario_id: usuarioB }])

    const service = new ViajesService(mocks.prisma)
    const result = await service.listarParticipantes(creadorId, viajeId)

    expect(mocks.registroGPSGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['usuario_id'],
        where: expect.objectContaining({
          viaje_id: viajeId,
          timestamp: { gt: fechaInicioReal },
        }),
      })
    )
    expect(result).toEqual([
      expect.objectContaining({ usuario: usuario(usuarioB, 'Marcos'), union_efectiva: true }),
      expect.objectContaining({ usuario: usuario(usuarioC, 'Rocío'), union_efectiva: false }),
    ])
  })
})
