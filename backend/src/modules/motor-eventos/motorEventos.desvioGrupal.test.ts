import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ESPERA_RECALCULO_AUTOMATICO_MS, MotorEventosService } from './motorEventos.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const liderId = '22222222-2222-2222-2222-222222222222'
const anaId = '33333333-3333-3333-3333-333333333333'
const alertaId = '66666666-6666-6666-6666-666666666666'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

const computeDistanciaPuntoARutaM = vi.fn()
const computeProgresoEnRutaM = vi.fn()
vi.mock('../../lib/postgis', () => ({
  computeDistanciaPuntoARutaM: (...args: unknown[]) => computeDistanciaPuntoARutaM(...args),
  computeProgresoEnRutaM: (...args: unknown[]) => computeProgresoEnRutaM(...args),
}))

const sendExpoPush = vi.fn()
vi.mock('../../lib/expoPush', () => ({
  sendExpoPush: (...args: unknown[]) => sendExpoPush(...args),
}))

const recalcularRutaDesde = vi.fn()
vi.mock('./recalculoRuta', () => ({
  recalcularRutaDesde: (...args: unknown[]) => recalcularRutaDesde(...args),
}))

const linestring = {
  type: 'LineString' as const,
  coordinates: [
    [-64.19, -31.42],
    [-64.18, -31.41],
  ],
}

const rutaNueva = {
  linestring: {
    type: 'LineString' as const,
    coordinates: [
      [-64.19, -31.42],
      [-64.2, -31.43],
    ],
  },
  distancia_planeada_m: 1500,
  tiempo_estimado_seg: 600,
  paradas_pendientes: 0,
}

/** Posiciones de prueba: el líder fuera de la ruta y alguien a ~30 m o a ~1 km de él. */
const LIDER_FUERA = { lat: -31.43, lng: -64.2 }
const CERCA_DEL_LIDER = { lat: -31.4302, lng: -64.2002 }
const LEJOS_DEL_LIDER = { lat: -31.44, lng: -64.21 }
const EN_RUTA = { lat: -31.42, lng: -64.19 }

function armarPrisma() {
  const alertaFindMany = vi.fn().mockResolvedValue([])
  const alertaFindFirst = vi.fn().mockResolvedValue(null)
  const alertaUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
  const alertaCreate = vi.fn().mockResolvedValue({
    id: alertaId,
    viaje_id: viajeId,
    creada_por_id: null,
    tipo: 'desvio',
    origen: 'sistema',
    mensaje: `[afectado:${anaId}] Ana se desvió ~200 m de la ruta`,
    lat: LEJOS_DEL_LIDER.lat,
    lng: LEJOS_DEL_LIDER.lng,
    estado: 'activa',
    created_at: new Date('2026-11-12T14:00:00.000Z'),
  })
  const prisma = {
    viaje: {
      findUnique: vi.fn().mockResolvedValue({
        id: viajeId,
        estado: 'en_curso',
        es_grupal: true,
        tipo_actividad: 'moto',
        modo: 'recreativo',
        distancia_max_separacion: 80,
        velocidad_esperada: 60,
        creador_id: liderId,
        alerta_incidente_habilitada: false,
        alerta_incidente_minutos: null,
        creador: { push_token: 'ExponentPushToken[lider]' },
      }),
    },
    parada: { findFirst: vi.fn().mockResolvedValue(null) },
    ruta: { findUnique: vi.fn().mockResolvedValue({ linestring_geojson: linestring }) },
    usuario: { findUnique: vi.fn().mockResolvedValue({ nombre: 'Ana', apellido: null }) },
    alerta: {
      findFirst: alertaFindFirst,
      findMany: alertaFindMany,
      updateMany: alertaUpdateMany,
      create: alertaCreate,
    },
    viajeIntegrante: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ usuario: { id: anaId, push_token: 'ExponentPushToken[ana]' } }]),
    },
  } as unknown as PrismaClient
  return { prisma, alertaFindMany, alertaUpdateMany, alertaCreate }
}

function ping(quien: string, pos: { lat: number; lng: number }) {
  return { viajeId, usuarioId: quien, lat: pos.lat, lng: pos.lng, timestamp: new Date() }
}

/** Distancia a la ruta según la posición: solo `EN_RUTA` está sobre el trazado. */
function distanciaSegunPosicion() {
  computeDistanciaPuntoARutaM.mockImplementation(async (_p: unknown, lat: number) =>
    lat === EN_RUTA.lat ? 10 : 400
  )
}

/** Arma a ambos (RN-029b) con un primer ping sobre la ruta. */
async function armarIntegrantes(motor: MotorEventosService) {
  await motor.procesarPing(ping(liderId, EN_RUTA))
  await motor.procesarPing(ping(anaId, EN_RUTA))
}

function eventosEmitidos(nombre: string): unknown[] {
  return emit.mock.calls.filter((c) => c[0] === nombre).map((c) => c[1])
}

/** El push se dispara sin await: deja correr la cola de microtareas. */
async function esperarPush() {
  await new Promise((r) => setImmediate(r))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-12T14:00:00.000Z'))
  distanciaSegunPosicion()
  computeProgresoEnRutaM.mockResolvedValue(100)
  recalcularRutaDesde.mockResolvedValue(rutaNueva)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('MotorEventosService — desvío del grupo (RN-034b)', () => {
  it('si el líder sale de la ruta no crea alerta: le pregunta y emite el desvío pendiente', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)

    await motor.procesarPing(ping(liderId, LIDER_FUERA))
    await esperarPush()

    expect(m.alertaCreate).not.toHaveBeenCalled()
    expect(eventosEmitidos('viaje:desvio_grupal')).toEqual([
      expect.objectContaining({ viajeId, estado: 'pendiente' }),
    ])
    expect(motor.estadoDesvioGrupal(viajeId).estado).toBe('pendiente')
    // Push solo al líder: es quien decide.
    expect(sendExpoPush).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[lider]', title: '¿Recalculamos la ruta?' }),
    ])
  })

  it('quien va con el líder no genera desvío individual y se le cierra el que tenía', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))

    m.alertaFindMany.mockResolvedValueOnce([{ id: alertaId, tipo: 'desvio' }])
    await motor.procesarPing(ping(anaId, CERCA_DEL_LIDER))

    expect(m.alertaCreate).not.toHaveBeenCalled()
    expect(m.alertaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [alertaId] }, estado: 'activa' } })
    )
  })

  it('quien se aleja del líder sí genera su desvío individual', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))

    await motor.procesarPing(ping(anaId, LEJOS_DEL_LIDER))

    expect(m.alertaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'desvio' }) })
    )
  })

  it('si el líder vuelve a la ruta, el desvío grupal se descarta', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))

    await motor.procesarPing(ping(liderId, EN_RUTA))

    expect(motor.estadoDesvioGrupal(viajeId).estado).toBe('ninguno')
    expect(eventosEmitidos('viaje:desvio_grupal').at(-1)).toEqual(
      expect.objectContaining({ estado: 'ninguno' })
    )
    expect(recalcularRutaDesde).not.toHaveBeenCalled()
  })

  it('sin respuesta del líder, a los 2 minutos recalcula sola desde su posición', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))

    vi.setSystemTime(Date.now() + ESPERA_RECALCULO_AUTOMATICO_MS - 1000)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))
    expect(recalcularRutaDesde).not.toHaveBeenCalled()

    m.alertaFindMany.mockResolvedValue([{ id: alertaId }])
    vi.setSystemTime(Date.now() + 2000)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))
    await esperarPush()

    expect(recalcularRutaDesde).toHaveBeenCalledWith(m.prisma, expect.anything(), viajeId, LIDER_FUERA)
    expect(eventosEmitidos('viaje:ruta_actualizada')).toEqual([
      expect.objectContaining({ viajeId, motivo: 'automatico', linestring: rutaNueva.linestring }),
    ])
    expect(motor.estadoDesvioGrupal(viajeId).estado).toBe('ninguno')
    // Desvíos y atrasos medidos contra la ruta vieja quedan cerrados.
    expect(m.alertaUpdateMany).toHaveBeenCalled()
    // Automático: avisa a todo el grupo, líder incluido.
    const destinos = sendExpoPush.mock.calls.at(-1)![0].map((p: { to: string }) => p.to)
    expect(destinos).toEqual(
      expect.arrayContaining(['ExponentPushToken[lider]', 'ExponentPushToken[ana]'])
    )
  })

  it('si el líder dice "volvemos", no recalcula aunque pasen los 2 minutos', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))

    expect(motor.rechazarDesvioGrupal(viajeId).estado).toBe('rechazado')
    vi.setSystemTime(Date.now() + ESPERA_RECALCULO_AUTOMATICO_MS * 2)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))

    expect(recalcularRutaDesde).not.toHaveBeenCalled()
    // Quien va con él sigue sin desvío individual.
    await motor.procesarPing(ping(anaId, CERCA_DEL_LIDER))
    expect(m.alertaCreate).not.toHaveBeenCalled()
  })

  it('el líder confirma: recalcula al instante y avisa al grupo sin pushearse a sí mismo', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))
    sendExpoPush.mockClear()

    const ruta = await motor.confirmarDesvioGrupal(viajeId)
    await esperarPush()

    expect(ruta).toEqual(rutaNueva)
    expect(eventosEmitidos('viaje:ruta_actualizada')).toEqual([
      expect.objectContaining({ motivo: 'lider' }),
    ])
    const destinos = sendExpoPush.mock.calls.at(-1)![0].map((p: { to: string }) => p.to)
    expect(destinos).toEqual(['ExponentPushToken[ana]'])
  })

  it('confirmar o rechazar sin desvío del grupo responde 409', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)

    await expect(motor.confirmarDesvioGrupal(viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'SIN_DESVIO_PENDIENTE',
    })
    expect(() => motor.rechazarDesvioGrupal(viajeId)).toThrow(
      expect.objectContaining({ code: 'SIN_DESVIO_PENDIENTE' })
    )
  })

  it('si el ruteo falla, el desvío vuelve a pendiente para reintentar', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))
    recalcularRutaDesde.mockRejectedValueOnce(new Error('sin ruteo'))

    await expect(motor.confirmarDesvioGrupal(viajeId)).rejects.toThrow('sin ruteo')

    expect(motor.estadoDesvioGrupal(viajeId).estado).toBe('pendiente')
    expect(eventosEmitidos('viaje:ruta_actualizada')).toEqual([])
  })

  it('no evalúa atrasos mientras el grupo está fuera de la ruta', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)
    await motor.procesarPing(ping(liderId, LIDER_FUERA))
    // Ana quedó muy atrás sobre la ruta vieja (progreso 0 vs 100 del líder).
    computeProgresoEnRutaM.mockResolvedValue(0)
    computeDistanciaPuntoARutaM.mockResolvedValue(10)

    await motor.procesarPing(ping(anaId, { lat: -31.4, lng: -64.1 }))

    expect(m.alertaCreate).not.toHaveBeenCalled()
  })
})

describe('MotorEventosService — desvío voluntario (RN-034b)', () => {
  it('cierra la alerta de desvío, avisa al líder y no insiste hasta que vuelva a la ruta', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)
    await armarIntegrantes(motor)

    m.alertaFindMany.mockResolvedValueOnce([{ id: alertaId }])
    await motor.marcarDesvioVoluntario(viajeId, anaId)
    await esperarPush()

    expect(m.alertaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [alertaId] }, estado: 'activa' } })
    )
    expect(sendExpoPush).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[lider]', title: 'Desvío a propósito' }),
    ])

    // Sigue fuera de la ruta: no se genera otro desvío.
    await motor.procesarPing(ping(anaId, LEJOS_DEL_LIDER))
    expect(m.alertaCreate).not.toHaveBeenCalled()

    // Vuelve a la ruta y se vuelve a desviar: ahora sí.
    await motor.procesarPing(ping(anaId, EN_RUTA))
    await motor.procesarPing(ping(anaId, LEJOS_DEL_LIDER))
    expect(m.alertaCreate).toHaveBeenCalledTimes(1)
  })

  it('sin desvío abierto responde 409', async () => {
    const m = armarPrisma()
    const motor = new MotorEventosService(m.prisma)

    await expect(motor.marcarDesvioVoluntario(viajeId, anaId)).rejects.toMatchObject({
      status: 409,
      code: 'SIN_DESVIO_ACTIVO',
    })
  })
})
