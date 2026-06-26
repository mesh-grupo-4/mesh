import type { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { getIo } from '../../realtime/ioRegistry'
import { HttpError } from '../../lib/httpError'
import { QR_EXPIRED_MESSAGE } from '../../lib/qrInvite'
import { computeLineStringLengthMeters } from '../../lib/postgis'
import { unirUsuarioAlViaje } from './viajes.membership'
import type {
  ActualizarViajeInput,
  CreateViajeInput,
  PostPosicionesInput,
  PutRutaInput,
  ResponderInvitacionViajeInput,
  UpsertUbicacionVivaInput,
} from './viajes.schemas'
import { parametrosPorActividad } from './activityDefaults'

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

    const amigoIds = [...new Set(input.amigoIds ?? [])].filter((id) => id !== creadorId)

    if (amigoIds.length > 0) {
      const amistades = await this.prisma.amistad.findMany({
        where: {
          estado: 'aceptada',
          OR: [
            { solicitante_id: creadorId, destinatario_id: { in: amigoIds } },
            { destinatario_id: creadorId, solicitante_id: { in: amigoIds } },
          ],
        },
        select: { solicitante_id: true, destinatario_id: true },
      })
      const amigosConfirmados = new Set(
        amistades.map((a) => (a.solicitante_id === creadorId ? a.destinatario_id : a.solicitante_id))
      )
      const noAmigo = amigoIds.find((id) => !amigosConfirmados.has(id))
      if (noAmigo) {
        throw new HttpError(403, 'Solo podés invitar a tus amigos', 'NOT_FRIEND')
      }
    }

    // origen prioriza 'grupo' sobre 'amigo' cuando una persona viene por ambos caminos
    const invitadosPorGrupo = new Set<string>()
    if (grupoIds.length > 0) {
      const miembros = await this.prisma.grupoMiembro.findMany({
        where: { grupo_id: { in: grupoIds } },
        select: { usuario_id: true },
      })
      for (const m of miembros) {
        if (m.usuario_id !== creadorId) {
          invitadosPorGrupo.add(m.usuario_id)
        }
      }
    }

    const invitadosPorAmigo = new Set(amigoIds.filter((id) => !invitadosPorGrupo.has(id)))
    const totalInvitados = invitadosPorGrupo.size + invitadosPorAmigo.size

    const params = parametrosPorActividad(input.tipoActividad)

    return this.prisma.$transaction(async (tx) => {
      const viaje = await tx.viaje.create({
        data: {
          creador_id: creadorId,
          nombre: input.nombre,
          es_grupal: input.esGrupal,
          tipo_actividad: input.tipoActividad,
          velocidad_esperada: params.velocidadEsperada,
          distancia_max_separacion: params.distanciaMaxSeparacion,
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

      const invitados = [
        ...[...invitadosPorGrupo].map((usuarioId) => ({
          viaje_id: viaje.id,
          usuario_id: usuarioId,
          estado: 'pendiente' as const,
          origen: 'grupo' as const,
        })),
        ...[...invitadosPorAmigo].map((usuarioId) => ({
          viaje_id: viaje.id,
          usuario_id: usuarioId,
          estado: 'pendiente' as const,
          origen: 'amigo' as const,
        })),
      ]

      if (invitados.length > 0) {
        await tx.viajeIntegrante.createMany({
          data: invitados,
          skipDuplicates: true,
        })
      }

      if (grupoIds.length > 0) {
        await tx.viajeGrupo.createMany({
          data: grupoIds.map((grupoId) => ({
            viaje_id: viaje.id,
            grupo_id: grupoId,
          })),
          skipDuplicates: true,
        })
      }

      return {
        ...viaje,
        invitaciones_enviadas: totalInvitados,
      }
    })
  }

  async listarPlanificados(usuarioId: string) {
    const viajes = await this.prisma.viaje.findMany({
      where: {
        estado: { in: ['planificado', 'en_curso'] },
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
        nombre: true,
        es_grupal: true,
        tipo_actividad: true,
        velocidad_esperada: true,
        distancia_max_separacion: true,
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
      nombre: v.nombre,
      es_grupal: v.es_grupal,
      tipo_actividad: v.tipo_actividad,
      velocidad_esperada: v.velocidad_esperada,
      distancia_max_separacion: v.distancia_max_separacion,
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
            nombre: true,
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
        nombre: r.viaje.nombre,
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

  async listarParticipantes(usuarioId: string, viajeId: string) {
    await this.assertPuedeVerViaje(viajeId, usuarioId)

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

  async obtenerRuta(usuarioId: string, viajeId: string) {
    await this.assertPuedeVerViaje(viajeId, usuarioId)

    const ruta = await this.prisma.ruta.findUnique({
      where: { viaje_id: viajeId },
      include: {
        paradas_intermedias: { orderBy: { orden: 'asc' } },
      },
    })

    if (!ruta) {
      throw new HttpError(404, 'Ruta no configurada', 'ROUTE_NOT_FOUND')
    }

    return {
      origen: {
        lat: ruta.origen_lat,
        lng: ruta.origen_lng,
        nombre: ruta.origen_nombre,
      },
      destino: {
        lat: ruta.destino_lat,
        lng: ruta.destino_lng,
        nombre: ruta.destino_nombre,
      },
      linestring: ruta.linestring_geojson,
      tiempo_estimado_seg: ruta.tiempo_estimado_seg,
      distancia_planeada_m: ruta.distancia_planeada_m,
      paradas: ruta.paradas_intermedias.map((p) => ({
        orden: p.orden,
        lat: p.lat,
        lng: p.lng,
        nombre: p.nombre,
        categoria: p.categoria,
      })),
    }
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
          origen_nombre: input.origenNombre ?? null,
          destino_lat: dLat,
          destino_lng: dLng,
          destino_nombre: input.destinoNombre ?? null,
          linestring_geojson: input.linestring as unknown as Prisma.InputJsonValue,
          distancia_planeada_m: distanciaM,
          tiempo_estimado_seg: input.tiempoEstimadoSeg ?? null,
        },
        update: {
          origen_lat: oLat,
          origen_lng: oLng,
          origen_nombre: input.origenNombre ?? null,
          destino_lat: dLat,
          destino_lng: dLng,
          destino_nombre: input.destinoNombre ?? null,
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
            nombre: p.nombre ?? null,
            categoria: p.categoria,
          })),
        })
      }

      return ruta
    })
  }

  async viajeEnCurso(usuarioId: string) {
    const viaje = await this.prisma.viaje.findFirst({
      where: {
        estado: 'en_curso',
        OR: [
          { creador_id: usuarioId },
          { integrantes: { some: { usuario_id: usuarioId, estado: 'confirmado' } } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        tipo_actividad: true,
        fecha_inicio_real: true,
        creador_id: true,
      },
    })
    if (!viaje) return null
    return {
      id: viaje.id,
      nombre: viaje.nombre,
      tipo_actividad: viaje.tipo_actividad,
      fecha_inicio_real: viaje.fecha_inicio_real?.toISOString() ?? null,
      soy_creador: viaje.creador_id === usuarioId,
    }
  }

  async estadisticasUsuario(usuarioId: string) {
    const participanteWhere: Prisma.ViajeWhereInput = {
      estado: 'finalizado',
      OR: [
        { creador_id: usuarioId },
        { integrantes: { some: { usuario_id: usuarioId, estado: 'confirmado' } } },
      ],
    }

    const [viajesFinalizados, porActividad] = await Promise.all([
      this.prisma.viaje.count({ where: participanteWhere }),
      this.prisma.viaje.groupBy({
        by: ['tipo_actividad'],
        where: participanteWhere,
        _count: { tipo_actividad: true },
        orderBy: { _count: { tipo_actividad: 'desc' } },
        take: 1,
      }),
    ])

    return {
      viajes_finalizados: viajesFinalizados,
      distancia_total_m: 0,
      tiempo_total_seg: 0,
      actividad_favorita: porActividad[0]?.tipo_actividad ?? null,
    }
  }

  async listarFinalizados(usuarioId: string) {
    const viajes = await this.prisma.viaje.findMany({
      where: {
        estado: 'finalizado',
        OR: [
          { creador_id: usuarioId },
          {
            integrantes: {
              some: {
                usuario_id: usuarioId,
                estado: 'confirmado',
              },
            },
          },
        ],
      },
      select: {
        id: true,
        creador_id: true,
        nombre: true,
        es_grupal: true,
        tipo_actividad: true,
        velocidad_esperada: true,
        distancia_max_separacion: true,
        fecha_programada: true,
        fecha_fin_real: true,
        estado: true,
        integrantes: {
          where: { usuario_id: usuarioId },
          select: { estado: true },
        },
      },
      orderBy: { fecha_fin_real: 'desc' },
    })

    return viajes.map((v) => ({
      id: v.id,
      creador_id: v.creador_id,
      nombre: v.nombre,
      es_grupal: v.es_grupal,
      tipo_actividad: v.tipo_actividad,
      velocidad_esperada: v.velocidad_esperada,
      distancia_max_separacion: v.distancia_max_separacion,
      fecha_programada: v.fecha_programada,
      fecha_fin_real: v.fecha_fin_real,
      estado: v.estado as 'finalizado',
      mi_estado: v.creador_id === usuarioId ? ('creador' as const) : (v.integrantes[0]?.estado ?? null),
    }))
  }

  /** RN-030: solo el líder puede reprogramar un viaje aún planificado. */
  async actualizarViaje(creadorId: string, viajeId: string, input: ActualizarViajeInput) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id: viajeId } })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id !== creadorId) {
      throw new HttpError(403, 'Solo el creador puede modificar el viaje', 'NOT_CREATOR')
    }
    if (viaje.estado !== 'planificado') {
      throw new HttpError(409, 'Solo se puede editar un viaje planificado', 'INVALID_STATE')
    }
    if (input.fechaProgramada.getTime() <= Date.now()) {
      throw new HttpError(400, 'La fecha programada debe ser futura (UTC)', 'FECHA_PASADA')
    }

    const actualizado = await this.prisma.viaje.update({
      where: { id: viajeId },
      data: { fecha_programada: input.fechaProgramada },
    })

    return {
      id: actualizado.id,
      fecha_programada: actualizado.fecha_programada,
      estado: actualizado.estado,
    }
  }

  /** RN-030: solo el creador puede eliminar un viaje planificado. */
  async eliminarViaje(creadorId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id: viajeId } })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id !== creadorId) {
      throw new HttpError(403, 'Solo el creador puede eliminar el viaje', 'NOT_CREATOR')
    }
    if (viaje.estado === 'en_curso') {
      throw new HttpError(409, 'No se puede eliminar un viaje en curso. Finalizalo primero.', 'INVALID_STATE')
    }

    await this.prisma.viaje.delete({ where: { id: viajeId } })

    return { viaje_id: viajeId, accion: 'eliminado' as const }
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
      nombre: actualizado.nombre,
      estado: actualizado.estado,
      fechaInicioReal: actualizado.fecha_inicio_real?.toISOString() ?? null,
      iniciadoPor: creadorId,
    })

    return actualizado
  }

  async salirViaje(usuarioId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { id: true, creador_id: true, estado: true },
    })
    if (!viaje) throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    if (viaje.creador_id === usuarioId) {
      throw new HttpError(403, 'El líder no puede salir del viaje, debe finalizarlo', 'LEADER_CANNOT_LEAVE')
    }

    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      select: { estado: true },
    })
    if (!integrante || integrante.estado !== 'confirmado') {
      throw new HttpError(403, 'No sos participante confirmado de este viaje', 'NOT_PARTICIPANT')
    }

    await this.prisma.viajeIntegrante.delete({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
    })

    if (viaje.estado === 'en_curso') {
      getIo().to(`viaje:${viajeId}`).emit('viaje:participante_salio', { viajeId, usuarioId })
    }

    return { viaje_id: viajeId, accion: 'salido' as const }
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

    // Push notifications a participantes confirmados (no al creador que ya finalizó)
    void this.notificarFinViaje(viajeId, viaje.nombre ?? null, creadorId)

    return actualizado
  }

  private async notificarFinViaje(
    viajeId: string,
    nombre: string | null,
    creadorId: string
  ): Promise<void> {
    try {
      const integrantes = await this.prisma.viajeIntegrante.findMany({
        where: { viaje_id: viajeId, estado: 'confirmado' },
        select: { usuario: { select: { id: true, push_token: true } } },
      })

      const { sendExpoPush } = await import('../../lib/expoPush')
      const mensajes = integrantes
        .filter((i) => i.usuario.id !== creadorId && i.usuario.push_token)
        .map((i) => ({
          to: i.usuario.push_token!,
          title: 'Viaje finalizado',
          body: nombre ? `"${nombre}" ha concluido.` : 'El viaje ha concluido.',
          data: { viajeId },
          sound: 'default' as const,
        }))

      await sendExpoPush(mensajes)
    } catch (e) {
      console.warn('[viajes] notificarFinViaje falló:', e)
    }
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
    if (last) {
      await this.upsertUbicacionVivaSnapshot({
        viajeId,
        usuarioId,
        lat: last.lat,
        lng: last.lng,
        precision: last.precision_m,
      })
    }
    return { insertados: rows.length }
  }

  async upsertUbicacionViva(usuarioId: string, viajeId: string, input: UpsertUbicacionVivaInput) {
    await this.assertPuedeEnviarGps(viajeId, usuarioId)
    await this.prisma.registroGPS.create({
      data: {
        viaje_id: viajeId,
        usuario_id: usuarioId,
        lat: input.lat,
        lng: input.lng,
        precision_m: input.precision ?? null,
        timestamp: input.recordedAt,
        source: 'live',
      },
    })
    const row = await this.upsertUbicacionVivaSnapshot({
      viajeId,
      usuarioId,
      lat: input.lat,
      lng: input.lng,
      precision: input.precision ?? null,
    })
    return row
  }

  async listarUbicacionesVivas(usuarioId: string, viajeId: string) {
    await this.assertPuedeVerViaje(viajeId, usuarioId)
    const rows = await this.prisma.ubicacionViva.findMany({
      where: { viaje_id: viajeId },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
      },
      orderBy: { updated_at: 'desc' },
    })
    return rows.map((r) => ({
      usuarioId: r.usuario_id,
      viajeId: r.viaje_id,
      lat: r.lat,
      lng: r.lng,
      precision: r.precision_m,
      updatedAt: r.updated_at.toISOString(),
      nombre: [r.usuario.nombre, r.usuario.apellido].filter(Boolean).join(' ').trim(),
    }))
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
    await this.upsertUbicacionVivaSnapshot({
      viajeId,
      usuarioId,
      lat,
      lng,
      precision: accuracy ?? null,
    })
  }

  private emitUbicacionLive(
    viajeId: string,
    usuarioId: string,
    lat: number,
    lng: number,
    precision: number | null,
    recordedAt: Date
  ) {
    getIo().to(`viaje:${viajeId}`).emit('viaje:ubicacion', {
      viajeId,
      usuarioId,
      lat,
      lng,
      precision,
      recordedAt: recordedAt.toISOString(),
      source: 'live',
    })
  }

  private async upsertUbicacionVivaSnapshot(input: {
    viajeId: string
    usuarioId: string
    lat: number
    lng: number
    precision: number | null
  }) {
    const row = await this.prisma.ubicacionViva.upsert({
      where: { usuario_id: input.usuarioId },
      create: {
        usuario_id: input.usuarioId,
        viaje_id: input.viajeId,
        lat: input.lat,
        lng: input.lng,
        precision_m: input.precision,
      },
      update: {
        viaje_id: input.viajeId,
        lat: input.lat,
        lng: input.lng,
        precision_m: input.precision,
      },
    })
    this.emitUbicacionLive(
      input.viajeId,
      input.usuarioId,
      input.lat,
      input.lng,
      input.precision,
      row.updated_at
    )
    return row
  }
}
