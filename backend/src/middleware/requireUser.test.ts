import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyIdToken = vi.fn()
vi.mock('../config/firebase', () => ({
  firebaseAuth: { verifyIdToken: (t: string) => verifyIdToken(t) },
}))

const findOrCreate = vi.fn()
vi.mock('../modules/usuarios/usuarios.service', () => ({
  findOrCreateByFirebaseUid: (uid: string) => findOrCreate(uid),
}))

const { requireUser } = await import('./requireUser')

async function correr() {
  const req = { header: () => 'Bearer token-valido' } as Record<string, unknown>
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
  const next = vi.fn()
  await requireUser(req as never, res as never, next)
  return { req, res, next }
}

describe('requireUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyIdToken.mockResolvedValue({ uid: 'uid-1' })
  })

  it('resuelve userId y rolSistema desde la base', async () => {
    findOrCreate.mockResolvedValue({ id: 'u-1', rol_sistema: 'superadmin', suspendido_at: null })
    const { req, next } = await correr()
    expect(next).toHaveBeenCalled()
    expect(req.userId).toBe('u-1')
    expect(req.rolSistema).toBe('superadmin')
  })

  it('RN-123: rechaza una cuenta suspendida aunque el token sea válido', async () => {
    findOrCreate.mockResolvedValue({ id: 'u-1', rol_sistema: 'usuario', suspendido_at: new Date() })
    const { res, next } = await correr()
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }))
  })

  it('RN-124: un token vigente de una cuenta eliminada es 401, no 500', async () => {
    findOrCreate.mockRejectedValue(Object.assign(new Error('no existe'), { code: 'auth/user-not-found' }))
    const { res } = await correr()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }))
  })
})
