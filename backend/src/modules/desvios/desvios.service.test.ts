import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { DesviosService } from './desvios.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const liderId = '22222222-2222-2222-2222-222222222222'
const anaId = '33333333-3333-3333-3333-333333333333'

const motor = {
  estadoDesvioGrupal: vi.fn().mockReturnValue({ estado: 'ninguno', desde: null, recalculo_automatico_en: null }),
  confirmarDesvioGrupal: vi.fn().mockResolvedValue({ paradas_pendientes: 0 }),
  rechazarDesvioGrupal: vi.fn().mockReturnValue({ estado: 'rechazado' }),
  marcarDesvioVoluntario: vi.fn().mockResolvedValue(undefined),
}
vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => motor,
}))

function armar({
  estado = 'en_curso',
  integrante = { estado: 'confirmado', check_in_at: new Date() } as {
    estado: string
    check_in_at: Date | null
  } | null,
} = {}) {
  return {
    viaje: { findUnique: vi.fn().mockResolvedValue({ creador_id: liderId, estado }) },
    viajeIntegrante: { findUnique: vi.fn().mockResolvedValue(integrante) },
  } as unknown as PrismaClient
}

beforeEach(() => vi.clearAllMocks())

describe('DesviosService — autorización (RN-034b, RN-030)', () => {
  it('solo el líder confirma el desvío del grupo', async () => {
    const service = new DesviosService(armar())

    await expect(service.confirmar(anaId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_LEADER',
    })
    expect(motor.confirmarDesvioGrupal).not.toHaveBeenCalled()

    await service.confirmar(liderId, viajeId)
    expect(motor.confirmarDesvioGrupal).toHaveBeenCalledWith(viajeId)
  })

  it('solo el líder rechaza el desvío del grupo', async () => {
    const service = new DesviosService(armar())

    await expect(service.rechazar(anaId, viajeId)).rejects.toMatchObject({ code: 'NOT_LEADER' })
    await expect(service.rechazar(liderId, viajeId)).resolves.toEqual({ estado: 'rechazado' })
  })

  it('con el viaje fuera de curso responde 409 INVALID_STATE', async () => {
    const service = new DesviosService(armar({ estado: 'finalizado' }))

    await expect(service.confirmar(liderId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE',
    })
  })

  it('el estado lo ve cualquier confirmado, aunque no se haya sumado todavía', async () => {
    const service = new DesviosService(armar({ integrante: { estado: 'confirmado', check_in_at: null } }))

    await expect(service.estado(anaId, viajeId)).resolves.toMatchObject({ estado: 'ninguno' })
  })

  it('quien no participa no ve el estado', async () => {
    const service = new DesviosService(armar({ integrante: null }))

    await expect(service.estado(anaId, viajeId)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('el desvío voluntario requiere haberse sumado (RN-029b)', async () => {
    const service = new DesviosService(armar({ integrante: { estado: 'confirmado', check_in_at: null } }))

    await expect(service.desvioVoluntario(anaId, viajeId)).rejects.toMatchObject({
      code: 'NOT_CHECKED_IN',
    })
    expect(motor.marcarDesvioVoluntario).not.toHaveBeenCalled()
  })

  it('un participante sumado puede avisar su desvío voluntario', async () => {
    const service = new DesviosService(armar())

    await service.desvioVoluntario(anaId, viajeId)

    expect(motor.marcarDesvioVoluntario).toHaveBeenCalledWith(viajeId, anaId)
  })
})
