import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { filtrarQuienesComparten, registrarAccesosUbicacion } from './privacidad.acceso'

const viajeId = '22222222-2222-2222-2222-222222222222'
const ana = '11111111-1111-1111-1111-111111111111'
const beto = '33333333-3333-3333-3333-333333333333'
const caro = '44444444-4444-4444-4444-444444444444'

const CON_CONSENTIMIENTO = new Date('2026-09-15T10:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
})

function armarPrisma(
  usuarios: {
    id: string
    comparte_ubicacion_default: boolean
    consentimiento_ubicacion_at: Date | null
  }[],
  preferencias: { usuario_id: string; comparte_ubicacion: boolean }[] = []
) {
  const executeRaw = vi.fn().mockResolvedValue(1)
  const prisma = {
    usuario: { findMany: vi.fn().mockResolvedValue(usuarios) },
    privacidadViaje: { findMany: vi.fn().mockResolvedValue(preferencias) },
    $executeRaw: executeRaw,
  } as unknown as PrismaClient
  return { prisma, executeRaw }
}

describe('filtrarQuienesComparten (RN-110/111)', () => {
  it('la preferencia del viaje pisa el default del perfil, en ambos sentidos', async () => {
    const { prisma } = armarPrisma(
      [
        // Default en off, pero encendido para este viaje.
        { id: ana, comparte_ubicacion_default: false, consentimiento_ubicacion_at: CON_CONSENTIMIENTO },
        // Default en on, pero apagado para este viaje.
        { id: beto, comparte_ubicacion_default: true, consentimiento_ubicacion_at: CON_CONSENTIMIENTO },
        // Sin fila propia: manda el default.
        { id: caro, comparte_ubicacion_default: true, consentimiento_ubicacion_at: CON_CONSENTIMIENTO },
      ],
      [
        { usuario_id: ana, comparte_ubicacion: true },
        { usuario_id: beto, comparte_ubicacion: false },
      ]
    )

    const comparten = await filtrarQuienesComparten(prisma, viajeId, [ana, beto, caro])

    expect([...comparten].sort()).toEqual([ana, caro].sort())
  })

  it('sin consentimiento nadie comparte, aunque la preferencia esté en on', async () => {
    const { prisma } = armarPrisma(
      [{ id: ana, comparte_ubicacion_default: true, consentimiento_ubicacion_at: null }],
      [{ usuario_id: ana, comparte_ubicacion: true }]
    )

    expect([...(await filtrarQuienesComparten(prisma, viajeId, [ana]))]).toEqual([])
  })

  it('con la lista vacía no consulta la base', async () => {
    const { prisma } = armarPrisma([])

    expect([...(await filtrarQuienesComparten(prisma, viajeId, []))]).toEqual([])
    expect(prisma.usuario.findMany).not.toHaveBeenCalled()
  })
})

describe('registrarAccesosUbicacion (RN-112)', () => {
  it('no registra que alguien se miró a sí mismo', async () => {
    const { prisma, executeRaw } = armarPrisma([])

    await registrarAccesosUbicacion(prisma, viajeId, ana, [ana])

    expect(executeRaw).not.toHaveBeenCalled()
  })

  it('escribe todo el lote en una sola sentencia', async () => {
    const { prisma, executeRaw } = armarPrisma([])

    await registrarAccesosUbicacion(prisma, viajeId, ana, [ana, beto, caro])

    expect(executeRaw).toHaveBeenCalledTimes(1)
    // Los parámetros del template van después del array de fragmentos de SQL.
    const params = executeRaw.mock.calls[0]!.slice(1)
    expect(params).toContainEqual([beto, caro])
  })

  it('deduplica los observados: repetirlos abortaría el ON CONFLICT', async () => {
    const { prisma, executeRaw } = armarPrisma([])

    await registrarAccesosUbicacion(prisma, viajeId, ana, [beto, beto, caro])

    const params = executeRaw.mock.calls[0]!.slice(1)
    expect(params).toContainEqual([beto, caro])
  })
})
