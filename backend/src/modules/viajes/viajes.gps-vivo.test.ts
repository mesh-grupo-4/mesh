import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const viajeId = '22222222-2222-2222-2222-222222222222'
const usuarioId = '11111111-1111-1111-1111-111111111111'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

// El motor de eventos corre "fire and forget" (dispatchMotorPing no lo espera):
// se stubea para que no dispare pedidos reales contra el prisma mockeado.
const procesarPing = vi.fn().mockResolvedValue(undefined)
vi.mock('../motor-eventos/motorEventos.service', () => ({
  MotorEventosService: class {
    procesarPing = procesarPing
  },
}))

const snapshotPrevio = {
  usuario_id: usuarioId,
  viaje_id: viajeId,
  lat: -31.4,
  lng: -64.17,
  precision_m: 8,
  updated_at: new Date('2026-08-31T11:59:00.000Z'),
}

function armarPrisma(tipoActividad: string, snapshotExistente: unknown = null) {
  const registroGpsCreate = vi.fn().mockResolvedValue({})
  const ubicacionVivaUpsert = vi.fn().mockResolvedValue({
    usuario_id: usuarioId,
    viaje_id: viajeId,
    lat: -31.42,
    lng: -64.18,
    precision_m: null,
    updated_at: new Date('2026-08-31T12:00:00.000Z'),
  })
  const ubicacionVivaFindUnique = vi.fn().mockResolvedValue(snapshotExistente)
  const prisma = {
    viaje: {
      findUnique: vi.fn().mockResolvedValue({
        id: viajeId,
        creador_id: usuarioId,
        estado: 'en_curso',
        tipo_actividad: tipoActividad,
      }),
    },
    viajeIntegrante: { findUnique: vi.fn() },
    registroGPS: { create: registroGpsCreate, createMany: vi.fn() },
    ubicacionViva: { upsert: ubicacionVivaUpsert, findUnique: ubicacionVivaFindUnique },
  } as unknown as PrismaClient
  return { prisma, registroGpsCreate, ubicacionVivaUpsert, ubicacionVivaFindUnique }
}

beforeEach(() => {
  vi.clearAllMocks()
})

/**
 * A diferencia de las queries de lectura (que ya filtran por precision_m), el
 * canal en vivo retransmitía cualquier ping tal cual llegara. Estos tests fijan
 * que un punto impreciso (por encima del umbral de la modalidad, RN-021) se sigue
 * guardando en registro_gps para no perder historial (RN-038), pero ya no
 * "ensucia" una posición en vivo ya conocida — salvo que sea la primera vez que
 * el usuario aparece en el viaje, en cuyo caso se publica igual: sin esto,
 * quedaría invisible para el grupo hasta el primer fix preciso, y el endpoint
 * devolvería `null` en vez de un `UbicacionVivaFila` (RN-032/RN-038, y contrato
 * OpenAPI: `UbicacionVivaFila` no es nullable).
 */
describe('filtrado de precisión antes de retransmitir la posición en vivo', () => {
  it('registrarPingUbicacion: un ping impreciso CON posición previa se persiste pero no downgradea ni emite', async () => {
    const m = armarPrisma('bici', snapshotPrevio) // precisionMaxM bici = 40
    const service = new ViajesService(m.prisma)

    await service.registrarPingUbicacion(usuarioId, {
      viajeId,
      lat: -31.42,
      lng: -64.18,
      accuracy: 999,
      recordedAt: '2026-08-31T12:00:00.000Z',
      source: 'live',
    })

    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('registrarPingUbicacion: un ping impreciso SIN posición previa se publica igual (primera aparición)', async () => {
    const m = armarPrisma('bici', null) // precisionMaxM bici = 40
    const service = new ViajesService(m.prisma)

    await service.registrarPingUbicacion(usuarioId, {
      viajeId,
      lat: -31.42,
      lng: -64.18,
      accuracy: 999,
      recordedAt: '2026-08-31T12:00:00.000Z',
      source: 'live',
    })

    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(
      'viaje:ubicacion',
      expect.objectContaining({ viajeId, usuarioId })
    )
  })

  it('registrarPingUbicacion: un ping preciso se persiste y sí emite viaje:ubicacion', async () => {
    const m = armarPrisma('bici')
    const service = new ViajesService(m.prisma)

    await service.registrarPingUbicacion(usuarioId, {
      viajeId,
      lat: -31.42,
      lng: -64.18,
      accuracy: 10,
      recordedAt: '2026-08-31T12:00:00.000Z',
      source: 'live',
    })

    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(
      'viaje:ubicacion',
      expect.objectContaining({ viajeId, usuarioId })
    )
  })

  it('upsertUbicacionViva: un ping impreciso CON posición previa no downgradea ni emite, y devuelve la existente', async () => {
    const m = armarPrisma('bici', snapshotPrevio)
    const service = new ViajesService(m.prisma)

    const row = await service.upsertUbicacionViva(usuarioId, viajeId, {
      lat: -31.42,
      lng: -64.18,
      precision: 999,
      recordedAt: new Date('2026-08-31T12:00:00.000Z'),
    })

    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
    // Nunca null: violaría el schema `UbicacionVivaFila` (no nullable) del spec OpenAPI.
    expect(row).toEqual(snapshotPrevio)
  })

  it('upsertUbicacionViva: un ping impreciso SIN posición previa se publica igual (primera aparición)', async () => {
    const m = armarPrisma('bici', null)
    const service = new ViajesService(m.prisma)

    const row = await service.upsertUbicacionViva(usuarioId, viajeId, {
      lat: -31.42,
      lng: -64.18,
      precision: 999,
      recordedAt: new Date('2026-08-31T12:00:00.000Z'),
    })

    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(
      'viaje:ubicacion',
      expect.objectContaining({ viajeId, usuarioId })
    )
    expect(row).not.toBeNull()
  })

  it('upsertUbicacionViva: un ping preciso se persiste y sí emite viaje:ubicacion', async () => {
    const m = armarPrisma('bici')
    const service = new ViajesService(m.prisma)

    await service.upsertUbicacionViva(usuarioId, viajeId, {
      lat: -31.42,
      lng: -64.18,
      precision: 10,
      recordedAt: new Date('2026-08-31T12:00:00.000Z'),
    })

    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(
      'viaje:ubicacion',
      expect.objectContaining({ viajeId, usuarioId })
    )
  })

  it('un umbral distinto por modalidad (RN-021): la misma precisión pasa en moto y no pasa en trekking', async () => {
    // Con posición previa: si no hubiera ninguna, la excepción de "primera
    // aparición" publicaría el ping igual en las dos modalidades y no probaría nada.
    const trekking = armarPrisma('trekking', snapshotPrevio) // precisionMaxM trekking = 30
    const moto = armarPrisma('moto', snapshotPrevio) // precisionMaxM moto = 50

    await new ViajesService(trekking.prisma).registrarPingUbicacion(usuarioId, {
      viajeId,
      lat: -31.42,
      lng: -64.18,
      accuracy: 45,
      recordedAt: '2026-08-31T12:00:00.000Z',
      source: 'live',
    })
    await new ViajesService(moto.prisma).registrarPingUbicacion(usuarioId, {
      viajeId,
      lat: -31.42,
      lng: -64.18,
      accuracy: 45,
      recordedAt: '2026-08-31T12:00:00.000Z',
      source: 'live',
    })

    expect(trekking.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(moto.ubicacionVivaUpsert).toHaveBeenCalledTimes(1)
  })
})
