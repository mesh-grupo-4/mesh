import type { PrismaClient } from '@prisma/client'

export type UnirseGrupoResult = {
  grupoId: string
  yaEraMiembro: boolean
}

/** RN-016: agrega participante al grupo; idempotente si ya es miembro. */
export async function unirUsuarioAlGrupo(
  prisma: PrismaClient,
  usuarioId: string,
  grupoId: string
): Promise<UnirseGrupoResult> {
  const existente = await prisma.grupoMiembro.findUnique({
    where: {
      grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: usuarioId },
    },
  })

  if (existente) {
    return { grupoId, yaEraMiembro: true }
  }

  await prisma.grupoMiembro.create({
    data: {
      grupo_id: grupoId,
      usuario_id: usuarioId,
      rol: 'participante',
    },
  })

  return { grupoId, yaEraMiembro: false }
}
