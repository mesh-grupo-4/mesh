import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { assertPuedeVerLogros, puedeVerLogros } from './logros.acceso'

const yoId = '11111111-1111-1111-1111-111111111111'
const otroId = '22222222-2222-2222-2222-222222222222'

function armarPrisma(visibilidad: string | null, amistad: unknown = null) {
  const amistadFindFirst = vi.fn().mockResolvedValue(amistad)
  const prisma = {
    usuario: {
      findUnique: vi
        .fn()
        .mockResolvedValue(visibilidad ? { visibilidad_logros: visibilidad } : null),
    },
    amistad: { findFirst: amistadFindFirst },
  } as unknown as PrismaClient
  return { prisma, amistadFindFirst }
}

describe('puedeVerLogros (RN-077)', () => {
  it('el propio usuario siempre ve sus logros', () => {
    expect(puedeVerLogros('solo_yo', true, false)).toBe(true)
  })

  it('todos: cualquiera los ve', () => {
    expect(puedeVerLogros('todos', false, false)).toBe(true)
  })

  it('amigos: solo los amigos', () => {
    expect(puedeVerLogros('amigos', false, true)).toBe(true)
    expect(puedeVerLogros('amigos', false, false)).toBe(false)
  })

  it('solo_yo: nadie más, ni siquiera un amigo', () => {
    expect(puedeVerLogros('solo_yo', false, true)).toBe(false)
  })
})

describe('assertPuedeVerLogros', () => {
  it('404 si el usuario no existe', async () => {
    const { prisma } = armarPrisma(null)
    await expect(assertPuedeVerLogros(prisma, otroId, yoId)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    })
  })

  it('403 LOGROS_PRIVADOS con solo_yo', async () => {
    const { prisma } = armarPrisma('solo_yo')
    await expect(assertPuedeVerLogros(prisma, otroId, yoId)).rejects.toMatchObject({
      status: 403,
      code: 'LOGROS_PRIVADOS',
    })
  })

  it('403 con amigos si no hay amistad aceptada', async () => {
    const { prisma } = armarPrisma('amigos', null)
    await expect(assertPuedeVerLogros(prisma, otroId, yoId)).rejects.toMatchObject({
      status: 403,
      code: 'LOGROS_PRIVADOS',
    })
  })

  it('pasa con amigos si son amigos', async () => {
    const { prisma } = armarPrisma('amigos', { id: 'x' })
    await expect(assertPuedeVerLogros(prisma, otroId, yoId)).resolves.toBeUndefined()
  })

  it('con todos no consulta la amistad', async () => {
    const { prisma, amistadFindFirst } = armarPrisma('todos')
    await assertPuedeVerLogros(prisma, otroId, yoId)
    expect(amistadFindFirst).not.toHaveBeenCalled()
  })

  it('el propio usuario pasa aunque tenga solo_yo', async () => {
    const { prisma } = armarPrisma('solo_yo')
    await expect(assertPuedeVerLogros(prisma, yoId, yoId)).resolves.toBeUndefined()
  })
})
