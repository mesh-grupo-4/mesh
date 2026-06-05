import type { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { getIo } from '../../realtime/ioRegistry'
import { HttpError } from '../../lib/httpError'
import { QR_EXPIRED_MESSAGE } from '../../lib/qrInvite'
import { computeLineStringLengthMeters } from '../../lib/postgis'
import { unirUsuarioAlViaje } from './viajes.membership'
import type {
  CreateViajeInput,
  PostPosicionesInput,
  PutRutaInput,
  ResponderInvitacionViajeInput,
} from './viajes.schemas'

export class ViajesService {
  constructor(private readonly prisma: PrismaClient) {}

  async crearViaje(creadorId: string, input: CreateViajeInput) {
    const existe = await this.prisma.usuario.findUnique({ where: { id: creadorId } })
    if (!existe) {
      throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')
    }

    if (input.fechaProgramada.getTime() <= Date.now()) {
      throw new HttpError(400, 'La fecha programada debe ser futura (UTC)', 'FECHA_PASADA')
    }

    const grupoIds = [...new Set(input.grupoIds ?? [])]

    if (grupoIds.length > 0) {
      const membresias = await this.prisma.grupoMiembro.findMany({
        where: {
          usuario_id: creadorId,
          grupo_id: { in: grupoIds },
        },
        select: { grupo_id: true },
      })
      const miembrosDe = new Set(membresias.map((m) => m.grupo_id))
      const noMiembro = grupoIds.find((id) => !miembrosDe.has(id))
      if (noMiembro) {
        throw new HttpError(
          403,
          'Solo podés invitar grupos de los que sos miembro',
          'NOT_GROUP_MEMBER'
        )
      }
    }

    const invitadosIds = new Set<string>()
    if (grupoIds.length > 0) {
      const miembros = await this.prisma.grupoMiembro.findMany({
        where: { grupo_id: { in: grupoIds } },
        select: { usuario_id: true },
      })
      for (const m of miembros) {
        if (m.usuario_id !== creadorId) {
          invitadosIds.add(m.usuario_id)
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const viaje = await tx.viaje.create({
        data: {
          creador_id: creadorId,
          es_grupal: input.esGrupal,
          tipo_actividad: input.tipoActividad,
          fecha_programada: input.fechaProgramada,
        },
      })

      await tx.viajeIntegrante.create({
        data: {
          viaje_id: viaje.id,
          usuario_id: creadorId,
          estado: 'confirmado',
          origen: 'creador',
        },
      })

      if (invitadosIds.size > 0) {
        await tx.viajeIntegrante.createMany({
          data: [...invitadosIds].map((usuarioId) => ({
            viaje_id: viaje.id,
            usuario_id: usuarioId,
            estado: 'pendiente' as const,
            origen: 'grupo' as const,
          })),
          skipDuplicates: true,
        })
      }

      return {
        ...viaje,
        invitaciones_enviadas: invitadosIds.size,
      }
    })
  }

  async listarPlanificados(usuarioId: string) {
    const viajes = await this.prisma.viaje.findMany({
      where: {
        estado: 'planificado',
        OR: [
          { creador_id: usuarioId },
          {
            integrantes: {
              some: {
                usuario_id: usuarioId,
                estado: { in: ['confirmado', 'pendiente'] },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        creador_id: true,
        es_grupal: true,
        tipo_actividad: true,
        fecha_programada: true,
        estado: true,
        integrantes: {
          where: { usuario_id: usuarioId },
          select: { estado: true },
        },
      },
      orderBy: { fecha_programada: 'asc' },
    })

    return viajes.map((v) => ({
      id: v.id,
      creador_id: v.creador_id,
      es_grupal: v.es_grupal,
      tipo_actividad: v.tipo_actividad,
      fecha_programada: v.fecha_programada,
      estado: v.estado,
      mi_estado: v.creador_id === usuarioId ? 'creador' : (v.integrantes[0]?.estado ?? null),
    }))
  }

  async listarInvitacionesPendientes(usuarioId: string) {
    const rows = await this.prisma.viajeIntegrante.findMany({
      where: { usuario_id: usuarioId, estado: 'pendiente' },
      include: {
        viaje: {
          select: {
            id: true,
            tipo_actividad: true,
            fecha_programada: true,
            estado: true,
            creador: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    return rows
      .filter((r) => r.viaje.estado === 'planificado')
      .map((r) => ({
        viaje_id: r.viaje.id,
        tipo_actividad: r.viaje.tipo_actividad,
        fecha_programada: r.viaje.fecha_programada,
        creador: r.viaje.creador,
        created_at: r.created_at,
      }))
  }

  async responderInvitacion(
    usuarioId: string,
    viajeId: string,
    input: ResponderInvitacionViajeInput
  ) {
    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: {
        viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId },
      },
      include: {
        viaje: { select: { id: true, estado: true, tipo_actividad: true, fecha_programada: true } },
      },
    })

    if (!integrante) {
      throw new HttpError(404, 'Invitación no encontrada', 'INVITATION_NOT_FOUND')
    }

    if (integrante.estado !== 'pendiente') {
      throw new HttpError(409, 'La invitación ya fue respondida', 'INVITATION_ALREADY_ANSWERED')
    }

    if (integrante.viaje.estado !== 'planificado') {
      throw new HttpError(410, 'El viaje ya no acepta respuestas', 'TRIP_NOT_PLANNED')
    }

    const nuevoEstado = input.accion === 'aceptar' ? 'confirmado' : 'rechazado'

    await this.prisma.viajeIntegrante.update({
      where: {
        viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId },
      },
      data: { estado: nuevoEstado },
    })

    return {
      viaje_id: viajeId,
      accion: input.accion,
      tipo_actividad: integrante.viaje.tipo_actividad,
      fecha_programada: integrante.viaje.fecha_programada,
    }
  }

  async listarParticipantes(creadorId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { creador_id: true },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id !== creadorId) {
      throw new HttpError(403, 'Solo el creador puede ver los participantes', 'NOT_CREATOR')
    }

    const integrantes = await this.prisma.viajeIntegrante.findMany({
      where: { viaje_id: viajeId },
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: [{ estado: 'asc' }, { created_at: 'asc' }],
    })

    return integrantes.map((i) => ({
      usuario: i.usuario,
      estado: i.estado,
      origen: i.origen,
      created_at: i.created_at,
    }))
  }

  /** RN-015 / RN-016: unión por QR al viaje planificado. */
  async unirsePorQr(usuarioId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: {
        id: true,
        estado: true,
      },
    })

    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }

    if (viaje.estado !== 'planificado') {
      throw new HttpError(410, QR_EXPIRED_MESSAGE, 'QR_EXPIRED')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      return unirUsuarioAlViaje(tx, viajeId, usuarioId, 'qr')
    })

    return { viajeId, yaEraParticipante: result.yaEraParticipante }
  }

  async guardarRuta(creadorId: string, viajeId: string, input: PutRutaInput) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id: viajeId } })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id !== creadorId) {
      throw new HttpError(403, 'Solo el creador puede configurar la ruta', 'NOT_CREATOR')
    }

    let distanciaM: number
    try {
      distanciaM = await computeLineStringLengthMeters(this.prisma, input.linestring)
    } catch {
      throw new HttpError(
        422,
        'No se pudo calcular la ruta. Verifica la ubicación de los puntos.',
        'ROUTE_COMPUTE_FAILED'
      )
    }
    const [oLng, oLat] = input.origen.coordinates
    const [dLng, dLat] = input.destino.coordinates

    const paradasOrdenadas = [...input.paradas].sort((a, b) => a.orden - b.orden)

    return this.prisma.$transaction(async (tx) => {
      const ruta = await tx.ruta.upsert({
        where: { viaje_id: viajeId },
        create: {
          viaje_id: viajeId,
          origen_lat: oLat,
          origen_lng: oLng,
          destino_lat: dLat,
          destino_lng: dLng,
          linestring_geojson: input.linestring as unknown as Prisma.InputJsonValue,
          distancia_planeada_m: distanciaM,
          tiempo_estimado_seg: input.tiempoEstimadoSeg ?? null,
        },
        update: {
          origen_lat: oLat,
          origen_lng: oLng,
          destino_lat: dLat,
          destino_lng: dLng,
          linestring_geojson: input.linestring as unknown as Prisma.InputJsonValue,
          distancia_planeada_m: distanciaM,
          tiempo_estimado_seg: input.tiempoEstimadoSeg ?? null,
        },
      })

      await tx.paradaIntermedia.deleteMany({ where: { ruta_id: ruta.id } })
      if (paradasOrdenadas.length > 0) {
        await tx.paradaIntermedia.createMany({
          data: paradasOrdenadas.map((p) => ({
            ruta_id: ruta.id,
            orden: p.orden,
            lat: p.lat,
            lng: p.lng,
            categoria: p.categoria,
          })),
        })
      }

      return ruta
    })
  }

  async iniciar(creadorId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id: viajeId } })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id !== creadorId) {
      throw new HttpError(403, 'Solo el creador puede iniciar el viaje', 'NOT_CREATOR')
    }
    if (viaje.estado !== 'planificado') {
      throw new HttpError(409, 'El viaje no está en estado planificado', 'INVALID_STATE')
    }

    const actualizado = await this.prisma.viaje.update({
      where: { id: viajeId },
      data: {
        estado: 'en_curso',
        fecha_inicio_real: new Date(),
      },
    })

    getIo().to(`viaje:${viajeId}`).emit('viaje:iniciado', {
      viajeId,
      estado: actualizado.estado,
      fechaInicioReal: actualizado.fecha_inicio_real?.toISOString() ?? null,
    })

    return actualizado
  }

  async finalizar(creadorId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      include: { ruta: true },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id !== creadorId) {
      throw new HttpError(403, 'Solo el creador puede finalizar el viaje', 'NOT_CREATOR')
    }
    if (viaje.estado !== 'en_curso') {
      throw new HttpError(409, 'El viaje no está en curso', 'INVALID_STATE')
    }

    const fechaFin = new Date()

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const v = await tx.viaje.update({
        where: { id: viajeId },
        data: {
          estado: 'finalizado',
          fecha_fin_real: fechaFin,
        },
      })

      const inicio = v.fecha_inicio_real
      const duracionSegundos =
        inicio != null ? Math.round((fechaFin.getTime() - inicio.getTime()) / 1000) : null

      const distanciaPlaneadaM = viaje.ruta?.distancia_planeada_m ?? null

      /** Paradas voluntarias (bitácora). MVP: sin tabla de eventos aún → 0. */
      const cantidadParadasVoluntarias = 0

      await tx.resumenViaje.upsert({
        where: { viaje_id: viajeId },
        create: {
          viaje_id: viajeId,
          duracion_segundos: duracionSegundos,
          distancia_planeada_m: distanciaPlaneadaM,
          distancia_real_m: null,
          cantidad_paradas: cantidadParadasVoluntarias,
        },
        update: {
          duracion_segundos: duracionSegundos,
          distancia_planeada_m: distanciaPlaneadaM,
          distancia_real_m: null,
          cantidad_paradas: cantidadParadasVoluntarias,
          generado_en: new Date(),
        },
      })

      return v
    })

    getIo().to(`viaje:${viajeId}`).emit('viaje:finalizado', {
      viajeId,
      estado: actualizado.estado,
      fechaFinReal: actualizado.fecha_fin_real?.toISOString() ?? null,
    })

    return actualizado
  }

  private async assertPuedeVerViaje(viajeId: string, usuarioId: string): Promise<void> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { creador_id: true },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id === usuarioId) return

    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: {
        viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId },
      },
      select: { estado: true },
    })
    if (integrante && integrante.estado !== 'rechazado') return

    throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
  }

  private async assertPuedeEnviarGps(viajeId: string, usuarioId: string): Promise<void> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: {
        id: true,
        creador_id: true,
        estado: true,
      },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.estado !== 'en_curso') {
      throw new HttpError(409, 'El viaje no admite envío de GPS en este estado', 'INVALID_STATE')
    }

    if (viaje.creador_id === usuarioId) return

    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: {
        viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId },
      },
      select: { estado: true },
    })
    if (integrante?.estado === 'confirmado') return

    throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
  }

  async detalleParaUsuario(usuarioId: string, viajeId: string) {
    await this.assertPuedeVerViaje(viajeId, usuarioId)

    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      include: {
        creador: { select: { id: true, nombre: true, email: true } },
        ruta: { select: { id: true, distancia_planeada_m: true } },
        integrantes: {
          where: { usuario_id: usuarioId },
          select: { estado: true, origen: true },
        },
      },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }

    const { integrantes, ...resto } = viaje
    const miParticipacion =
      resto.creador_id === usuarioId
        ? { estado: 'confirmado' as const, origen: 'creador' as const }
        : (integrantes[0] ?? null)

    return {
      ...resto,
      mi_participacion: miParticipacion,
    }
  }

  async ingresarPosiciones(usuarioId: string, viajeId: string, input: PostPosicionesInput) {
    await this.assertPuedeEnviarGps(viajeId, usuarioId)
    const rows = input.posiciones.map((p) => ({
      viaje_id: viajeId,
      usuario_id: usuarioId,
      lat: p.lat,
      lng: p.lng,
      precision_m: p.precision ?? null,
      timestamp: p.timestamp,
      source: input.source,
    }))
    await this.prisma.registroGPS.createMany({ data: rows })
    const last = rows[rows.length - 1]
    if (input.source === 'live' && last) {
      getIo().to(`viaje:${viajeId}`).emit('viaje:ubicacion', {
        viajeId,
        usuarioId,
        lat: last.lat,
        lng: last.lng,
        precision: last.precision_m,
        recordedAt: last.timestamp.toISOString(),
        source: input.source,
      })
    }
    return { insertados: rows.length }
  }

  async registrarPingUbicacion(
    usuarioId: string,
    payload: {
      viajeId: string
      lat: number
      lng: number
      accuracy?: number
      recordedAt: string
      source: 'live' | 'offline_sync'
    }
  ) {
    const { viajeId, lat, lng, accuracy, recordedAt, source } = payload
    await this.assertPuedeEnviarGps(viajeId, usuarioId)
    const ts = new Date(recordedAt)
    await this.prisma.registroGPS.create({
      data: {
        viaje_id: viajeId,
        usuario_id: usuarioId,
        lat,
        lng,
        precision_m: accuracy ?? null,
        timestamp: ts,
        source,
      },
    })
    getIo().to(`viaje:${viajeId}`).emit('viaje:ubicacion', {
      viajeId,
      usuarioId,
      lat,
      lng,
      precision: accuracy ?? null,
      recordedAt: ts.toISOString(),
      source,
    })
  }
}
