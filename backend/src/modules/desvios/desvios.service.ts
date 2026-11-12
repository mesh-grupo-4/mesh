import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { obtenerMotorEventos } from '../motor-eventos/motorEventos.service'
import { esIntegranteActivo } from '../viajes/viajes.membership'

/**
 * RN-034b: desvío del grupo y desvío voluntario. El estado vive en el motor de
 * eventos (en memoria, como el resto de su estado); acá solo se valida quién puede
 * hacer qué antes de delegar (RN-030).
 */
export class DesviosService {
  constructor(private readonly prisma: PrismaClient) {}

  private get motor() {
    return obtenerMotorEventos(this.prisma)
  }

  /** Cualquier integrante del viaje en curso ve el estado (el líder lo necesita para el banner). */
  async estado(usuarioId: string, viajeId: string) {
    await this.assertParticipa(viajeId, usuarioId, { requiereCheckIn: false })
    return this.motor.estadoDesvioGrupal(viajeId)
  }

  async confirmar(usuarioId: string, viajeId: string) {
    await this.assertLider(viajeId, usuarioId)
    return this.motor.confirmarDesvioGrupal(viajeId)
  }

  async rechazar(usuarioId: string, viajeId: string) {
    await this.assertLider(viajeId, usuarioId)
    return this.motor.rechazarDesvioGrupal(viajeId)
  }

  async desvioVoluntario(usuarioId: string, viajeId: string) {
    await this.assertParticipa(viajeId, usuarioId, { requiereCheckIn: true })
    await this.motor.marcarDesvioVoluntario(viajeId, usuarioId)
  }

  private async viajeEnCurso(viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { creador_id: true, estado: true },
    })
    if (!viaje) throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    if (viaje.estado !== 'en_curso') {
      throw new HttpError(409, 'El viaje no está en curso', 'INVALID_STATE')
    }
    return viaje
  }

  private async assertLider(viajeId: string, usuarioId: string): Promise<void> {
    const viaje = await this.viajeEnCurso(viajeId)
    if (viaje.creador_id !== usuarioId) {
      throw new HttpError(403, 'Solo el líder puede decidir sobre la ruta del grupo', 'NOT_LEADER')
    }
  }

  private async assertParticipa(
    viajeId: string,
    usuarioId: string,
    { requiereCheckIn }: { requiereCheckIn: boolean }
  ): Promise<void> {
    const viaje = await this.viajeEnCurso(viajeId)
    if (viaje.creador_id === usuarioId) return
    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      select: { estado: true, check_in_at: true },
    })
    if (integrante?.estado !== 'confirmado') {
      throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
    }
    // RN-029b: avisar un desvío es una acción en vivo; requiere haberse sumado.
    if (requiereCheckIn && !esIntegranteActivo(integrante)) {
      throw new HttpError(403, 'Tenés que sumarte al viaje primero', 'NOT_CHECKED_IN')
    }
  }
}
