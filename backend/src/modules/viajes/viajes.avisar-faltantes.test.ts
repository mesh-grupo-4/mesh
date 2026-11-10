import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ESPERA_AVISO_FALTANTES_MS, ViajesService } from './viajes.service'

const liderId = '33333333-3333-3333-3333-333333333333'
const otroId = '22222222-2222-2222-2222-222222222222'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => ({
    procesarPing: vi.fn(),
    limpiarViaje: vi.fn(),
    limpiarIntegrante: vi.fn(),
  }),
}))

const sendExpoPush = vi.fn()
vi.mock('../../lib/expoPush', () => ({
  sendExpoPush: (...args: unknown[]) => sendExpoPush(...args),
}))

type Mensaje = { to: string; title: string; body: string; gravedad: string; data: unknown }

/** La espera es por viaje y vive en memoria: cada test usa un viaje distinto. */
let secuencia = 0
function nuevoViajeId(): string {
  secuencia += 1
  return `11111111-1111-1111-1111-${String(secuencia).padStart(12, '0')}`
}

function armarPrisma(
  estado: 'planificado' | 'en_curso' | 'finalizado',
  tokens: (string | null)[] = ['ExponentPushToken[ana]', 'ExponentPushToken[beto]', null]
) {
  const findMany = vi
    .fn()
    .mockResolvedValue(tokens.map((push_token) => ({ usuario: { push_token } })))
  const prisma = {
    viaje: {
      findUnique: vi.fn().mockResolvedValue({
        estado,
        nombre: 'Sierras',
        creador_id: liderId,
        creador: { nombre: 'Gonzalo', apellido: 'Ferraro' },
      }),
    },
    viajeIntegrante: { findMany },
  } as unknown as PrismaClient
  return { prisma, findMany }
}

describe('ViajesService.avisarFaltantes (RN-029e)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T14:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('antes de iniciar avisa "estamos por salir" a los confirmados', async () => {
    const viajeId = nuevoViajeId()
    const m = armarPrisma('planificado')
    const service = new ViajesService(m.prisma)

    const out = await service.avisarFaltantes(liderId, viajeId)

    expect(out).toEqual({ viaje_id: viajeId, faltantes: 3, avisados: 2, espera_seg: 120 })
    const mensajes = sendExpoPush.mock.calls[0]?.[0] as Mensaje[]
    expect(mensajes.map((x) => x.to)).toEqual(['ExponentPushToken[ana]', 'ExponentPushToken[beto]'])
    expect(mensajes[0]).toMatchObject({
      title: 'Estamos por salir',
      body: 'Gonzalo Ferraro avisa que "Sierras" está por arrancar.',
      gravedad: 'importante',
      data: { viajeId, tipo: 'aviso_salida' },
    })
  })

  it('solo busca confirmados sin check-in y nunca al líder', async () => {
    const viajeId = nuevoViajeId()
    const m = armarPrisma('en_curso')
    const service = new ViajesService(m.prisma)

    await service.avisarFaltantes(liderId, viajeId)

    expect(m.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          viaje_id: viajeId,
          estado: 'confirmado',
          check_in_at: null,
          usuario_id: { not: liderId },
        },
      })
    )
    const mensajes = sendExpoPush.mock.calls[0]?.[0] as Mensaje[]
    expect(mensajes[0]).toMatchObject({
      title: 'Ya arrancamos',
      body: '"Sierras" ya está en curso. Tocá "Me sumo" para unirte.',
    })
  })

  it('no manda la ubicación de nadie en la push', async () => {
    const m = armarPrisma('en_curso')
    const service = new ViajesService(m.prisma)

    await service.avisarFaltantes(liderId, nuevoViajeId())

    const mensajes = sendExpoPush.mock.calls[0]?.[0] as Mensaje[]
    expect(JSON.stringify(mensajes)).not.toMatch(/lat|lng/)
  })

  it('rechaza a quien no es el líder (RN-030)', async () => {
    const m = armarPrisma('planificado')
    const service = new ViajesService(m.prisma)

    await expect(service.avisarFaltantes(otroId, nuevoViajeId())).rejects.toMatchObject({
      status: 403,
      code: 'NOT_CREATOR',
    })
    expect(sendExpoPush).not.toHaveBeenCalled()
  })

  it('rechaza si el viaje ya finalizó', async () => {
    const m = armarPrisma('finalizado')
    const service = new ViajesService(m.prisma)

    await expect(service.avisarFaltantes(liderId, nuevoViajeId())).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE',
    })
  })

  it('frena un segundo aviso dentro de la espera y lo permite después', async () => {
    const viajeId = nuevoViajeId()
    const m = armarPrisma('planificado')
    const service = new ViajesService(m.prisma)

    await service.avisarFaltantes(liderId, viajeId)
    vi.setSystemTime(Date.now() + 35_000)

    await expect(service.avisarFaltantes(liderId, viajeId)).rejects.toMatchObject({
      status: 429,
      code: 'AVISO_RECIENTE',
      datos: { reintentar_en_seg: 85 },
    })
    expect(sendExpoPush).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + ESPERA_AVISO_FALTANTES_MS)
    await service.avisarFaltantes(liderId, viajeId)
    expect(sendExpoPush).toHaveBeenCalledTimes(2)
  })

  it('sin nadie a quien avisar no consume la espera', async () => {
    const viajeId = nuevoViajeId()
    const m = armarPrisma('planificado', [])
    const service = new ViajesService(m.prisma)

    const out = await service.avisarFaltantes(liderId, viajeId)
    expect(out).toMatchObject({ faltantes: 0, avisados: 0 })
    expect(sendExpoPush).not.toHaveBeenCalled()

    await expect(service.avisarFaltantes(liderId, viajeId)).resolves.toMatchObject({ faltantes: 0 })
  })
})

describe('ViajesService.iniciar — aviso automático a los que faltan (RN-029e)', () => {
  it('al iniciar manda la push a los confirmados que no están', async () => {
    const viajeId = nuevoViajeId()
    const actualizado = {
      id: viajeId,
      creador_id: liderId,
      estado: 'en_curso',
      nombre: 'Sierras',
      fecha_inicio_real: new Date('2026-11-10T14:00:00.000Z'),
    }
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      viaje: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(actualizado),
      },
      viajeIntegrante: { upsert: vi.fn().mockResolvedValue({}) },
    }
    const prisma = {
      viaje: {
        findUnique: vi.fn().mockResolvedValue({ ...actualizado, estado: 'planificado' }),
      },
      viajeIntegrante: {
        findMany: vi.fn().mockResolvedValue([{ usuario: { push_token: 'ExponentPushToken[ana]' } }]),
      },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    } as unknown as PrismaClient
    sendExpoPush.mockClear()

    await new ViajesService(prisma).iniciar(liderId, viajeId)

    await vi.waitFor(() => expect(sendExpoPush).toHaveBeenCalledTimes(1))
    const mensajes = sendExpoPush.mock.calls[0]?.[0] as Mensaje[]
    expect(mensajes[0]).toMatchObject({
      to: 'ExponentPushToken[ana]',
      title: 'El viaje arrancó',
      body: '"Sierras" ya está en curso. Tocá "Me sumo" para unirte.',
    })
  })
})
