import type { OrigenViajeIntegrante, PrismaClient } from '@prisma/client'

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>

/** RN-016: agrega participante confirmado al viaje; idempotente si ya participa. */
export async function unirUsuarioAlViaje(
  tx: TransactionClient,
  viajeId: string,
  usuarioId: string,
  origen: OrigenViajeIntegrante
): Promise<{ yaEraParticipante: boolean }> {
  const existente = await tx.viajeIntegrante.findUnique({
    where: {
      viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId },
    },
  })

  if (existente) {
    if (existente.estado !== 'confirmado') {
      await tx.viajeIntegrante.update({
        where: {
          viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId },
        },
        data: { estado: 'confirmado', origen },
      })
      return { yaEraParticipante: false }
    }
    return { yaEraParticipante: true }
  }

  await tx.viajeIntegrante.create({
    data: {
      viaje_id: viajeId,
      usuario_id: usuarioId,
      estado: 'confirmado',
      origen,
    },
  })

  return { yaEraParticipante: false }
}
