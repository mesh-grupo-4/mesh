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
  obtenerMotorEventos: () => ({
    procesarPing,
    limpiarViaje: vi.fn(),
    limpiarIntegrante: vi.fn(),
  }),
}))

const snapshotPrevio = {
  usuario_id: usuarioId,
  viaje_id: viajeId,
  lat: -31.4,
  lng: -64.17,
  precision_m: 8,
  updated_at: new Date('2026-08-31T11:59:00.000Z'),
}

function armarPrisma(
  tipoActividad: string,
  snapshotExistente: unknown = null,
  privacidad: { comparte?: boolean; consentimiento?: boolean } = {}
) {
  const { comparte = true, consentimiento = true } = privacidad
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
  const registroGpsFindFirst = vi.fn().mockResolvedValue(null)
  const registroGpsCreateMany = vi.fn().mockResolvedValue({ count: 1 })
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
    // RN-110/111: `estadoCompartirUbicacion` resuelve consentimiento y preferencia
    // del viaje en una sola consulta sobre `usuario`.
    usuario: {
      findUnique: vi.fn().mockResolvedValue({
        comparte_ubicacion_default: true,
        consentimiento_ubicacion_at: consentimiento ? new Date('2026-09-01T00:00:00.000Z') : null,
        privacidad_viajes: [{ comparte_ubicacion: comparte }],
      }),
    },
    registroGPS: {
      create: registroGpsCreate,
      createMany: registroGpsCreateMany,
      findFirst: registroGpsFindFirst,
    },
    ubicacionViva: { upsert: ubicacionVivaUpsert, findUnique: ubicacionVivaFindUnique },
  } as unknown as PrismaClient
  return {
    prisma,
    registroGpsCreate,
    registroGpsCreateMany,
    registroGpsFindFirst,
    ubicacionVivaUpsert,
    ubicacionVivaFindUnique,
  }
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

    const out = await service.upsertUbicacionViva(usuarioId, viajeId, {
      lat: -31.42,
      lng: -64.18,
      precision: 999,
      recordedAt: new Date('2026-08-31T12:00:00.000Z'),
    })

    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
    // Compartiendo, `ubicacion` nunca es null: se devuelve la posición previa.
    expect(out).toEqual({ compartida: true, ubicacion: snapshotPrevio })
  })

  it('upsertUbicacionViva: un ping impreciso SIN posición previa se publica igual (primera aparición)', async () => {
    const m = armarPrisma('bici', null)
    const service = new ViajesService(m.prisma)

    const out = await service.upsertUbicacionViva(usuarioId, viajeId, {
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
    expect(out.ubicacion).not.toBeNull()
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

/**
 * RN-038: el lote `offline_sync` llega en el orden en que se encoló, puede ser
 * más viejo que los pings en vivo que ya entraron tras reconectar, y no debe
 * disparar el motor de eventos por cada una de sus (hasta 2000) filas.
 */
describe('ingresarPosiciones (offline_sync)', () => {
  const lote = {
    source: 'offline_sync' as const,
    posiciones: [
      { lat: -31.43, lng: -64.19, precision: 8, timestamp: new Date('2026-08-31T12:00:10.000Z') },
      { lat: -31.41, lng: -64.17, precision: 8, timestamp: new Date('2026-08-31T12:00:00.000Z') },
      { lat: -31.42, lng: -64.18, precision: 8, timestamp: new Date('2026-08-31T12:00:05.000Z') },
    ],
  }

  it('ordena por timestamp: publica la más nueva del lote y el motor recibe solo esa', async () => {
    const m = armarPrisma('bici')
    const service = new ViajesService(m.prisma)

    const out = await service.ingresarPosiciones(usuarioId, viajeId, lote)

    expect(out).toEqual({ insertados: 3, compartida: true })
    expect(m.registroGpsCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    )
    expect(m.ubicacionVivaUpsert).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert.mock.calls[0]![0]).toMatchObject({
      update: expect.objectContaining({ lat: -31.43, lng: -64.19 }),
    })
    expect(emit).toHaveBeenCalledWith(
      'viaje:ubicacion',
      expect.objectContaining({
        lat: -31.43,
        source: 'offline_sync',
        recordedAt: '2026-08-31T12:00:10.000Z',
      })
    )
    expect(procesarPing).toHaveBeenCalledTimes(1)
    expect(procesarPing).toHaveBeenCalledWith(
      expect.objectContaining({ lat: -31.43, timestamp: new Date('2026-08-31T12:00:10.000Z') })
    )
  })

  it('no pisa la posición viva con un lote más viejo que lo ya conocido', async () => {
    const m = armarPrisma('bici')
    m.registroGpsFindFirst.mockResolvedValue({ timestamp: new Date('2026-08-31T12:01:00.000Z') })
    const service = new ViajesService(m.prisma)

    await service.ingresarPosiciones(usuarioId, viajeId, lote)

    // El historial se guarda igual (cero pérdida), pero el mapa no retrocede.
    expect(m.registroGpsCreateMany).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
    expect(procesarPing).not.toHaveBeenCalled()
  })

  it('aplica el filtro de precisión de la modalidad también al lote', async () => {
    const m = armarPrisma('trekking', snapshotPrevio) // precisionMaxM trekking = 30
    const service = new ViajesService(m.prisma)

    await service.ingresarPosiciones(usuarioId, viajeId, {
      source: 'offline_sync',
      posiciones: [
        { lat: -31.43, lng: -64.19, precision: 90, timestamp: new Date('2026-08-31T12:00:10.000Z') },
      ],
    })

    expect(m.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })
})

/**
 * RN-110/111: con el compartir apagado —o sin consentimiento de geolocalización
 * todavía otorgado— el punto se sigue guardando en `registro_gps` (RN-038: cero
 * pérdida, es historial propio y alimenta las métricas personales), pero no se
 * publica al grupo ni se evalúa en el motor de eventos, que generaría alertas
 * con la ubicación exacta de alguien que eligió no mostrarla (RN-043).
 */
describe('compartir ubicación apagado (RN-111)', () => {
  const ping = {
    viajeId,
    lat: -31.42,
    lng: -64.18,
    accuracy: 10,
    recordedAt: '2026-08-31T12:00:00.000Z',
    source: 'live' as const,
  }

  it('registrarPingUbicacion: persiste el punto pero no publica ni dispara el motor', async () => {
    const m = armarPrisma('bici', null, { comparte: false })

    await new ViajesService(m.prisma).registrarPingUbicacion(usuarioId, ping)

    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
    expect(procesarPing).not.toHaveBeenCalled()
  })

  it('upsertUbicacionViva: devuelve compartida=false sin publicar', async () => {
    const m = armarPrisma('bici', null, { comparte: false })

    const out = await new ViajesService(m.prisma).upsertUbicacionViva(usuarioId, viajeId, {
      lat: -31.42,
      lng: -64.18,
      precision: 10,
      recordedAt: new Date('2026-08-31T12:00:00.000Z'),
    })

    expect(out).toEqual({ compartida: false, ubicacion: null })
    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(procesarPing).not.toHaveBeenCalled()
  })

  it('ingresarPosiciones: guarda el lote offline completo pero no lo publica', async () => {
    const m = armarPrisma('bici', null, { comparte: false })

    const out = await new ViajesService(m.prisma).ingresarPosiciones(usuarioId, viajeId, {
      source: 'offline_sync',
      posiciones: [
        { lat: -31.43, lng: -64.19, precision: 8, timestamp: new Date('2026-08-31T12:00:10.000Z') },
      ],
    })

    expect(out).toEqual({ insertados: 1, compartida: false })
    expect(m.registroGpsCreateMany).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('sin consentimiento vigente no se publica, aunque el toggle del viaje esté en on', async () => {
    const m = armarPrisma('bici', null, { comparte: true, consentimiento: false })

    await new ViajesService(m.prisma).registrarPingUbicacion(usuarioId, ping)

    expect(m.registroGpsCreate).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaUpsert).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })
})
