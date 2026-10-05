import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'
import { actualizarViajeSchema, createViajeSchema } from './viajes.schemas'
import { parametrosPorActividad, toleranciaAtrasoEfectiva } from './activityDefaults'

const creadorId = '11111111-1111-1111-1111-111111111111'
const viajeId = '44444444-4444-4444-4444-444444444444'

vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: vi.fn() }) }),
}))
vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => ({ procesarPing: vi.fn(), limpiarViaje: vi.fn(), limpiarIntegrante: vi.fn() }),
}))

const futura = new Date(Date.now() + 86_400_000)

describe('RN-021 / RN-025 — defaults y validación de parámetros', () => {
  it('la tolerancia por defecto sale de la misma tabla que usa el motor', () => {
    expect(parametrosPorActividad('bici')).toEqual({
      velocidadEsperada: 35,
      distanciaMaxSeparacion: 300,
      toleranciaAtrasoMin: 5,
    })
    expect(parametrosPorActividad('moto').toleranciaAtrasoMin).toBe(10)
    expect(toleranciaAtrasoEfectiva('trekking', null)).toBe(3)
    expect(toleranciaAtrasoEfectiva('trekking', 8)).toBe(8)
  })

  it('crear acepta parámetros opcionales dentro de rango', () => {
    const base = { nombre: 'x', esGrupal: true, tipoActividad: 'bici', fechaProgramada: futura.toISOString() }
    expect(
      createViajeSchema.safeParse({ ...base, velocidadEsperada: 40, distanciaMaxSeparacion: 400, toleranciaAtrasoMin: 6 }).success
    ).toBe(true)
    expect(createViajeSchema.safeParse({ ...base, velocidadEsperada: 0 }).success).toBe(false)
    expect(createViajeSchema.safeParse({ ...base, distanciaMaxSeparacion: 5 }).success).toBe(false)
    expect(createViajeSchema.safeParse({ ...base, toleranciaAtrasoMin: 61 }).success).toBe(false)
  })

  it('actualizar acepta solo parámetros, y null restaura la tolerancia', () => {
    expect(actualizarViajeSchema.safeParse({ velocidadEsperada: 50 }).success).toBe(true)
    expect(actualizarViajeSchema.safeParse({ toleranciaAtrasoMin: null }).success).toBe(true)
    expect(actualizarViajeSchema.safeParse({}).success).toBe(false)
  })
})

describe('ViajesService — parámetros de actividad (SCRUM-26)', () => {
  beforeEach(() => vi.clearAllMocks())

  function armarCrear() {
    const viajeCreate = vi.fn().mockResolvedValue({ id: viajeId })
    const tx = {
      viaje: { create: viajeCreate },
      viajeIntegrante: { create: vi.fn(), createMany: vi.fn() },
      viajeGrupo: { createMany: vi.fn() },
    }
    const prisma = {
      usuario: { findUnique: vi.fn().mockResolvedValue({ id: creadorId }) },
      grupoMiembro: { findMany: vi.fn().mockResolvedValue([]) },
      amistad: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaClient
    return { prisma, viajeCreate }
  }

  it('sin overrides aplica los defaults de la actividad', async () => {
    const m = armarCrear()
    await new ViajesService(m.prisma).crearViaje(creadorId, {
      nombre: 'Salida',
      esGrupal: true,
      grupoIds: [],
      amigoIds: [],
      tipoActividad: 'trekking',
      fechaProgramada: futura,
    })
    expect(m.viajeCreate.mock.calls[0]![0].data).toMatchObject({
      velocidad_esperada: 5,
      distancia_max_separacion: 50,
      tolerancia_atraso_min: null,
    })
  })

  it('el líder puede ajustar los tres parámetros al crear', async () => {
    const m = armarCrear()
    await new ViajesService(m.prisma).crearViaje(creadorId, {
      nombre: 'Salida',
      esGrupal: true,
      grupoIds: [],
      amigoIds: [],
      tipoActividad: 'bici',
      fechaProgramada: futura,
      velocidadEsperada: 28,
      distanciaMaxSeparacion: 500,
      toleranciaAtrasoMin: 8,
    })
    expect(m.viajeCreate.mock.calls[0]![0].data).toMatchObject({
      velocidad_esperada: 28,
      distancia_max_separacion: 500,
      tolerancia_atraso_min: 8,
    })
  })

  it('RN-071 / RN-070: competitivo exige grupal y nunca moto', async () => {
    const m = armarCrear()
    const base = { nombre: 'Salida', grupoIds: [], amigoIds: [], fechaProgramada: futura }
    await expect(
      new ViajesService(m.prisma).crearViaje(creadorId, { ...base, esGrupal: false, tipoActividad: 'bici', modo: 'competitivo' })
    ).rejects.toMatchObject({ status: 400, code: 'MODO_INVALIDO' })
    await expect(
      new ViajesService(m.prisma).crearViaje(creadorId, { ...base, esGrupal: true, tipoActividad: 'moto', modo: 'competitivo' })
    ).rejects.toMatchObject({ status: 400, code: 'MODO_INVALIDO' })
    await new ViajesService(m.prisma).crearViaje(creadorId, { ...base, esGrupal: true, tipoActividad: 'bici', modo: 'competitivo' })
    expect(m.viajeCreate.mock.calls[0]![0].data).toMatchObject({ modo: 'competitivo' })
  })

  it('actualizar cambia los parámetros y devuelve la tolerancia efectiva', async () => {
    const viaje = {
      id: viajeId,
      creador_id: creadorId,
      estado: 'en_curso',
      es_grupal: true,
      tipo_actividad: 'bici',
      velocidad_esperada: 35,
      distancia_max_separacion: 300,
      tolerancia_atraso_min: null,
      alerta_incidente_habilitada: true,
      alerta_incidente_minutos: null,
      alertas_solo_lider: true,
      fecha_programada: futura,
    }
    const viajeUpdate = vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...viaje,
      ...data,
    }))
    const prisma = {
      viaje: { findUnique: vi.fn().mockResolvedValue(viaje), update: viajeUpdate },
    } as unknown as PrismaClient

    const out = await new ViajesService(prisma).actualizarViaje(creadorId, viajeId, {
      velocidadEsperada: 30,
      distanciaMaxSeparacion: 450,
      toleranciaAtrasoMin: 7,
    })

    expect(viajeUpdate.mock.calls[0]![0].data).toEqual({
      velocidad_esperada: 30,
      distancia_max_separacion: 450,
      tolerancia_atraso_min: 7,
    })
    expect(out).toMatchObject({
      velocidad_esperada: 30,
      distancia_max_separacion: 450,
      tolerancia_atraso_min: 7,
      tolerancia_atraso_min_efectivo: 7,
    })

    const reset = await new ViajesService(prisma).actualizarViaje(creadorId, viajeId, {
      toleranciaAtrasoMin: null,
    })
    expect(reset.tolerancia_atraso_min_efectivo).toBe(5)
  })

  it('RN-030: solo el creador edita parámetros', async () => {
    const prisma = {
      viaje: { findUnique: vi.fn().mockResolvedValue({ id: viajeId, creador_id: creadorId, estado: 'planificado' }) },
    } as unknown as PrismaClient
    await expect(
      new ViajesService(prisma).actualizarViaje('otro', viajeId, { velocidadEsperada: 30 })
    ).rejects.toMatchObject({ code: 'NOT_CREATOR' })
  })
})
