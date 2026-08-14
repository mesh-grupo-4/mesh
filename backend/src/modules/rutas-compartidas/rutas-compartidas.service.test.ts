import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import {
  buildRouteShareLink,
  nombreDesdeSnapshot,
  RutasCompartidasService,
} from './rutas-compartidas.service'
import type { RutaSnapshot } from './rutas-compartidas.schemas'

const usuarioId = '11111111-1111-1111-1111-111111111111'
const otroUsuarioId = '22222222-2222-2222-2222-222222222222'
const viajeId = '33333333-3333-3333-3333-333333333333'
const rutaId = '44444444-4444-4444-4444-444444444444'
const shareId = '55555555-5555-5555-5555-555555555555'
const plantillaId = '66666666-6666-6666-6666-666666666666'
const token = 'abcdefghijklmnopqrstuvwxyz0123456789ABCD'

const snapshot: RutaSnapshot = {
  tipo_actividad: 'bici',
  origen: { lat: -31.4, lng: -64.2, nombre: 'Córdoba' },
  destino: { lat: -31.5, lng: -64.3, nombre: 'Carlos Paz' },
  linestring_geojson: {
    type: 'LineString',
    coordinates: [
      [-64.2, -31.4],
      [-64.3, -31.5],
    ],
  },
  distancia_planeada_m: 42000,
  tiempo_estimado_seg: 7200,
  paradas: [
    {
      orden: 0,
      lat: -31.45,
      lng: -64.25,
      nombre: 'Mirador',
      categoria: 'descanso',
    },
  ],
}

function createMockPrisma() {
  const viajeFindUnique = vi.fn()
  const rutaCompartidaFindUnique = vi.fn()
  const rutaCompartidaUpsert = vi.fn()
  const rutaCompartidaUpdate = vi.fn()
  const rutaPlantillaFindUnique = vi.fn()
  const rutaPlantillaCreate = vi.fn()
  const rutaPlantillaFindMany = vi.fn()
  const rutaPlantillaDelete = vi.fn()
  const rutaPlantillaParadaCreateMany = vi.fn()
  const rutaCreate = vi.fn()
  const paradaIntermediaCreateMany = vi.fn()
  const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      rutaPlantilla: {
        create: rutaPlantillaCreate,
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          usuario_id: usuarioId,
          nombre: 'Córdoba → Carlos Paz',
          tipo_actividad: 'bici',
          origen_lat: snapshot.origen.lat,
          origen_lng: snapshot.origen.lng,
          origen_nombre: snapshot.origen.nombre,
          destino_lat: snapshot.destino.lat,
          destino_lng: snapshot.destino.lng,
          destino_nombre: snapshot.destino.nombre,
          linestring_geojson: snapshot.linestring_geojson,
          distancia_planeada_m: snapshot.distancia_planeada_m,
          tiempo_estimado_seg: snapshot.tiempo_estimado_seg,
          created_at: new Date('2026-08-14T12:00:00Z'),
          paradas: snapshot.paradas,
        })),
        findUnique: rutaPlantillaFindUnique,
      },
      rutaPlantillaParada: { createMany: rutaPlantillaParadaCreateMany },
      ruta: { create: rutaCreate },
      paradaIntermedia: { createMany: paradaIntermediaCreateMany },
    })
  )

  const prisma = {
    viaje: { findUnique: viajeFindUnique },
    rutaCompartida: {
      findUnique: rutaCompartidaFindUnique,
      upsert: rutaCompartidaUpsert,
      update: rutaCompartidaUpdate,
    },
    rutaPlantilla: {
      findUnique: rutaPlantillaFindUnique,
      findMany: rutaPlantillaFindMany,
      delete: rutaPlantillaDelete,
      create: rutaPlantillaCreate,
    },
    $transaction: transaction,
  }

  return {
    prisma: prisma as unknown as PrismaClient,
    viajeFindUnique,
    rutaCompartidaFindUnique,
    rutaCompartidaUpsert,
    rutaCompartidaUpdate,
    rutaPlantillaFindUnique,
    rutaPlantillaCreate,
    rutaPlantillaFindMany,
    rutaPlantillaDelete,
    rutaPlantillaParadaCreateMany,
    rutaCreate,
    paradaIntermediaCreateMany,
    transaction,
  }
}

describe('RutasCompartidasService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('buildRouteShareLink usa esquema distinto al QR de unirse', () => {
    expect(buildRouteShareLink(token)).toBe(`mesh://ruta?token=${token}`)
    expect(buildRouteShareLink(token)).not.toContain('unirse')
  })

  it('nombreDesdeSnapshot usa origen y destino', () => {
    expect(nombreDesdeSnapshot(snapshot)).toBe('Córdoba → Carlos Paz')
  })

  it('creador confirmado puede obtener/crear link', async () => {
    const { prisma, viajeFindUnique, rutaCompartidaUpsert } = createMockPrisma()
    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      creador_id: usuarioId,
      tipo_actividad: 'bici',
      ruta: {
        id: rutaId,
        origen_lat: -31.4,
        origen_lng: -64.2,
        origen_nombre: 'Córdoba',
        destino_lat: -31.5,
        destino_lng: -64.3,
        destino_nombre: 'Carlos Paz',
        linestring_geojson: snapshot.linestring_geojson,
        distancia_planeada_m: 42000,
        tiempo_estimado_seg: 7200,
        paradas_intermedias: snapshot.paradas,
        compartida: null,
      },
      integrantes: [{ estado: 'confirmado' }],
    })
    rutaCompartidaUpsert.mockResolvedValue({
      token,
      revocado_en: null,
    })

    const service = new RutasCompartidasService(prisma)
    const out = await service.compartirRuta(usuarioId, viajeId)

    expect(out.link).toBe(`mesh://ruta?token=${token}`)
    expect(out.revocado).toBe(false)
    expect(rutaCompartidaUpsert).toHaveBeenCalled()
  })

  it('integrante pendiente no puede compartir', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()
    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      creador_id: '99999999-9999-9999-9999-999999999999',
      tipo_actividad: 'bici',
      ruta: {
        id: rutaId,
        linestring_geojson: snapshot.linestring_geojson,
        paradas_intermedias: [],
        compartida: null,
      },
      integrantes: [{ estado: 'pendiente' }],
    })

    const service = new RutasCompartidasService(prisma)
    await expect(service.compartirRuta(usuarioId, viajeId)).rejects.toMatchObject({
      code: 'NOT_CONFIRMED_MEMBER',
      status: 403,
    })
  })

  it('ruta incompleta devuelve RUTA_INCOMPLETA', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()
    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      creador_id: usuarioId,
      tipo_actividad: 'bici',
      ruta: null,
      integrantes: [{ estado: 'confirmado' }],
    })

    const service = new RutasCompartidasService(prisma)
    await expect(service.compartirRuta(usuarioId, viajeId)).rejects.toMatchObject({
      code: 'RUTA_INCOMPLETA',
      status: 422,
    })
  })

  it('preview no incluye participantes ni gps', async () => {
    const { prisma, rutaCompartidaFindUnique } = createMockPrisma()
    rutaCompartidaFindUnique.mockResolvedValue({
      id: shareId,
      token,
      revocado_en: null,
      snapshot,
    })

    const service = new RutasCompartidasService(prisma)
    const out = await service.previewPorToken(usuarioId, token)

    expect(out.tipo_actividad).toBe('bici')
    expect(out.paradas).toHaveLength(1)
    expect(out).not.toHaveProperty('participantes')
    expect(out).not.toHaveProperty('viaje_id')
    expect(JSON.stringify(out)).not.toContain('gps')
  })

  it('token revocado devuelve 410', async () => {
    const { prisma, rutaCompartidaFindUnique } = createMockPrisma()
    rutaCompartidaFindUnique.mockResolvedValue({
      id: shareId,
      token,
      revocado_en: new Date(),
      snapshot,
    })

    const service = new RutasCompartidasService(prisma)
    await expect(service.previewPorToken(usuarioId, token)).rejects.toMatchObject({
      code: 'SHARE_REVOKED',
      status: 410,
    })
  })

  it('importar es idempotente y no toca ViajeIntegrante', async () => {
    const { prisma, rutaCompartidaFindUnique, rutaPlantillaFindUnique, transaction } =
      createMockPrisma()
    rutaCompartidaFindUnique.mockResolvedValue({
      id: shareId,
      token,
      revocado_en: null,
      snapshot,
    })
    const plantillaExistente = {
      id: plantillaId,
      usuario_id: usuarioId,
      nombre: 'Córdoba → Carlos Paz',
      tipo_actividad: 'bici' as const,
      origen_lat: snapshot.origen.lat,
      origen_lng: snapshot.origen.lng,
      origen_nombre: snapshot.origen.nombre,
      destino_lat: snapshot.destino.lat,
      destino_lng: snapshot.destino.lng,
      destino_nombre: snapshot.destino.nombre,
      linestring_geojson: snapshot.linestring_geojson,
      distancia_planeada_m: snapshot.distancia_planeada_m,
      tiempo_estimado_seg: snapshot.tiempo_estimado_seg,
      created_at: new Date('2026-08-14T12:00:00Z'),
      paradas: snapshot.paradas,
    }
    rutaPlantillaFindUnique.mockResolvedValue(plantillaExistente)

    const service = new RutasCompartidasService(prisma)
    const out = await service.importarPorToken(usuarioId, token)

    expect(out.ya_existia).toBe(true)
    expect(out.plantilla.id).toBe(plantillaId)
    expect(transaction).not.toHaveBeenCalled()
    expect(prisma).not.toHaveProperty('viajeIntegrante')
  })

  it('solo el creador puede revocar', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()
    viajeFindUnique.mockResolvedValue({
      creador_id: otroUsuarioId,
      ruta: { id: rutaId, compartida: { id: shareId, revocado_en: null } },
    })

    const service = new RutasCompartidasService(prisma)
    await expect(service.revocarCompartir(usuarioId, viajeId)).rejects.toBeInstanceOf(HttpError)
    await expect(service.revocarCompartir(usuarioId, viajeId)).rejects.toMatchObject({
      code: 'NOT_CREATOR',
    })
  })

  it('copiarPlantillaAViaje exige dueño', async () => {
    const { prisma, rutaPlantillaFindUnique } = createMockPrisma()
    const service = new RutasCompartidasService(prisma)
    const tx = {
      rutaPlantilla: { findUnique: rutaPlantillaFindUnique },
      ruta: { create: vi.fn() },
      paradaIntermedia: { createMany: vi.fn() },
    }
    rutaPlantillaFindUnique.mockResolvedValue({
      id: plantillaId,
      usuario_id: otroUsuarioId,
      paradas: [],
    })

    await expect(
      service.copiarPlantillaAViaje(tx as never, usuarioId, viajeId, plantillaId)
    ).rejects.toMatchObject({ code: 'PLANTILLA_NOT_FOUND' })
  })
})
