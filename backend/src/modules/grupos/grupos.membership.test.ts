import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { unirUsuarioAlGrupo } from './grupos.membership'

const usuarioId = '22222222-2222-2222-2222-222222222222'
const grupoId = '33333333-3333-3333-3333-333333333333'

describe('unirUsuarioAlGrupo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea miembro participante si no existía', async () => {
    const grupoMiembroFindUnique = vi.fn().mockResolvedValue(null)
    const grupoMiembroCreate = vi.fn().mockResolvedValue({})

    const prisma = {
      grupoMiembro: { findUnique: grupoMiembroFindUnique, create: grupoMiembroCreate },
    } as unknown as PrismaClient

    const result = await unirUsuarioAlGrupo(prisma, usuarioId, grupoId)

    expect(result).toEqual({ grupoId, yaEraMiembro: false })
    expect(grupoMiembroCreate).toHaveBeenCalled()
  })

  it('no duplica si ya es miembro', async () => {
    const grupoMiembroFindUnique = vi.fn().mockResolvedValue({ rol: 'participante' })
    const grupoMiembroCreate = vi.fn()

    const prisma = {
      grupoMiembro: { findUnique: grupoMiembroFindUnique, create: grupoMiembroCreate },
    } as unknown as PrismaClient

    const result = await unirUsuarioAlGrupo(prisma, usuarioId, grupoId)

    expect(result).toEqual({ grupoId, yaEraMiembro: true })
    expect(grupoMiembroCreate).not.toHaveBeenCalled()
  })
})
