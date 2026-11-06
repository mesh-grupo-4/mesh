import type { EstadoViajeIntegrante, OrigenViajeIntegrante, PrismaClient } from '@prisma/client'

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>

/**
 * RN-029b: integrante ACTIVO = confirmó y además hizo check-in en el viaje en curso.
 * Es la única puerta para todo lo "en vivo": envío de GPS, motor de eventos, push
 * de alertas y acciones durante el viaje. Quien confirmó pero no se sumó (se quedó
 * en casa) no se trackea ni dispara alertas.
 */
export const WHERE_INTEGRANTE_ACTIVO = {
  estado: 'confirmado' as const,
  check_in_at: { not: null },
}

export function esIntegranteActivo(
  fila: { estado: EstadoViajeIntegrante; check_in_at: Date | null } | null | undefined
): boolean {
  return fila?.estado === 'confirmado' && fila.check_in_at != null
}

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
        // `fecha_salida: null` limpia una salida previa: si vuelve, ya no "salió antes".
        data: { estado: 'confirmado', origen, fecha_salida: null, check_in_at: null },
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
