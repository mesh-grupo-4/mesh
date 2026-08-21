import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { AlertasService } from './alertas.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const liderId = '22222222-2222-2222-2222-222222222222'
const integranteId = '33333333-3333-3333-3333-333333333333'
const alertaId = '44444444-4444-4444-4444-444444444444'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

const sendExpoPush = vi.fn()
vi.mock('../../lib/expoPush', () => ({
  sendExpoPush: (...args: unknown[]) => sendExpoPush(...args),
}))

const alertaCreada = {
  id: alertaId,
  viaje_id: viajeId,
  creada_por_id: liderId,
  tipo: 'combustible',
  origen: 'lider',
  mensaje: 'Cargamos en la YPF de Ruta 9',
  lat: -31.42,
  lng: -64.18,
  estado: 'activa',
  created_at: new Date('2026-08-21T14:00:00.000Z'),
  creada_por: { nombre: 'Juan', apellido: 'Pérez' },
}

function armarPrisma(estadoViaje = 'en_curso') {
  const viajeFindUnique = vi.fn().mockResolvedValue({
    creador_id: liderId,
    estado: estadoViaje,
  })
  const integranteFindUnique = vi.fn().mockResolvedValue({ estado: 'confirmado' })
  const integranteFindMany = vi.fn().mockResolvedValue([
    { usuario: { id: integranteId, push_token: 'ExponentPushToken[ana]' } },
    { usuario: { id: liderId, push_token: 'ExponentPushToken[juan]' } },
  ])
  const alertaCreate = vi.fn().mockResolvedValue(alertaCreada)
  const alertaFindMany = vi.fn().mockResolvedValue([alertaCreada])

  const prisma = {
    viaje: { findUnique: viajeFindUnique },
    viajeIntegrante: { findUnique: integranteFindUnique, findMany: integranteFindMany },
    alerta: { create: alertaCreate, findMany: alertaFindMany },
  } as unknown as PrismaClient

  return { prisma, viajeFindUnique, integranteFindUnique, alertaCreate, alertaFindMany }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('US1 — crear alertas del líder', () => {
  it('crea la alerta con tipo, mensaje y ubicación', async () => {
    const m = armarPrisma()

    const alerta = await new AlertasService(m.prisma).crear(liderId, viajeId, {
      tipo: 'combustible',
      mensaje: 'Cargamos en la YPF de Ruta 9',
      lat: -31.42,
      lng: -64.18,
    })

    expect(m.alertaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          viaje_id: viajeId,
          creada_por_id: liderId,
          tipo: 'combustible',
          origen: 'lider',
          mensaje: 'Cargamos en la YPF de Ruta 9',
          lat: -31.42,
          lng: -64.18,
        }),
      })
    )
    expect(alerta.estado).toBe('activa')
    expect(alerta.creada_por_nombre).toBe('Juan Pérez')
  })

  it('emite la alerta a la room del viaje', async () => {
    const m = armarPrisma()
    await new AlertasService(m.prisma).crear(liderId, viajeId, {
      tipo: 'peligro',
      mensaje: 'Ruta con ripio',
    })

    expect(emit).toHaveBeenCalledWith('viaje:alerta', expect.objectContaining({ viajeId }))
  })

  it('RN-040: manda push a los integrantes, salvo al líder que la creó', async () => {
    const m = armarPrisma()
    await new AlertasService(m.prisma).crear(liderId, viajeId, {
      tipo: 'combustible',
      mensaje: 'Cargamos en la YPF de Ruta 9',
    })

    await vi.waitFor(() => expect(sendExpoPush).toHaveBeenCalled())
    const mensajes = sendExpoPush.mock.calls[0]?.[0] as { to: string; title: string }[]
    expect(mensajes).toHaveLength(1)
    expect(mensajes[0]?.to).toBe('ExponentPushToken[ana]')
    expect(mensajes[0]?.title).toBe('Carga de combustible')
  })

  it('RN-030: un participante no puede crear alertas', async () => {
    const m = armarPrisma()

    await expect(
      new AlertasService(m.prisma).crear(integranteId, viajeId, {
        tipo: 'informacion',
        mensaje: 'Hola',
      })
    ).rejects.toMatchObject({ status: 403 })
    expect(m.alertaCreate).not.toHaveBeenCalled()
  })

  it('no se pueden crear alertas si el viaje no está en curso', async () => {
    const m = armarPrisma('planificado')

    await expect(
      new AlertasService(m.prisma).crear(liderId, viajeId, {
        tipo: 'informacion',
        mensaje: 'Salimos 30 min antes',
      })
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' })
  })

  it('no voltea la request si el push falla', async () => {
    const m = armarPrisma()
    sendExpoPush.mockRejectedValueOnce(new Error('Expo caído'))

    await expect(
      new AlertasService(m.prisma).crear(liderId, viajeId, {
        tipo: 'desvio',
        mensaje: 'Cortada la 9',
      })
    ).resolves.toBeTruthy()
  })
})

describe('US1 — historial de alertas', () => {
  it('devuelve el historial ordenado por fecha descendente', async () => {
    const m = armarPrisma()
    const alertas = await new AlertasService(m.prisma).listar(integranteId, viajeId)

    expect(m.alertaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { viaje_id: viajeId },
        orderBy: { created_at: 'desc' },
      })
    )
    expect(alertas[0]?.mensaje).toBe('Cargamos en la YPF de Ruta 9')
  })

  it('quien salió del viaje conserva acceso al historial', async () => {
    const m = armarPrisma('finalizado')
    m.integranteFindUnique.mockResolvedValue({ estado: 'salido' })

    await expect(
      new AlertasService(m.prisma).listar(integranteId, viajeId)
    ).resolves.toHaveLength(1)
  })

  it('un ajeno al viaje no ve el historial', async () => {
    const m = armarPrisma()
    m.integranteFindUnique.mockResolvedValue(null)

    await expect(
      new AlertasService(m.prisma).listar('99999999-9999-9999-9999-999999999999', viajeId)
    ).rejects.toMatchObject({ status: 403 })
  })
})
