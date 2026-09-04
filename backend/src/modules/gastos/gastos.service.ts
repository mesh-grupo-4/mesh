import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import type { ActualizarGastoInput, CrearGastoInput } from './gastos.schemas'

type UsuarioNombre = { id: string; nombre: string; apellido: string | null }

type GastoConRelaciones = {
  id: string
  viaje_id: string
  usuario_id: string
  monto: number
  descripcion: string
  created_at: Date
  usuario: UsuarioNombre
  participantes: { usuario_id: string; usuario: UsuarioNombre }[]
}

function nombreDe(u: { nombre: string; apellido: string | null }): string {
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || 'Un integrante'
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

const usuarioSelect = { id: true, nombre: true, apellido: true } as const
const gastoInclude = {
  usuario: { select: usuarioSelect },
  participantes: { include: { usuario: { select: usuarioSelect } } },
} as const

type Saldo = { usuario_id: string; nombre: string; pagado: number; debe: number; saldo: number }
type Transaccion = {
  de_id: string
  de_nombre: string
  para_id: string
  para_nombre: string
  monto: number
}

/** Greedy "settle up": empareja el mayor deudor con el mayor acreedor hasta saldar. */
function calcularLiquidacion(
  gastos: { usuario_id: string; monto: number; participantes: { usuario_id: string }[] }[],
  nombres: Map<string, string>
): { por_persona: Saldo[]; transacciones: Transaccion[] } {
  const pagado = new Map<string, number>()
  const debe = new Map<string, number>()

  for (const g of gastos) {
    pagado.set(g.usuario_id, (pagado.get(g.usuario_id) ?? 0) + g.monto)
    const parte = g.monto / g.participantes.length
    for (const p of g.participantes) {
      debe.set(p.usuario_id, (debe.get(p.usuario_id) ?? 0) + parte)
    }
  }

  const ids = new Set([...pagado.keys(), ...debe.keys()])
  const porPersona: Saldo[] = [...ids].map((id) => ({
    usuario_id: id,
    nombre: nombres.get(id) ?? 'Un integrante',
    pagado: round2(pagado.get(id) ?? 0),
    debe: round2(debe.get(id) ?? 0),
    saldo: round2((pagado.get(id) ?? 0) - (debe.get(id) ?? 0)),
  }))

  const acreedores = porPersona
    .filter((s) => s.saldo > 0.01)
    .map((s) => ({ usuario_id: s.usuario_id, nombre: s.nombre, restante: s.saldo }))
    .sort((a, b) => b.restante - a.restante)
  const deudores = porPersona
    .filter((s) => s.saldo < -0.01)
    .map((s) => ({ usuario_id: s.usuario_id, nombre: s.nombre, restante: -s.saldo }))
    .sort((a, b) => b.restante - a.restante)

  const transacciones: Transaccion[] = []
  let i = 0
  let j = 0
  while (i < deudores.length && j < acreedores.length) {
    const d = deudores[i]!
    const a = acreedores[j]!
    const monto = round2(Math.min(d.restante, a.restante))
    if (monto > 0.01) {
      transacciones.push({
        de_id: d.usuario_id,
        de_nombre: d.nombre,
        para_id: a.usuario_id,
        para_nombre: a.nombre,
        monto,
      })
    }
    d.restante = round2(d.restante - monto)
    a.restante = round2(a.restante - monto)
    if (d.restante <= 0.01) i++
    if (a.restante <= 0.01) j++
  }

  return { por_persona: porPersona, transacciones }
}

export class GastosService {
  constructor(private readonly prisma: PrismaClient) {}

  private async cargarViaje(viajeId: string): Promise<{ id: string; creador_id: string; estado: string }> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { id: true, creador_id: true, estado: true },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    return viaje
  }

  /** IDs habilitados como participante de un gasto: el creador, y quien alguna vez confirmó (incluye a quien ya se fue). */
  private async participantesValidos(viaje: { id: string; creador_id: string }): Promise<Set<string>> {
    const integrantes = await this.prisma.viajeIntegrante.findMany({
      where: { viaje_id: viaje.id, estado: { in: ['confirmado', 'salido'] } },
      select: { usuario_id: true },
    })
    return new Set([viaje.creador_id, ...integrantes.map((i) => i.usuario_id)])
  }

  private async estadoIntegranteDe(viajeId: string, usuarioId: string): Promise<string | null> {
    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      select: { estado: true },
    })
    return integrante?.estado ?? null
  }

  /** RN-030: el backend valida. Registrar exige ser creador o integrante confirmado, con el viaje aún no finalizado. */
  private async assertPuedeRegistrar(viaje: { id: string; creador_id: string; estado: string }, usuarioId: string): Promise<void> {
    if (viaje.estado === 'finalizado') {
      throw new HttpError(409, 'El viaje ya finalizó', 'INVALID_STATE')
    }
    if (viaje.creador_id === usuarioId) return
    const estado = await this.estadoIntegranteDe(viaje.id, usuarioId)
    if (estado !== 'confirmado') {
      throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
    }
  }

  /** Ver gastos/balance: creador, confirmado, o quien ya salió (pudo haber compartido gastos antes de irse). */
  private async assertPuedeVer(viaje: { id: string; creador_id: string }, usuarioId: string): Promise<void> {
    if (viaje.creador_id === usuarioId) return
    const estado = await this.estadoIntegranteDe(viaje.id, usuarioId)
    if (estado !== 'confirmado' && estado !== 'salido') {
      throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
    }
  }

  private async validarParticipantes(
    viaje: { id: string; creador_id: string },
    participantesIds: string[]
  ): Promise<void> {
    const validos = await this.participantesValidos(viaje)
    for (const id of participantesIds) {
      if (!validos.has(id)) {
        throw new HttpError(400, 'Uno de los participantes elegidos no forma parte del viaje', 'PARTICIPANTE_INVALIDO')
      }
    }
  }

  async registrarGasto(usuarioId: string, viajeId: string, input: CrearGastoInput) {
    const viaje = await this.cargarViaje(viajeId)
    await this.assertPuedeRegistrar(viaje, usuarioId)
    await this.validarParticipantes(viaje, input.participantesIds)

    const gasto = await this.prisma.gasto.create({
      data: {
        viaje_id: viajeId,
        usuario_id: usuarioId,
        monto: input.monto,
        descripcion: input.descripcion,
        participantes: {
          createMany: { data: input.participantesIds.map((id) => ({ usuario_id: id })) },
        },
      },
      include: gastoInclude,
    })

    return this.mapGasto(gasto, usuarioId)
  }

  async listarGastos(usuarioId: string, viajeId: string) {
    const viaje = await this.cargarViaje(viajeId)
    await this.assertPuedeVer(viaje, usuarioId)

    const filas = await this.prisma.gasto.findMany({
      where: { viaje_id: viajeId },
      include: gastoInclude,
      orderBy: { created_at: 'desc' },
    })

    return filas.map((f) => this.mapGasto(f, usuarioId))
  }

  private async cargarGastoDelViaje(viajeId: string, gastoId: string): Promise<{ id: string; usuario_id: string }> {
    const gasto = await this.prisma.gasto.findUnique({
      where: { id: gastoId },
      select: { id: true, viaje_id: true, usuario_id: true },
    })
    if (!gasto || gasto.viaje_id !== viajeId) {
      throw new HttpError(404, 'Gasto no encontrado', 'GASTO_NOT_FOUND')
    }
    return gasto
  }

  async actualizarGasto(usuarioId: string, viajeId: string, gastoId: string, input: ActualizarGastoInput) {
    const viaje = await this.cargarViaje(viajeId)
    const gasto = await this.cargarGastoDelViaje(viajeId, gastoId)
    if (viaje.estado === 'finalizado') {
      throw new HttpError(409, 'El viaje ya finalizó', 'INVALID_STATE')
    }
    if (gasto.usuario_id !== usuarioId) {
      throw new HttpError(403, 'Solo podés editar tus propios gastos', 'FORBIDDEN')
    }
    if (input.participantesIds) {
      await this.validarParticipantes(viaje, input.participantesIds)
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      if (input.participantesIds) {
        await tx.gastoParticipante.deleteMany({ where: { gasto_id: gastoId } })
        await tx.gastoParticipante.createMany({
          data: input.participantesIds.map((id) => ({ gasto_id: gastoId, usuario_id: id })),
        })
      }
      return tx.gasto.update({
        where: { id: gastoId },
        data: {
          ...(input.monto !== undefined && { monto: input.monto }),
          ...(input.descripcion !== undefined && { descripcion: input.descripcion }),
        },
        include: gastoInclude,
      })
    })

    return this.mapGasto(actualizado, usuarioId)
  }

  async eliminarGasto(usuarioId: string, viajeId: string, gastoId: string): Promise<void> {
    const viaje = await this.cargarViaje(viajeId)
    const gasto = await this.cargarGastoDelViaje(viajeId, gastoId)
    if (viaje.estado === 'finalizado') {
      throw new HttpError(409, 'El viaje ya finalizó', 'INVALID_STATE')
    }
    if (gasto.usuario_id !== usuarioId) {
      throw new HttpError(403, 'Solo podés eliminar tus propios gastos', 'FORBIDDEN')
    }

    await this.prisma.gasto.delete({ where: { id: gastoId } })
  }

  /** El balance se calcula on-demand a partir de los gastos: no hay nada persistido aparte. */
  async obtenerBalance(usuarioId: string, viajeId: string) {
    const viaje = await this.cargarViaje(viajeId)
    if (viaje.estado !== 'finalizado') {
      throw new HttpError(409, 'El balance se genera cuando el viaje finaliza', 'INVALID_STATE')
    }
    await this.assertPuedeVer(viaje, usuarioId)

    const gastos = await this.prisma.gasto.findMany({
      where: { viaje_id: viajeId },
      include: gastoInclude,
    })

    const nombres = new Map<string, string>()
    for (const g of gastos) {
      nombres.set(g.usuario.id, nombreDe(g.usuario))
      for (const p of g.participantes) {
        nombres.set(p.usuario.id, nombreDe(p.usuario))
      }
    }

    return calcularLiquidacion(
      gastos.map((g) => ({
        usuario_id: g.usuario_id,
        monto: g.monto,
        participantes: g.participantes.map((p) => ({ usuario_id: p.usuario_id })),
      })),
      nombres
    )
  }

  private mapGasto(g: GastoConRelaciones, requesterId: string) {
    return {
      id: g.id,
      viaje_id: g.viaje_id,
      usuario_id: g.usuario_id,
      usuario_nombre: nombreDe(g.usuario),
      monto: g.monto,
      descripcion: g.descripcion,
      participantes: g.participantes.map((p) => ({
        usuario_id: p.usuario_id,
        nombre: nombreDe(p.usuario),
      })),
      monto_por_persona: round2(g.monto / g.participantes.length),
      puede_editar: g.usuario_id === requesterId,
      created_at: g.created_at.toISOString(),
    }
  }
}
