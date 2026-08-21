import { beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioMock = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}

vi.mock('../../config/prisma', () => ({
  prisma: { usuario: usuarioMock },
}))

const getUser = vi.fn()
vi.mock('../../config/firebase', () => ({
  firebaseAuth: { getUser: (uid: string) => getUser(uid) },
}))

const { findOrCreateByFirebaseUid } = await import('./usuarios.service')

const firebaseUid = 'firebase-uid-123'
const email = 'piloto@mesh.test'
const filaExistente = { id: '11111111-1111-1111-1111-111111111111', firebase_uid: firebaseUid, email }

function errorP2002(target: string) {
  return Object.assign(new Error(`Unique constraint failed on ${target}`), { code: 'P2002' })
}

describe('findOrCreateByFirebaseUid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ email, displayName: 'Piloto Mesh' })
  })

  it('devuelve la fila existente sin tocar Firebase', async () => {
    usuarioMock.findUnique.mockResolvedValueOnce(filaExistente)

    await expect(findOrCreateByFirebaseUid(firebaseUid)).resolves.toEqual(filaExistente)
    expect(getUser).not.toHaveBeenCalled()
    expect(usuarioMock.create).not.toHaveBeenCalled()
  })

  it('crea el usuario la primera vez que inicia sesión', async () => {
    usuarioMock.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    usuarioMock.create.mockResolvedValueOnce(filaExistente)

    await expect(findOrCreateByFirebaseUid(firebaseUid)).resolves.toEqual(filaExistente)
    expect(usuarioMock.create).toHaveBeenCalledWith({
      data: { firebase_uid: firebaseUid, email, nombre: 'Piloto Mesh' },
    })
  })

  // Carrera del primer login: dos requests concurrentes ejecutan el create a la vez.
  it('resuelve el P2002 releyendo la fila que creó la request que ganó', async () => {
    usuarioMock.findUnique
      .mockResolvedValueOnce(null) // lectura inicial por firebase_uid
      .mockResolvedValueOnce(null) // lectura por email (cuenta legacy)
      .mockResolvedValueOnce(filaExistente) // relectura tras el conflicto
    usuarioMock.create.mockRejectedValueOnce(errorP2002('firebase_uid'))

    await expect(findOrCreateByFirebaseUid(firebaseUid)).resolves.toEqual(filaExistente)
  })

  it('tras un P2002 por email, adopta la fila y actualiza su firebase_uid', async () => {
    const filaLegacy = { ...filaExistente, firebase_uid: 'uid-viejo' }
    usuarioMock.findUnique
      .mockResolvedValueOnce(null) // lectura inicial por firebase_uid
      .mockResolvedValueOnce(null) // lectura por email
      .mockResolvedValueOnce(null) // relectura por firebase_uid
      .mockResolvedValueOnce(filaLegacy) // relectura por email
    usuarioMock.create.mockRejectedValueOnce(errorP2002('email'))
    usuarioMock.update.mockResolvedValueOnce(filaExistente)

    await expect(findOrCreateByFirebaseUid(firebaseUid)).resolves.toEqual(filaExistente)
    expect(usuarioMock.update).toHaveBeenCalledWith({
      where: { id: filaLegacy.id },
      data: { firebase_uid: firebaseUid },
    })
  })

  it('propaga errores que no son conflictos de unicidad', async () => {
    usuarioMock.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    usuarioMock.create.mockRejectedValueOnce(
      Object.assign(new Error('conexión caída'), { code: 'P1001' })
    )

    await expect(findOrCreateByFirebaseUid(firebaseUid)).rejects.toThrow('conexión caída')
  })
})
