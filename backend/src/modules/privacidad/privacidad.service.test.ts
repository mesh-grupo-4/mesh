import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { PrivacidadService } from './privacidad.service'
import { VERSION_CONSENTIMIENTO_UBICACION } from './privacidad.schemas'

const viajeId = '22222222-2222-2222-2222-222222222222'
const usuarioId = '11111111-1111-1111-1111-111111111111'
const otroId = '33333333-3333-3333-3333-333333333333'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

const limpiarIntegrante = vi.fn()
const resolverAlertasSistemaDe = vi.fn().mockResolvedValue(undefined)
vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => ({ limpiarIntegrante, resolverAlertasSistemaDe }),
}))

type OpcionesPrisma = {
  /** Fila de `privacidad_viaje`; `null` = nunca eligió y vale el default. */
  preferenciaViaje?: boolean | null
  comparteDefault?: boolean
  consentimientoAt?: Date | null
  consentimientoVersion?: string | null
  /** Creador del viaje; por defecto alguien distinto al usuario bajo prueba. */
  creadorId?: string
  integrante?: { estado: string } | null
  ubicacionesVivas?: { viaje_id: string }[]
}

function armarPrisma(opts: OpcionesPrisma = {}) {
  const {
    preferenciaViaje = null,
    comparteDefault = true,
    consentimientoAt = new Date('2026-09-15T10:00:00.000Z'),
    consentimientoVersion = VERSION_CONSENTIMIENTO_UBICACION,
    creadorId = otroId,
    integrante = { estado: 'confirmado' },
    ubicacionesVivas = [],
  } = opts

  const filaPrivacidad =
    preferenciaViaje === null
      ? null
      : {
          comparte_ubicacion: preferenciaViaje,
          updated_at: new Date('2026-09-15T11:00:00.000Z'),
        }

  const usuarioUpdate = vi.fn().mockResolvedValue({})
  const privacidadUpsert = vi.fn().mockResolvedValue({})
  const ubicacionVivaDeleteMany = vi.fn().mockResolvedValue({ count: 1 })

  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue({ creador_id: creadorId }) },
    viajeIntegrante: { findUnique: vi.fn().mockResolvedValue(integrante) },
    usuario: {
      findUnique: vi.fn().mockResolvedValue({
        comparte_ubicacion_default: comparteDefault,
        consentimiento_ubicacion_at: consentimientoAt,
        consentimiento_ubicacion_version: consentimientoVersion,
        privacidad_viajes: filaPrivacidad ? [{ comparte_ubicacion: preferenciaViaje }] : [],
      }),
      update: usuarioUpdate,
    },
    privacidadViaje: {
      findUnique: vi.fn().mockResolvedValue(filaPrivacidad),
      upsert: privacidadUpsert,
    },
    ubicacionViva: {
      findMany: vi.fn().mockResolvedValue(ubicacionesVivas),
      deleteMany: ubicacionVivaDeleteMany,
    },
    accesoUbicacion: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaClient

  return { prisma, usuarioUpdate, privacidadUpsert, ubicacionVivaDeleteMany }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('privacidad por viaje (RN-111)', () => {
  it('sin fila propia, `comparte_ubicacion` es null y manda el default del perfil', async () => {
    const m = armarPrisma({ preferenciaViaje: null, comparteDefault: true })

    const out = await new PrivacidadService(m.prisma).privacidadViaje(usuarioId, viajeId)

    expect(out.comparte_ubicacion).toBeNull()
    expect(out.comparte_efectivo).toBe(true)
  })

  it('la preferencia del viaje pisa el default del perfil', async () => {
    const m = armarPrisma({ preferenciaViaje: false, comparteDefault: true })

    const out = await new PrivacidadService(m.prisma).privacidadViaje(usuarioId, viajeId)

    expect(out.comparte_ubicacion).toBe(false)
    expect(out.comparte_efectivo).toBe(false)
  })

  it('sin consentimiento, `comparte_efectivo` es false aunque el interruptor esté en on', async () => {
    const m = armarPrisma({ preferenciaViaje: true, consentimientoAt: null })

    const out = await new PrivacidadService(m.prisma).privacidadViaje(usuarioId, viajeId)

    expect(out.comparte_ubicacion).toBe(true)
    expect(out.comparte_efectivo).toBe(false)
    expect(out.consentimiento_otorgado).toBe(false)
  })

  it('apagar borra la posición viva, limpia el motor y avisa a la sala', async () => {
    const m = armarPrisma({ preferenciaViaje: false })

    await new PrivacidadService(m.prisma).actualizarPrivacidadViaje(usuarioId, viajeId, {
      comparte_ubicacion: false,
    })

    expect(m.privacidadUpsert).toHaveBeenCalledTimes(1)
    expect(m.ubicacionVivaDeleteMany).toHaveBeenCalledWith({
      where: { viaje_id: viajeId, usuario_id: usuarioId },
    })
    // Si no se limpia, al volver a encender el motor arrastraría la detención
    // acumulada mientras estaba oculto y dispararía un incidente falso (RN-036).
    expect(limpiarIntegrante).toHaveBeenCalledWith(viajeId, usuarioId)
    expect(resolverAlertasSistemaDe).toHaveBeenCalledWith(viajeId, usuarioId)
    expect(emit).toHaveBeenCalledWith('viaje:ubicacion_oculta', { viajeId, usuarioId })
  })

  it('encender no borra nada: el próximo ping vuelve a publicar', async () => {
    const m = armarPrisma({ preferenciaViaje: true })

    await new PrivacidadService(m.prisma).actualizarPrivacidadViaje(usuarioId, viajeId, {
      comparte_ubicacion: true,
    })

    expect(m.ubicacionVivaDeleteMany).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('quien no participa del viaje no puede leer ni cambiar la preferencia', async () => {
    const m = armarPrisma({ creadorId: otroId, integrante: null })
    const service = new PrivacidadService(m.prisma)

    await expect(service.privacidadViaje(usuarioId, viajeId)).rejects.toMatchObject({ status: 403 })
    await expect(
      service.actualizarPrivacidadViaje(usuarioId, viajeId, { comparte_ubicacion: false })
    ).rejects.toMatchObject({ status: 403 })
  })

  it('el creador del viaje puede configurarla aunque no tenga fila de integrante', async () => {
    const m = armarPrisma({ creadorId: usuarioId, integrante: null })

    const out = await new PrivacidadService(m.prisma).privacidadViaje(usuarioId, viajeId)

    expect(out.viaje_id).toBe(viajeId)
  })
})

describe('consentimiento de geolocalización (RN-110/113)', () => {
  it('otorgarlo guarda la versión vigente del texto', async () => {
    const m = armarPrisma()

    await new PrivacidadService(m.prisma).actualizarMiPrivacidad(usuarioId, {
      consentimiento_ubicacion: true,
    })

    expect(m.usuarioUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consentimiento_ubicacion_version: VERSION_CONSENTIMIENTO_UBICACION,
        }),
      })
    )
  })

  it('revocarlo lo limpia y oculta las posiciones vivas de todos los viajes', async () => {
    const m = armarPrisma({
      consentimientoAt: null,
      consentimientoVersion: null,
      ubicacionesVivas: [{ viaje_id: viajeId }],
    })

    await new PrivacidadService(m.prisma).actualizarMiPrivacidad(usuarioId, {
      consentimiento_ubicacion: false,
    })

    expect(m.usuarioUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consentimiento_ubicacion_at: null,
          consentimiento_ubicacion_version: null,
        }),
      })
    )
    expect(m.ubicacionVivaDeleteMany).toHaveBeenCalledWith({ where: { usuario_id: usuarioId } })
    expect(emit).toHaveBeenCalledWith('viaje:ubicacion_oculta', { viajeId, usuarioId })
  })

  it('una versión vieja del texto deja de ser consentimiento vigente', async () => {
    const m = armarPrisma({ consentimientoVersion: '1900-01-01' })

    const out = await new PrivacidadService(m.prisma).miPrivacidad(usuarioId)

    expect(out.consentimiento_otorgado).toBe(true)
    expect(out.consentimiento_vigente).toBe(false)
    expect(out.version_vigente).toBe(VERSION_CONSENTIMIENTO_UBICACION)
  })
})
