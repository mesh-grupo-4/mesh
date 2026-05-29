import { prisma } from '../../config/prisma'
import { firebaseAuth } from '../../config/firebase'

export async function findOrCreateByFirebaseUid(firebaseUid: string) {
  const existing = await prisma.usuario.findUnique({
    where: { firebase_uid: firebaseUid },
  })
  if (existing) return existing

  const firebaseUser = await firebaseAuth.getUser(firebaseUid)

  return prisma.usuario.create({
    data: {
      firebase_uid: firebaseUid,
      email: firebaseUser.email ?? '',
      nombre: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuario',
    },
  })
}
