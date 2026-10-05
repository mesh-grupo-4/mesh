import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const creadorId = '33333333-3333-3333-3333-333333333333'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

const limpiarViaje = vi.fn()
vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => ({
    procesarPing: vi.fn(),
    limpiarViaje,
    limpiarIntegrante: vi.fn(),
  }),
}))

vi.mock('../../lib/postgis', () => ({
  computeMetricasGpsPorUsuario: vi.fn().mockResolvedValue([]),
  computeLineStringLengthMeters: vi.fn(),
  computePerfilVelocidad: vi.fn(),
  computeTrazaRecorrido: vi.fn(),
}))

vi.mock('../../lib/expoPush', () => ({ sendExpoPush: vi.fn() }))

function armarPrisma(estado = 'en_curso') {
  const fechaFin = new Date('2026-08-21T16:00:00.000Z')
  const viaje = {
    id: viajeId,
    creador_id: creadorId,
    estado,
    nombre: 'Salida',
    fecha_inicio_real: new Date('2026-08-21T14:00:00.000Z'),
    fecha_fin_real: fechaFin,
    ruta: null,
  }
  const paradaUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
  const alertaFindMany = vi.fn().mockResolvedValue([{ id: 'a1' }, { id: 'a2' }])
  const alertaUpdateMany = vi.fn().mockResolvedValue({ count: 2 })
  const ubicacionDeleteMany = vi.fn().mockResolvedValue({ count: 3 })
  const tx = {
    metricaViaje: { deleteMany: vi.fn(), createMany: vi.fn() },
    parada: { count: vi.fn().mockResolvedValue(0) },
    resumenViaje: { upsert: vi.fn() },
  }
  const prisma = {
    viaje: {
      findUnique: vi.fn().mockResolvedValue(viaje),
      update: vi.fn().mockResolvedValue({ ...viaje, estado: 'finalizado' }),
    },
    viajeIntegrante: { findMany: vi.fn().mockResolvedValue([]) },
    parada: { updateMany: paradaUpdateMany },
    alerta: { findMany: alertaFindMany, updateMany: alertaUpdateMany },
    ubicacionViva: { deleteMany: ubicacionDeleteMany },
    $transaction: (fn: (t: typeof tx) => Promise<void>) => fn(tx),
  } as unknown as PrismaClient
  return { prisma, paradaUpdateMany, alertaFindMany, alertaUpdateMany, ubicacionDeleteMany }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ViajesService.finalizar — cierre de la situación en vivo', () => {
  it('cierra paradas abiertas, resuelve alertas, borra ubicaciones vivas y limpia el motor', async () => {
    const m = armarPrisma()
    const service = new ViajesService(m.prisma)

    const out = await service.finalizar(creadorId, viajeId)

    expect(out.estado).toBe('finalizado')
    expect(m.paradaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { viaje_id: viajeId, fin: null } })
    )
    expect(m.alertaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: { in: ['activa', 'pausada'] } }),
      })
    )
    expect(m.alertaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['a1', 'a2'] } },
        data: expect.objectContaining({ estado: 'resuelta' }),
      })
    )
    expect(m.ubicacionDeleteMany).toHaveBeenCalledWith({ where: { viaje_id: viajeId } })
    expect(limpiarViaje).toHaveBeenCalledWith(viajeId)

    const eventos = emit.mock.calls.map((c) => String(c[0]))
    expect(eventos[0]).toBe('viaje:finalizado')
    expect(eventos.filter((e) => e === 'viaje:alerta_actualizada')).toHaveLength(2)
  })

  it('solo el creador finaliza (RN-030)', async () => {
    const m = armarPrisma()
    const service = new ViajesService(m.prisma)

    await expect(service.finalizar('otro', viajeId)).rejects.toMatchObject({ code: 'NOT_CREATOR' })
    expect(m.ubicacionDeleteMany).not.toHaveBeenCalled()
  })
})
