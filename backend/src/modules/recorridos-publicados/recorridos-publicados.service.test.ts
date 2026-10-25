import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { RecorridosPublicadosService } from './recorridos-publicados.service'

const computeTrazaRecorrido = vi.fn()
vi.mock('../../lib/postgis', () => ({
  computeTrazaRecorrido: (...args: unknown[]) => computeTrazaRecorrido(...args),
}))

const usuarioId = '11111111-1111-1111-1111-111111111111'
const viajeId = '22222222-2222-2222-2222-222222222222'
const TRAZA: [number, number][][] = [
  [
    [-31.42, -64.18],
    [-31.43, -64.19],
  ],
]

const FILA = {
  id: 'r1',
  viaje_id: viajeId,
  nombre: 'Vuelta',
  tipo_actividad: 'bici',
  distancia_m: 42500,
  tiempo_seg: 6300,
  publicado_at: new Date('2026-10-23T15:00:00.000Z'),
  usuario: { id: usuarioId, nombre: 'Ana', apellido: 'Pérez' },
}

function armar(overrides: { viaje?: unknown; metrica?: unknown } = {}) {
  const viaje =
    'viaje' in overrides
      ? overrides.viaje
      : {
          creador_id: usuarioId,
          nombre: 'Vuelta',
          tipo_actividad: 'bici',
          estado: 'finalizado',
          integrantes: [],
        }
  const metrica =
    'metrica' in overrides ? overrides.metrica : { distancia_m: 42500, tiempo_movimiento_seg: 6300 }
  const upsert = vi.fn().mockResolvedValue(FILA)
  const updateMany = vi.fn().mockResolvedValue({ count: 1 })
  const findFirst = vi.fn().mockResolvedValue({ ...FILA, segmentos: TRAZA })
  const findMany = vi.fn().mockResolvedValue([FILA])
  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje) },
    metricaViaje: { findUnique: vi.fn().mockResolvedValue(metrica) },
    recorridoPublicado: { upsert, updateMany, findFirst, findMany },
  } as unknown as PrismaClient
  return { service: new RecorridosPublicadosService(prisma), upsert, updateMany, findFirst, findMany }
}

beforeEach(() => {
  vi.clearAllMocks()
  computeTrazaRecorrido.mockResolvedValue(TRAZA)
})

describe('RecorridosPublicadosService.publicar', () => {
  it('publica un viaje finalizado propio con snapshot de traza y métricas', async () => {
    const { service, upsert } = armar()
    const r = await service.publicar(usuarioId, viajeId)

    expect(upsert).toHaveBeenCalledOnce()
    const args = upsert.mock.calls[0]![0]
    expect(args.create).toMatchObject({
      viaje_id: viajeId,
      usuario_id: usuarioId,
      tipo_actividad: 'bici',
      distancia_m: 42500,
      tiempo_seg: 6300,
      segmentos: TRAZA,
    })
    expect(args.update).toMatchObject({ activo: true })
    expect(r).toMatchObject({ id: 'r1', distancia_m: 42500, autor: { nombre: 'Ana' } })
  })

  it('nunca expone velocidad (RN-070)', async () => {
    const { service } = armar()
    const r = await service.publicar(usuarioId, viajeId)
    expect(Object.keys(r).join()).not.toMatch(/velocidad/)
  })

  it('permite publicar a un integrante que salió a mitad', async () => {
    const { service } = armar({
      viaje: {
        creador_id: 'otro',
        nombre: null,
        tipo_actividad: 'moto',
        estado: 'finalizado',
        integrantes: [{ estado: 'salido' }],
      },
    })
    await expect(service.publicar(usuarioId, viajeId)).resolves.toBeDefined()
  })

  it('404 si el viaje no existe', async () => {
    const { service } = armar({ viaje: null })
    await expect(service.publicar(usuarioId, viajeId)).rejects.toMatchObject({
      status: 404,
      code: 'VIAJE_NOT_FOUND',
    })
  })

  it('403 si no participó (o solo fue invitado)', async () => {
    const { service } = armar({
      viaje: {
        creador_id: 'otro',
        nombre: null,
        tipo_actividad: 'bici',
        estado: 'finalizado',
        integrantes: [{ estado: 'pendiente' }],
      },
    })
    await expect(service.publicar(usuarioId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('409 si el viaje no está finalizado', async () => {
    const { service, upsert } = armar({
      viaje: {
        creador_id: usuarioId,
        nombre: null,
        tipo_actividad: 'bici',
        estado: 'en_curso',
        integrantes: [],
      },
    })
    await expect(service.publicar(usuarioId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'VIAJE_NO_FINALIZADO',
    })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('422 si no hay traza GPS o métricas', async () => {
    computeTrazaRecorrido.mockResolvedValue([])
    const { service, upsert } = armar()
    await expect(service.publicar(usuarioId, viajeId)).rejects.toMatchObject({
      status: 422,
      code: 'RECORRIDO_SIN_TRAZA',
    })
    expect(upsert).not.toHaveBeenCalled()

    computeTrazaRecorrido.mockResolvedValue(TRAZA)
    const sinMetrica = armar({ metrica: null })
    await expect(sinMetrica.service.publicar(usuarioId, viajeId)).rejects.toMatchObject({
      status: 422,
    })
  })
})

describe('RecorridosPublicadosService.despublicar', () => {
  it('desactiva solo el recorrido del propio usuario', async () => {
    const { service, updateMany } = armar()
    await service.despublicar(usuarioId, viajeId)
    expect(updateMany).toHaveBeenCalledWith({
      where: { viaje_id: viajeId, usuario_id: usuarioId, activo: true },
      data: { activo: false },
    })
  })

  it('404 si no había nada publicado', async () => {
    const { service, updateMany } = armar()
    updateMany.mockResolvedValue({ count: 0 })
    await expect(service.despublicar(usuarioId, viajeId)).rejects.toMatchObject({
      status: 404,
      code: 'RECORRIDO_NOT_FOUND',
    })
  })
})

describe('RecorridosPublicadosService lecturas', () => {
  it('listar trae solo activos, filtra por actividad y pagina', async () => {
    const { service, findMany } = armar()
    const r = await service.listar({ tipoActividad: 'bici', limit: 10, offset: 5 })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { activo: true, tipo_actividad: 'bici' },
        take: 10,
        skip: 5,
        orderBy: { publicado_at: 'desc' },
      })
    )
    expect(r[0]).not.toHaveProperty('segmentos')
  })

  it('obtener devuelve la traza; despublicado es 404', async () => {
    const { service, findFirst } = armar()
    const r = await service.obtener('r1')
    expect(r.segmentos).toEqual(TRAZA)
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r1', activo: true } }))

    findFirst.mockResolvedValue(null)
    await expect(service.obtener('r1')).rejects.toMatchObject({ status: 404 })
  })
})
