import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '../../config/prisma'
import { firebaseAuth } from '../../config/firebase'
import type { SyncUsuarioInput } from './usuarios.schemas'

// Usado por requireUser — encuentra o crea el usuario a partir del UID de Firebase
export async function findOrCreateByFirebaseUid(firebaseUid: string) {
  const existing = await defaultPrisma.usuario.findUnique({
    where: { firebase_uid: firebaseUid },
  })
  if (existing) return existing

  const firebaseUser = await firebaseAuth.getUser(firebaseUid)
  const email = firebaseUser.email ?? ''

  // Cuenta legacy: mismo email en BD con firebase_uid desactualizado (migración / re-login).
  if (email) {
    const byEmail = await defaultPrisma.usuario.findUnique({ where: { email } })
    if (byEmail) {
      return defaultPrisma.usuario.update({
        where: { id: byEmail.id },
        data: { firebase_uid: firebaseUid },
      })
    }
  }

  return defaultPrisma.usuario.create({
    data: {
      firebase_uid: firebaseUid,
      email,
      nombre: firebaseUser.displayName ?? email.split('@')[0] ?? 'Usuario',
    },
  })
}

export class UsuariosService {
  constructor(private readonly prisma: PrismaClient) {}

  async getMe(userId: string) {
    return this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        telefono: true,
        actividad_preferida: true,
      },
    })
  }

  async upsertPushToken(userId: string, token: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { push_token: token },
    })
  }

  async sync(userId: string, input: SyncUsuarioInput) {
    return this.prisma.usuario.update({
      where: { id: userId },
      data: {
        nombre: input.nombre,
        // undefined → no se toca el campo; null → se limpia
        ...(input.apellido !== undefined ? { apellido: input.apellido } : {}),
        ...(input.telefono !== undefined ? { telefono: input.telefono } : {}),
        ...(input.actividad_preferida !== undefined
          ? { actividad_preferida: input.actividad_preferida }
          : {}),
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        telefono: true,
        actividad_preferida: true,
      },
    })
  }
}
