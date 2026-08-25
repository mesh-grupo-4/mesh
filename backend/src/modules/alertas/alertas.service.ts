import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { getIo } from '../../realtime/ioRegistry'
import type { CrearAlertaInput, TipoAlerta } from './alertas.schemas'

/** Título del push por tema (RN-040). */
const TITULO_POR_TIPO: Record<TipoAlerta, string> = {
  parada: 'Parada del grupo',
  combustible: 'Carga de combustible',
  desvio: 'Desvío en la ruta',
  peligro: 'Atención: peligro',
  informacion: 'Aviso del líder',
}

function nombreDe(u: { nombre: string; apellido: string | null } | null): string | null {
  if (!u) return null
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || null
}

export class AlertasService {
  constructor(private readonly prisma: PrismaClient) {}

  /** RN-030: solo el creador del viaje crea alertas, y solo con el viaje en curso. */
  private async assertEsLiderDeViajeEnCurso(viajeId: string, usuarioId: string): Promise<void> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { creador_id: true, estado: true },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id !== usuarioId) {
      throw new HttpError(403, 'Solo el líder puede crear alertas', 'FORBIDDEN')
    }
    if (viaje.estado !== 'en_curso') {
      throw new HttpError(409, 'El viaje no está en curso', 'INVALID_STATE')
    }
  }

  /** Lectura del historial: cualquier integrante, en cualquier estado del viaje. */
  private async assertPuedeVerAlertas(viajeId: string, usuarioId: string): Promise<void> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { creador_id: true },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id === usuarioId) return

    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      select: { estado: true },
    })
    // 'salido' incluido: quien abandonó igual puede repasar el historial del viaje.
    if (integrante && ['confirmado', 'salido'].includes(integrante.estado)) return

    throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
  }

  /** US1: crea la alerta, la emite al viaje y notifica a todos los integrantes. */
  async crear(usuarioId: string, viajeId: string, input: CrearAlertaInput) {
    await this.assertEsLiderDeViajeEnCurso(viajeId, usuarioId)

    const alerta = await this.prisma.alerta.create({
      data: {
        viaje_id: viajeId,
        creada_por_id: usuarioId,
        tipo: input.tipo,
        origen: 'lider',
        mensaje: input.mensaje?.trim() || null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
      },
      include: { creada_por: { select: { nombre: true, apellido: true } } },
    })

    const mapeada = this.mapAlerta(alerta)
    this.emitir(viajeId, mapeada)
    void this.notificar(viajeId, usuarioId, input.tipo, alerta.mensaje)

    return mapeada
  }

  /** Historial completo del viaje, más reciente primero. */
  async listar(usuarioId: string, viajeId: string) {
    await this.assertPuedeVerAlertas(viajeId, usuarioId)
    const filas = await this.prisma.alerta.findMany({
      where: { viaje_id: viajeId },
      include: { creada_por: { select: { nombre: true, apellido: true } } },
      orderBy: { created_at: 'desc' },
      take: 200,
    })
    return filas.map((f) => this.mapAlerta(f))
  }

  private mapAlerta(a: {
    id: string
    viaje_id: string
    creada_por_id: string | null
    tipo: string
    origen: string
    mensaje: string | null
    lat: number | null
    lng: number | null
    estado: string
    created_at: Date
    creada_por?: { nombre: string; apellido: string | null } | null
  }) {
    return {
      id: a.id,
      viaje_id: a.viaje_id,
      creada_por_id: a.creada_por_id,
      creada_por_nombre: nombreDe(a.creada_por ?? null),
      tipo: a.tipo,
      origen: a.origen,
      mensaje: a.mensaje,
      lat: a.lat,
      lng: a.lng,
      estado: a.estado,
      created_at: a.created_at.toISOString(),
    }
  }

  /** El socket es best-effort: un fallo de tiempo real no debe voltear la request. */
  private emitir(viajeId: string, alerta: ReturnType<AlertasService['mapAlerta']>): void {
    try {
      getIo().to(`viaje:${viajeId}`).emit('viaje:alerta', { viajeId, alerta })
    } catch (e) {
      console.warn('[alertas] No se pudo emitir viaje:alerta:', e)
    }
  }

  /** RN-040: push a todos los integrantes del viaje, salvo el líder que la creó. */
  private async notificar(
    viajeId: string,
    autorId: string,
    tipo: TipoAlerta,
    mensaje: string | null
  ): Promise<void> {
    try {
      const integrantes = await this.prisma.viajeIntegrante.findMany({
        where: { viaje_id: viajeId, estado: 'confirmado' },
        select: { usuario: { select: { id: true, push_token: true } } },
      })

      const destinos = new Map<string, string>()
      for (const i of integrantes) {
        if (i.usuario.id !== autorId && i.usuario.push_token) {
          destinos.set(i.usuario.id, i.usuario.push_token)
        }
      }
      if (destinos.size === 0) return

      const { sendExpoPush } = await import('../../lib/expoPush')
      await sendExpoPush(
        [...destinos.values()].map((to) => ({
          to,
          title: TITULO_POR_TIPO[tipo],
          // Sin mensaje el título ya dice de qué se trata; no inventamos texto.
          body: mensaje ?? undefined,
          data: { viajeId, tipo: 'alerta' },
          sound: 'default' as const,
        }))
      )
    } catch (e) {
      console.warn('[alertas] notificar falló:', e)
    }
  }
}
