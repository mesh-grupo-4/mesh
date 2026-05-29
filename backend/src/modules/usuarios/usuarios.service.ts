import type { PrismaClient } from '@prisma/client'
import type { SyncUsuarioInput } from './usuarios.schemas'

export class UsuariosService {
  constructor(private readonly prisma: PrismaClient) {}

  async sync(input: SyncUsuarioInput) {
    return this.prisma.usuario.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        nombre: input.nombre,
      },
      update: {
        nombre: input.nombre,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
      },
    })
  }
}
