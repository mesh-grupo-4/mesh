import { randomBytes } from 'crypto'
import type { CategoriaParada, Prisma, PrismaClient, TipoActividad } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { rutaSnapshotSchema, type RutaSnapshot } from './rutas-compartidas.schemas'

export function buildRouteShareLink(token: string): string {
  return `mesh://ruta?token=${encodeURIComponent(token)}`
}

export function nombreDesdeSnapshot(snapshot: RutaSnapshot): string {
  const origen = snapshot.origen.nombre?.trim()
  const destino = snapshot.destino.nombre?.trim()
  if (origen && destino) return `${origen} → ${destino}`
  if (origen) return `Desde ${origen}`
  if (destino) return `Hacia ${destino}`
  return 'Ruta compartida'
}

function nuevoToken(): string {
  return randomBytes(32).toString('base64url')
}

function parseSnapshot(raw: unknown): RutaSnapshot {
  const parsed = rutaSnapshotSchema.safeParse(raw)
  if (!parsed.success) {
    throw new HttpError(500, 'Snapshot de ruta inválido', 'SHARE_SNAPSHOT_INVALID')
  }
  return parsed.data
}

function previewFromSnapshot(snapshot: RutaSnapshot) {
  return {
    tipo_actividad: snapshot.tipo_actividad,
    origen: snapshot.origen,
    destino: snapshot.destino,
    linestring_geojson: snapshot.linestring_geojson,
    distancia_planeada_m: snapshot.distancia_planeada_m,
    tiempo_estimado_seg: snapshot.tiempo_estimado_seg,
    paradas: snapshot.paradas,
  }
}

export class RutasCompartidasService {
  constructor(private readonly prisma: PrismaClient) {}

  async compartirRuta(usuarioId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: {
        id: true,
        creador_id: true,
        tipo_actividad: true,
        ruta: {
          include: { paradas_intermedias: { orderBy: { orden: 'asc' } }, compartida: true },
        },
        integrantes: {
          where: { usuario_id: usuarioId },
          select: { estado: true },
        },
      },
    })

    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }

    const esCreador = viaje.creador_id === usuarioId
    const estado = viaje.integrantes[0]?.estado
    if (!esCreador && estado !== 'confirmado') {
      throw new HttpError(
        403,
        'Solo integrantes confirmados pueden compartir la ruta',
        'NOT_CONFIRMED_MEMBER'
      )
    }

    const ruta = viaje.ruta
    if (!ruta?.linestring_geojson) {
      throw new HttpError(
        422,
        'La ruta aún no está configurada completamente',
        'RUTA_INCOMPLETA'
      )
    }

    if (ruta.compartida && !ruta.compartida.revocado_en) {
      return {
        token: ruta.compartida.token,
        link: buildRouteShareLink(ruta.compartida.token),
        revocado: false as const,
      }
    }

    const snapshot: RutaSnapshot = {
      tipo_actividad: viaje.tipo_actividad,
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
      linestring_geojson: ruta.linestring_geojson as RutaSnapshot['linestring_geojson'],
      distancia_planeada_m: ruta.distancia_planeada_m,
      tiempo_estimado_seg: ruta.tiempo_estimado_seg,
      paradas: ruta.paradas_intermedias.map((p) => ({
        orden: p.orden,
        lat: p.lat,
        lng: p.lng,
        nombre: p.nombre,
        categoria: p.categoria,
      })),
    }

    const token = nuevoToken()
    const compartida = await this.prisma.rutaCompartida.upsert({
      where: { ruta_id: ruta.id },
      create: {
        ruta_id: ruta.id,
        token,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      update: {
        token,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        revocado_en: null,
      },
    })

    return {
      token: compartida.token,
      link: buildRouteShareLink(compartida.token),
      revocado: false as const,
    }
  }

  async revocarCompartir(usuarioId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: {
        creador_id: true,
        ruta: { select: { id: true, compartida: true } },
      },
    })

    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.creador_id !== usuarioId) {
      throw new HttpError(403, 'Solo el creador puede revocar el link', 'NOT_CREATOR')
    }

    const compartida = viaje.ruta?.compartida
    if (!compartida) {
      throw new HttpError(404, 'No hay link de ruta para este viaje', 'SHARE_NOT_FOUND')
    }
    if (compartida.revocado_en) {
      return { revocado: true as const }
    }

    await this.prisma.rutaCompartida.update({
      where: { id: compartida.id },
      data: { revocado_en: new Date() },
    })

    return { revocado: true as const }
  }

  async previewPorToken(_usuarioId: string, token: string) {
    const compartida = await this.prisma.rutaCompartida.findUnique({
      where: { token },
    })
    if (!compartida) {
      throw new HttpError(404, 'Link de ruta no encontrado', 'SHARE_NOT_FOUND')
    }
    if (compartida.revocado_en) {
      throw new HttpError(410, 'Este link de ruta fue revocado', 'SHARE_REVOKED')
    }

    return previewFromSnapshot(parseSnapshot(compartida.snapshot))
  }

  async importarPorToken(usuarioId: string, token: string) {
    const compartida = await this.prisma.rutaCompartida.findUnique({
      where: { token },
    })
    if (!compartida) {
      throw new HttpError(404, 'Link de ruta no encontrado', 'SHARE_NOT_FOUND')
    }
    if (compartida.revocado_en) {
      throw new HttpError(410, 'Este link de ruta fue revocado', 'SHARE_REVOKED')
    }

    const snapshot = parseSnapshot(compartida.snapshot)
    const existente = await this.prisma.rutaPlantilla.findUnique({
      where: {
        usuario_id_ruta_compartida_id: {
          usuario_id: usuarioId,
          ruta_compartida_id: compartida.id,
        },
      },
      include: { paradas: { orderBy: { orden: 'asc' } } },
    })

    if (existente) {
      return {
        plantilla: this.mapPlantilla(existente),
        ya_existia: true as const,
      }
    }

    try {
      const plantilla = await this.prisma.$transaction(async (tx) => {
        const creada = await tx.rutaPlantilla.create({
          data: {
            usuario_id: usuarioId,
            ruta_compartida_id: compartida.id,
            nombre: nombreDesdeSnapshot(snapshot),
            tipo_actividad: snapshot.tipo_actividad,
            origen_lat: snapshot.origen.lat,
            origen_lng: snapshot.origen.lng,
            origen_nombre: snapshot.origen.nombre,
            destino_lat: snapshot.destino.lat,
            destino_lng: snapshot.destino.lng,
            destino_nombre: snapshot.destino.nombre,
            linestring_geojson: snapshot.linestring_geojson as unknown as Prisma.InputJsonValue,
            distancia_planeada_m: snapshot.distancia_planeada_m,
            tiempo_estimado_seg: snapshot.tiempo_estimado_seg,
          },
        })

        if (snapshot.paradas.length > 0) {
          await tx.rutaPlantillaParada.createMany({
            data: snapshot.paradas.map((p) => ({
              ruta_plantilla_id: creada.id,
              orden: p.orden,
              lat: p.lat,
              lng: p.lng,
              nombre: p.nombre,
              categoria: p.categoria,
            })),
          })
        }

        return tx.rutaPlantilla.findUniqueOrThrow({
          where: { id: creada.id },
          include: { paradas: { orderBy: { orden: 'asc' } } },
        })
      })

      return {
        plantilla: this.mapPlantilla(plantilla),
        ya_existia: false as const,
      }
    } catch (err) {
      // Carrera concurrente: unique (usuario, ruta_compartida)
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
      if (code === 'P2002') {
        const reintento = await this.prisma.rutaPlantilla.findUnique({
          where: {
            usuario_id_ruta_compartida_id: {
              usuario_id: usuarioId,
              ruta_compartida_id: compartida.id,
            },
          },
          include: { paradas: { orderBy: { orden: 'asc' } } },
        })
        if (reintento) {
          return {
            plantilla: this.mapPlantilla(reintento),
            ya_existia: true as const,
          }
        }
      }
      throw err
    }
  }

  async listarPlantillas(usuarioId: string) {
    const rows = await this.prisma.rutaPlantilla.findMany({
      where: { usuario_id: usuarioId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        nombre: true,
        tipo_actividad: true,
        distancia_planeada_m: true,
        tiempo_estimado_seg: true,
        origen_nombre: true,
        destino_nombre: true,
        created_at: true,
      },
    })

    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      tipo_actividad: r.tipo_actividad,
      distancia_planeada_m: r.distancia_planeada_m,
      tiempo_estimado_seg: r.tiempo_estimado_seg,
      origen_nombre: r.origen_nombre,
      destino_nombre: r.destino_nombre,
      created_at: r.created_at,
    }))
  }

  async obtenerPlantilla(usuarioId: string, plantillaId: string) {
    const plantilla = await this.prisma.rutaPlantilla.findUnique({
      where: { id: plantillaId },
      include: { paradas: { orderBy: { orden: 'asc' } } },
    })
    if (!plantilla || plantilla.usuario_id !== usuarioId) {
      throw new HttpError(404, 'Plantilla no encontrada', 'PLANTILLA_NOT_FOUND')
    }
    return this.mapPlantilla(plantilla)
  }

  async eliminarPlantilla(usuarioId: string, plantillaId: string) {
    const plantilla = await this.prisma.rutaPlantilla.findUnique({
      where: { id: plantillaId },
      select: { id: true, usuario_id: true },
    })
    if (!plantilla || plantilla.usuario_id !== usuarioId) {
      throw new HttpError(404, 'Plantilla no encontrada', 'PLANTILLA_NOT_FOUND')
    }
    await this.prisma.rutaPlantilla.delete({ where: { id: plantillaId } })
    return { eliminada: true as const }
  }

  /** Copia la plantilla del usuario a un viaje recién creado (misma transacción). */
  async copiarPlantillaAViaje(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    viajeId: string,
    plantillaId: string
  ): Promise<{ tipo_actividad: TipoActividad }> {
    const plantilla = await tx.rutaPlantilla.findUnique({
      where: { id: plantillaId },
      include: { paradas: { orderBy: { orden: 'asc' } } },
    })
    if (!plantilla || plantilla.usuario_id !== usuarioId) {
      throw new HttpError(404, 'Plantilla no encontrada', 'PLANTILLA_NOT_FOUND')
    }

    const ruta = await tx.ruta.create({
      data: {
        viaje_id: viajeId,
        origen_lat: plantilla.origen_lat,
        origen_lng: plantilla.origen_lng,
        origen_nombre: plantilla.origen_nombre,
        destino_lat: plantilla.destino_lat,
        destino_lng: plantilla.destino_lng,
        destino_nombre: plantilla.destino_nombre,
        linestring_geojson: plantilla.linestring_geojson as Prisma.InputJsonValue,
        distancia_planeada_m: plantilla.distancia_planeada_m,
        tiempo_estimado_seg: plantilla.tiempo_estimado_seg,
      },
    })

    if (plantilla.paradas.length > 0) {
      await tx.paradaIntermedia.createMany({
        data: plantilla.paradas.map((p) => ({
          ruta_id: ruta.id,
          orden: p.orden,
          lat: p.lat,
          lng: p.lng,
          nombre: p.nombre,
          categoria: p.categoria as CategoriaParada,
        })),
      })
    }

    return { tipo_actividad: plantilla.tipo_actividad }
  }

  private mapPlantilla(plantilla: {
    id: string
    nombre: string
    tipo_actividad: TipoActividad
    origen_lat: number
    origen_lng: number
    origen_nombre: string | null
    destino_lat: number
    destino_lng: number
    destino_nombre: string | null
    linestring_geojson: unknown
    distancia_planeada_m: number | null
    tiempo_estimado_seg: number | null
    created_at: Date
    paradas: Array<{
      orden: number
      lat: number
      lng: number
      nombre: string | null
      categoria: CategoriaParada
    }>
  }) {
    return {
      id: plantilla.id,
      nombre: plantilla.nombre,
      tipo_actividad: plantilla.tipo_actividad,
      origen: {
        lat: plantilla.origen_lat,
        lng: plantilla.origen_lng,
        nombre: plantilla.origen_nombre,
      },
      destino: {
        lat: plantilla.destino_lat,
        lng: plantilla.destino_lng,
        nombre: plantilla.destino_nombre,
      },
      linestring_geojson: plantilla.linestring_geojson,
      distancia_planeada_m: plantilla.distancia_planeada_m,
      tiempo_estimado_seg: plantilla.tiempo_estimado_seg,
      created_at: plantilla.created_at,
      paradas: plantilla.paradas.map((p) => ({
        orden: p.orden,
        lat: p.lat,
        lng: p.lng,
        nombre: p.nombre,
        categoria: p.categoria,
      })),
    }
  }
}
