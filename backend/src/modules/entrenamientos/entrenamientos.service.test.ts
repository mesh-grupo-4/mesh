import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma, PrismaClient } from '@prisma/client'
import { ViajesService } from '../viajes/viajes.service'
import { createViajeSchema } from '../viajes/viajes.schemas'
import { EntrenamientosService, type RepeticionPreparada } from './entrenamientos.service'

const usuarioId = '11111111-1111-1111-1111-111111111111'
const otroId = '22222222-2222-2222-2222-222222222222'
const origenId = '33333333-3333-3333-3333-333333333333'
const nuevoId = '44444444-4444-4444-4444-444444444444'
const circuitoId = '55555555-5555-5555-5555-555555555555'
const plantillaId = '66666666-6666-6666-6666-666666666666'

vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: vi.fn() }) }),
}))
vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => ({ procesarPing: vi.fn(), limpiarViaje: vi.fn(), limpiarIntegrante: vi.fn() }),
}))

const computeTrazaRecorrido = vi.fn()
const computeLineStringLengthMeters = vi.fn()
vi.mock('../../lib/postgis', () => ({
  computeTrazaRecorrido: (...a: unknown[]) => computeTrazaRecorrido(...a),
  computeLineStringLengthMeters: (...a: unknown[]) => computeLineStringLengthMeters(...a),
  computePerfilVelocidad: vi.fn(),
  computeSplitsPorKm: vi.fn(),
  computeMetricasGpsPorUsuario: vi.fn(),
  computeProgresoEnRutaM: vi.fn(),
}))

const rutaOrigen = {
  origen_lat: -31.42,
  origen_lng: -64.18,
  origen_nombre: 'Parque Sarmiento',
  destino_lat: -31.37,
  destino_lng: -64.24,
  destino_nombre: 'Kempes',
  linestring_geojson: { type: 'LineString', coordinates: [[-64.18, -31.42], [-64.24, -31.37]] },
  distancia_planeada_m: 8000,
  tiempo_estimado_seg: 2700,
  paradas_intermedias: [
    { orden: 0, lat: -31.4, lng: -64.2, nombre: 'Bebedero', categoria: 'descanso', id: 'x', ruta_id: 'y' },
  ],
}

function metricaOrigen(viaje: Record<string, unknown> = {}) {
  return {
    tiempo_movimiento_seg: 2558,
    viaje: {
      id: origenId,
      nombre: 'Vuelta al lago',
      estado: 'finalizado',
      modo: 'entrenamiento',
      tipo_actividad: 'running',
      ruta: rutaOrigen,
      ...viaje,
    },
  }
}

function armarPrisma(metrica: unknown) {
  return {
    metricaViaje: { findUnique: vi.fn().mockResolvedValue(metrica) },
  } as unknown as PrismaClient
}

beforeEach(() => {
  vi.clearAllMocks()
  computeLineStringLengthMeters.mockResolvedValue(8200)
})

describe('RN-066 — preparar la repetición de una sesión', () => {
  it('sin métricas propias en ese viaje no hay sesión que repetir', async () => {
    const service = new EntrenamientosService(armarPrisma(null))
    await expect(
      service.prepararRepeticion(usuarioId, { viajeId: origenId, recorrido: 'planificado' })
    ).rejects.toMatchObject({ status: 404, code: 'SESION_NOT_FOUND' })
  })

  it.each([
    ['no finalizó', { estado: 'en_curso' }],
    ['no es entrenamiento', { modo: 'recreativo' }],
    ['es motorizado (RN-070)', { tipo_actividad: 'moto' }],
  ])('rechaza una sesión que %s', async (_caso, viaje) => {
    const service = new EntrenamientosService(armarPrisma(metricaOrigen(viaje)))
    await expect(
      service.prepararRepeticion(usuarioId, { viajeId: origenId, recorrido: 'real' })
    ).rejects.toMatchObject({ status: 409, code: 'SESION_NO_REPETIBLE' })
  })

  it('"planificado" copia la ruta y las paradas de la sesión', async () => {
    const service = new EntrenamientosService(armarPrisma(metricaOrigen()))
    const prep = await service.prepararRepeticion(usuarioId, { viajeId: origenId, recorrido: 'planificado' })

    expect(prep.origen).toEqual({ id: origenId, nombre: 'Vuelta al lago', tipo_actividad: 'running' })
    expect(prep.ruta).toMatchObject({
      origen_nombre: 'Parque Sarmiento',
      destino_nombre: 'Kempes',
      distancia_planeada_m: 8000,
      tiempo_estimado_seg: 2700,
      paradas: [{ orden: 0, lat: -31.4, lng: -64.2, nombre: 'Bebedero', categoria: 'descanso' }],
    })
    expect(computeTrazaRecorrido).not.toHaveBeenCalled()
  })

  it('"planificado" sin ruta en la sesión responde SIN_RECORRIDO', async () => {
    const service = new EntrenamientosService(armarPrisma(metricaOrigen({ ruta: null })))
    await expect(
      service.prepararRepeticion(usuarioId, { viajeId: origenId, recorrido: 'planificado' })
    ).rejects.toMatchObject({ status: 409, code: 'SIN_RECORRIDO' })
  })

  it('"real" arma la ruta con mi traza GPS, en orden [lng, lat]', async () => {
    // Dos tramos (hubo un corte de señal): se unen en un solo recorrido.
    computeTrazaRecorrido.mockResolvedValue([
      [[-31.42, -64.18], [-31.41, -64.19]],
      [[-31.4, -64.2], [-31.39, -64.21]],
    ])
    const prisma = armarPrisma(metricaOrigen({ ruta: null }))
    const prep = await new EntrenamientosService(prisma).prepararRepeticion(usuarioId, {
      viajeId: origenId,
      recorrido: 'real',
    })

    expect(computeTrazaRecorrido).toHaveBeenCalledWith(prisma, origenId, usuarioId)
    expect(prep.ruta).toMatchObject({
      origen_lat: -31.42,
      origen_lng: -64.18,
      destino_lat: -31.39,
      destino_lng: -64.21,
      distancia_planeada_m: 8200,
      // El tiempo estimado es lo que tardé en movimiento esa vez.
      tiempo_estimado_seg: 2558,
      paradas: [],
    })
    expect(prep.ruta.linestring_geojson).toEqual({
      type: 'LineString',
      coordinates: [[-64.18, -31.42], [-64.19, -31.41], [-64.2, -31.4], [-64.21, -31.39]],
    })
  })

  it('"real" sin traza GPS responde SIN_RECORRIDO', async () => {
    computeTrazaRecorrido.mockResolvedValue([])
    const service = new EntrenamientosService(armarPrisma(metricaOrigen()))
    await expect(
      service.prepararRepeticion(usuarioId, { viajeId: origenId, recorrido: 'real' })
    ).rejects.toMatchObject({ status: 409, code: 'SIN_RECORRIDO' })
  })
})

describe('RN-066 — circuitos al crear', () => {
  const prep: RepeticionPreparada = {
    origen: { id: origenId, nombre: 'Vuelta al lago', tipo_actividad: 'running' },
    ruta: {
      origen_lat: 1,
      origen_lng: 2,
      origen_nombre: null,
      destino_lat: 3,
      destino_lng: 4,
      destino_nombre: null,
      linestring_geojson: { type: 'LineString', coordinates: [[2, 1], [4, 3]] },
      distancia_planeada_m: 100,
      tiempo_estimado_seg: null,
      paradas: [{ orden: 0, lat: 1, lng: 2, nombre: null, categoria: 'otro' }],
    },
  }

  function armarTx(sesionExistente: unknown) {
    const tx = {
      ruta: { create: vi.fn().mockResolvedValue({ id: 'ruta-1' }) },
      paradaIntermedia: { createMany: vi.fn() },
      circuitoSesion: {
        findUnique: vi.fn().mockResolvedValue(sesionExistente),
        create: vi.fn(),
      },
      circuitoEntrenamiento: {
        create: vi.fn().mockResolvedValue({ id: circuitoId }),
        upsert: vi.fn().mockResolvedValue({ id: circuitoId }),
      },
      rutaPlantilla: {
        findUnique: vi.fn().mockResolvedValue({ nombre: 'Subida al Cerro', tipo_actividad: 'trekking' }),
      },
    }
    return { tx, txClient: tx as unknown as Prisma.TransactionClient }
  }

  it('la primera repetición crea el circuito con la sesión original y la nueva', async () => {
    const { tx, txClient } = armarTx(null)
    await new EntrenamientosService({} as PrismaClient).aplicarRepeticion(txClient, usuarioId, nuevoId, prep)

    expect(tx.ruta.create.mock.calls[0]![0].data).toMatchObject({ viaje_id: nuevoId, origen_lat: 1 })
    expect(tx.paradaIntermedia.createMany).toHaveBeenCalledWith({
      data: [{ ruta_id: 'ruta-1', orden: 0, lat: 1, lng: 2, nombre: null, categoria: 'otro' }],
    })
    expect(tx.circuitoEntrenamiento.create.mock.calls[0]![0].data).toMatchObject({
      usuario_id: usuarioId,
      nombre: 'Vuelta al lago',
      tipo_actividad: 'running',
      sesiones: { create: { usuario_id: usuarioId, viaje_id: origenId } },
    })
    expect(tx.circuitoSesion.create).toHaveBeenCalledWith({
      data: { usuario_id: usuarioId, viaje_id: nuevoId, circuito_id: circuitoId },
    })
  })

  it('si la sesión ya estaba en un circuito mío, la nueva se suma a ese', async () => {
    const { tx, txClient } = armarTx({ circuito_id: circuitoId })
    await new EntrenamientosService({} as PrismaClient).aplicarRepeticion(txClient, usuarioId, nuevoId, prep)

    expect(tx.circuitoEntrenamiento.create).not.toHaveBeenCalled()
    expect(tx.circuitoSesion.create).toHaveBeenCalledWith({
      data: { usuario_id: usuarioId, viaje_id: nuevoId, circuito_id: circuitoId },
    })
  })

  it('los entrenamientos de una misma ruta guardada comparten circuito', async () => {
    const { tx, txClient } = armarTx(null)
    await new EntrenamientosService({} as PrismaClient).sumarAlCircuitoDePlantilla(
      txClient,
      usuarioId,
      nuevoId,
      plantillaId
    )

    expect(tx.circuitoEntrenamiento.upsert.mock.calls[0]![0]).toMatchObject({
      where: { usuario_id_ruta_plantilla_id: { usuario_id: usuarioId, ruta_plantilla_id: plantillaId } },
      create: { nombre: 'Subida al Cerro', tipo_actividad: 'trekking', ruta_plantilla_id: plantillaId },
      update: {},
    })
    expect(tx.circuitoSesion.create).toHaveBeenCalledWith({
      data: { usuario_id: usuarioId, viaje_id: nuevoId, circuito_id: circuitoId },
    })
  })
})

describe('RN-066 — leer y editar circuitos', () => {
  const sesion = (id: string, fecha: string, distancia: number, seg: number) => ({
    viaje: {
      id,
      nombre: 'Vuelta al lago',
      fecha_fin_real: new Date(fecha),
      metricas: [{ distancia_m: distancia, tiempo_movimiento_seg: seg }],
    },
  })

  it('arma la evolución en orden cronológico y oculta los circuitos sin sesiones', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: circuitoId,
        nombre: 'Vuelta al lago',
        tipo_actividad: 'running',
        ruta_plantilla_id: null,
        sesiones: [
          sesion(nuevoId, '2026-11-10T11:00:00.000Z', 8000, 2400), // 5:00 min/km
          sesion(origenId, '2026-11-05T11:00:00.000Z', 10000, 3600), // 6:00 min/km
        ],
      },
      { id: 'vacio', nombre: 'Sin correr', tipo_actividad: 'running', ruta_plantilla_id: plantillaId, sesiones: [] },
    ])
    const prisma = { circuitoEntrenamiento: { findMany } } as unknown as PrismaClient
    const circuitos = await new EntrenamientosService(prisma).listarCircuitos(usuarioId, {})

    expect(circuitos).toHaveLength(1)
    expect(circuitos[0]).toMatchObject({
      id: circuitoId,
      total_sesiones: 2,
      mejor_pace_min_km: 5,
      mejor_distancia_m: 10000,
      ultima_sesion_viaje_id: nuevoId,
    })
    expect(circuitos[0]!.evolucion.map((s) => s.viaje_id)).toEqual([origenId, nuevoId])
    // Solo mis circuitos y nunca los motorizados (RN-070).
    expect(findMany.mock.calls[0]![0].where).toEqual({
      usuario_id: usuarioId,
      tipo_actividad: { notIn: ['moto', 'auto'] },
    })
  })

  function armarEdicion(opts: { dueno?: string; borradas?: number; quedan?: number } = {}) {
    const tx = {
      circuitoSesion: {
        deleteMany: vi.fn().mockResolvedValue({ count: opts.borradas ?? 1 }),
        count: vi.fn().mockResolvedValue(opts.quedan ?? 1),
      },
      circuitoEntrenamiento: { delete: vi.fn() },
    }
    const update = vi.fn().mockResolvedValue({ id: circuitoId, nombre: 'Nuevo', tipo_actividad: 'running' })
    const prisma = {
      circuitoEntrenamiento: {
        findUnique: vi.fn().mockResolvedValue({ id: circuitoId, usuario_id: opts.dueno ?? usuarioId }),
        update,
      },
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaClient
    return { prisma, tx, update }
  }

  it('un circuito ajeno responde como si no existiera', async () => {
    const m = armarEdicion({ dueno: otroId })
    const service = new EntrenamientosService(m.prisma)
    await expect(service.renombrarCircuito(usuarioId, circuitoId, 'Nuevo')).rejects.toMatchObject({
      status: 404,
      code: 'CIRCUITO_NOT_FOUND',
    })
    await expect(service.sacarSesion(usuarioId, circuitoId, origenId)).rejects.toMatchObject({
      status: 404,
      code: 'CIRCUITO_NOT_FOUND',
    })
    expect(m.update).not.toHaveBeenCalled()
  })

  it('renombra un circuito propio', async () => {
    const m = armarEdicion()
    await new EntrenamientosService(m.prisma).renombrarCircuito(usuarioId, circuitoId, 'Nuevo')
    expect(m.update.mock.calls[0]![0]).toMatchObject({ where: { id: circuitoId }, data: { nombre: 'Nuevo' } })
  })

  it('sacar una sesión deja el circuito si todavía tiene otras', async () => {
    const m = armarEdicion({ quedan: 2 })
    await new EntrenamientosService(m.prisma).sacarSesion(usuarioId, circuitoId, origenId)
    expect(m.tx.circuitoSesion.deleteMany).toHaveBeenCalledWith({
      where: { usuario_id: usuarioId, viaje_id: origenId, circuito_id: circuitoId },
    })
    expect(m.tx.circuitoEntrenamiento.delete).not.toHaveBeenCalled()
  })

  it('sacar la última sesión elimina el circuito', async () => {
    const m = armarEdicion({ quedan: 0 })
    await new EntrenamientosService(m.prisma).sacarSesion(usuarioId, circuitoId, origenId)
    expect(m.tx.circuitoEntrenamiento.delete).toHaveBeenCalledWith({ where: { id: circuitoId } })
  })

  it('sacar una sesión que no está en el circuito responde 404', async () => {
    const m = armarEdicion({ borradas: 0 })
    await expect(
      new EntrenamientosService(m.prisma).sacarSesion(usuarioId, circuitoId, origenId)
    ).rejects.toMatchObject({ status: 404, code: 'SESION_NOT_FOUND' })
  })
})

describe('RN-065 / RN-066 — crear viaje', () => {
  const futura = new Date(Date.now() + 86_400_000)

  function armarCrear(metrica: unknown = null) {
    const viajeCreate = vi.fn().mockResolvedValue({ id: nuevoId })
    const tx = {
      viaje: { create: viajeCreate },
      viajeIntegrante: { create: vi.fn(), createMany: vi.fn() },
      viajeGrupo: { createMany: vi.fn() },
      ruta: { create: vi.fn().mockResolvedValue({ id: 'ruta-1' }) },
      paradaIntermedia: { createMany: vi.fn() },
      circuitoSesion: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      circuitoEntrenamiento: { create: vi.fn().mockResolvedValue({ id: circuitoId }) },
    }
    const prisma = {
      usuario: { findUnique: vi.fn().mockResolvedValue({ id: usuarioId }) },
      grupoMiembro: { findMany: vi.fn().mockResolvedValue([]) },
      amistad: { findMany: vi.fn().mockResolvedValue([]) },
      metricaViaje: { findUnique: vi.fn().mockResolvedValue(metrica) },
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaClient
    return { prisma, tx, viajeCreate }
  }

  const base = { nombre: 'Salida', esGrupal: false, grupoIds: [], amigoIds: [], inmediato: false }

  it.each(['moto', 'auto'] as const)('RN-070: no hay entrenamiento en %s', async (tipo) => {
    const m = armarCrear()
    await expect(
      new ViajesService(m.prisma).crearViaje(usuarioId, {
        ...base,
        tipoActividad: tipo,
        modo: 'entrenamiento',
        fechaProgramada: futura,
      })
    ).rejects.toMatchObject({ status: 400, code: 'MODO_INVALIDO' })
    expect(m.viajeCreate).not.toHaveBeenCalled()
  })

  it('repetir fuerza entrenamiento, toma la actividad de la sesión y guarda de dónde sale', async () => {
    const m = armarCrear(metricaOrigen())
    const viaje = await new ViajesService(m.prisma).crearViaje(usuarioId, {
      ...base,
      // El cliente puede mandar cualquier cosa: manda la sesión.
      tipoActividad: 'bici',
      modo: 'recreativo',
      fechaProgramada: futura,
      repetir: { viajeId: origenId, recorrido: 'planificado' },
    })

    expect(m.viajeCreate.mock.calls[0]![0].data).toMatchObject({
      modo: 'entrenamiento',
      tipo_actividad: 'running',
      repite_viaje_id: origenId,
    })
    expect(m.tx.ruta.create).toHaveBeenCalled()
    expect(m.tx.circuitoSesion.create).toHaveBeenCalledWith({
      data: { usuario_id: usuarioId, viaje_id: nuevoId, circuito_id: circuitoId },
    })
    expect(viaje.ruta_precargada).toBe(true)
  })

  it('un viaje común no guarda repetición', async () => {
    const m = armarCrear()
    await new ViajesService(m.prisma).crearViaje(usuarioId, {
      ...base,
      tipoActividad: 'running',
      modo: 'entrenamiento',
      fechaProgramada: futura,
    })
    expect(m.viajeCreate.mock.calls[0]![0].data).toMatchObject({ modo: 'entrenamiento', repite_viaje_id: null })
    expect(m.tx.circuitoSesion.create).not.toHaveBeenCalled()
  })

  it('repetir no se combina con una ruta guardada', () => {
    const r = createViajeSchema.safeParse({
      nombre: 'x',
      esGrupal: false,
      tipoActividad: 'running',
      inmediato: true,
      rutaPlantillaId: plantillaId,
      repetir: { viajeId: origenId, recorrido: 'real' },
    })
    expect(r.success).toBe(false)
  })
})
