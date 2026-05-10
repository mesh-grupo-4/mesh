import type { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { getIo } from '../../realtime/ioRegistry'
import { HttpError } from '../../lib/httpError'
import { computeLineStringLengthMeters } from '../../lib/postgis'
import type { CreateViajeInput, PostPosicionesInput, PutRutaInput } from './viajes.schemas'

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

    if (input.esGrupal) {
      const grupoId = input.grupoId as string
      const grupo = await this.prisma.grupo.findUnique({
        where: { id: grupoId },
        include: {
          miembros: {
            where: { usuario_id: creadorId },
          },
        },
      })
      if (!grupo) {
        throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
      }
      const esLiderMiembro =
        grupo.lider_id === creadorId ||
        grupo.miembros.some((m) => m.rol === 'lider')
      if (!esLiderMiembro) {
        throw new HttpError(403, 'Solo un líder del grupo puede crear un viaje grupal', 'NOT_GROUP_LEADER')
      }
    }

    return this.prisma.viaje.create({
      data: {
        creador_id: creadorId,
        grupo_id: input.esGrupal ? (input.grupoId as string) : null,
        es_grupal: input.esGrupal,
        tipo_actividad: input.tipoActividad,
        fecha_programada: input.fechaProgramada,
      },
    })
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

  private async assertPuedeVerViaje(
    viaje: { creador_id: string; es_grupal: boolean; grupo_id: string | null },
    usuarioId: string
  ): Promise<void> {
    if (viaje.creador_id === usuarioId) return
    if (viaje.es_grupal && viaje.grupo_id) {
      const m = await this.prisma.grupoMiembro.findFirst({
        where: { grupo_id: viaje.grupo_id, usuario_id: usuarioId },
      })
      if (m) return
    }
    throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
  }

  private async assertPuedeEnviarGps(viajeId: string, usuarioId: string): Promise<void> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: {
        id: true,
        creador_id: true,
        es_grupal: true,
        grupo_id: true,
        estado: true,
      },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.estado !== 'en_curso') {
      throw new HttpError(409, 'El viaje no admite envío de GPS en este estado', 'INVALID_STATE')
    }
    await this.assertPuedeVerViaje(viaje, usuarioId)
  }

  async detalleParaUsuario(usuarioId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      include: {
        creador: { select: { id: true, nombre: true, email: true } },
        ruta: { select: { id: true, distancia_planeada_m: true } },
      },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    await this.assertPuedeVerViaje(viaje, usuarioId)
    return viaje
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
