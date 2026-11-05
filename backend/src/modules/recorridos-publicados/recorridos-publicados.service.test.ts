import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { RecorridosPublicadosService } from './recorridos-publicados.service'

const computeTrazaRecorrido = vi.fn()
const computeLineStringLengthMeters = vi.fn()
vi.mock('../../lib/postgis', () => ({
  computeTrazaRecorrido: (...args: unknown[]) => computeTrazaRecorrido(...args),
  computeLineStringLengthMeters: (...args: unknown[]) => computeLineStringLengthMeters(...args),
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
  const queryRaw = vi.fn().mockResolvedValue([])
  const plantillaFindUnique = vi.fn().mockResolvedValue(null)
  const plantillaCreate = vi.fn().mockImplementation(({ data }) =>
    Promise.resolve({ id: 'p1', created_at: new Date(), paradas: [], ...data })
  )
  const valoracionGroupBy = vi.fn().mockResolvedValue([])
  const valoracionFindMany = vi.fn().mockResolvedValue([])
  const valoracionCreate = vi.fn().mockResolvedValue({})
  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje) },
    metricaViaje: { findUnique: vi.fn().mockResolvedValue(metrica) },
    recorridoPublicado: { upsert, updateMany, findFirst, findMany },
    rutaPlantilla: { findUnique: plantillaFindUnique, create: plantillaCreate },
    valoracionRecorrido: {
      groupBy: valoracionGroupBy,
      findMany: valoracionFindMany,
      create: valoracionCreate,
    },
    $queryRaw: queryRaw,
  } as unknown as PrismaClient
  return {
    service: new RecorridosPublicadosService(prisma),
    upsert,
    updateMany,
    findFirst,
    findMany,
    queryRaw,
    plantillaFindUnique,
    plantillaCreate,
    valoracionGroupBy,
    valoracionFindMany,
    valoracionCreate,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  computeTrazaRecorrido.mockResolvedValue(TRAZA)
  computeLineStringLengthMeters.mockResolvedValue(1500)
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

  it('guarda el primer punto de la traza como inicio, para el filtro por zona', async () => {
    const { service, upsert } = armar()
    await service.publicar(usuarioId, viajeId)
    const args = upsert.mock.calls[0]![0]
    expect(args.create).toMatchObject({ inicio_lat: -31.42, inicio_lng: -64.18 })
    expect(args.update).toMatchObject({ inicio_lat: -31.42, inicio_lng: -64.18 })
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
    const r = await service.listar(usuarioId, { tipoActividad: 'bici', limit: 10, offset: 5 })
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
    const r = await service.obtener(usuarioId, 'r1')
    expect(r.segmentos).toEqual(TRAZA)
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r1', activo: true } }))

    findFirst.mockResolvedValue(null)
    await expect(service.obtener(usuarioId, 'r1')).rejects.toMatchObject({ status: 404 })
  })
})

describe('RecorridosPublicadosService.listar por zona (SCRUM-62)', () => {
  const zona = { lat: -31.4, lng: -64.2, radioKm: 25 }

  it('sin zona no usa la consulta espacial', async () => {
    const { service, queryRaw } = armar()
    await service.listar(usuarioId, { limit: 20, offset: 0 })
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('con zona filtra en PostGIS y respeta el orden de la consulta', async () => {
    const { service, queryRaw, findMany } = armar()
    queryRaw.mockResolvedValue([{ id: 'r2' }, { id: 'r1' }])
    findMany.mockResolvedValue([FILA, { ...FILA, id: 'r2' }])

    const r = await service.listar(usuarioId, { zona, tipoActividad: 'bici', limit: 20, offset: 0 })

    expect(queryRaw).toHaveBeenCalledOnce()
    const sql = queryRaw.mock.calls[0]![0] as { sql: string; values: unknown[] }
    expect(sql.sql).toMatch(/ST_DWithin/)
    expect(sql.sql).toMatch(/WHERE activo/)
    expect(sql.values).toEqual(expect.arrayContaining(['bici', 25000]))
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['r2', 'r1'] } } })
    )
    expect(r.map((x) => x.id)).toEqual(['r2', 'r1'])
  })

  it('sin resultados en la zona no consulta el detalle', async () => {
    const { service, findMany } = armar()
    const r = await service.listar(usuarioId, { zona, limit: 20, offset: 0 })
    expect(r).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('RecorridosPublicadosService.importar (SCRUM-62 / RN-084)', () => {
  const TRAZA_2_TRAMOS: [number, number][][] = [
    [
      [-31.42, -64.18],
      [-31.43, -64.19],
    ],
    [
      [-31.44, -64.2],
      [-31.45, -64.21],
    ],
  ]
  const RECORRIDO = {
    id: 'r1',
    nombre: 'Vuelta',
    tipo_actividad: 'trekking',
    tiempo_seg: 6300,
    segmentos: TRAZA_2_TRAMOS,
  }

  it('crea una plantilla copia: traza → trazado, extremos → origen y destino', async () => {
    const { service, findFirst, plantillaCreate } = armar()
    findFirst.mockResolvedValue(RECORRIDO)

    const r = await service.importar(usuarioId, 'r1')

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1', activo: true } })
    )
    const data = plantillaCreate.mock.calls[0]![0].data
    expect(data).toMatchObject({
      usuario_id: usuarioId,
      recorrido_publicado_id: 'r1',
      nombre: 'Vuelta',
      tipo_actividad: 'trekking',
      origen_lat: -31.42,
      origen_lng: -64.18,
      destino_lat: -31.45,
      destino_lng: -64.21,
      distancia_planeada_m: 1500,
      tiempo_estimado_seg: 6300,
    })
    // GeoJSON es [lng, lat]; los tramos se unen en un solo trazado.
    expect(data.linestring_geojson).toEqual({
      type: 'LineString',
      coordinates: [
        [-64.18, -31.42],
        [-64.19, -31.43],
        [-64.2, -31.44],
        [-64.21, -31.45],
      ],
    })
    expect(data).not.toHaveProperty('ruta_compartida_id')
    expect(r.ya_existia).toBe(false)
    expect(r.plantilla).toMatchObject({ id: 'p1', origen: { lat: -31.42, lng: -64.18 } })
  })

  it('usa un nombre por defecto si el recorrido no tenía', async () => {
    const { service, findFirst, plantillaCreate } = armar()
    findFirst.mockResolvedValue({ ...RECORRIDO, nombre: '  ' })
    await service.importar(usuarioId, 'r1')
    expect(plantillaCreate.mock.calls[0]![0].data.nombre).toBe('Recorrido de la comunidad')
  })

  it('es idempotente: si ya lo importó devuelve la misma plantilla', async () => {
    const { service, findFirst, plantillaFindUnique, plantillaCreate } = armar()
    findFirst.mockResolvedValue(RECORRIDO)
    plantillaFindUnique.mockResolvedValue({
      id: 'p1',
      nombre: 'Vuelta',
      tipo_actividad: 'trekking',
      origen_lat: -31.42,
      origen_lng: -64.18,
      origen_nombre: null,
      destino_lat: -31.45,
      destino_lng: -64.21,
      destino_nombre: null,
      linestring_geojson: {},
      distancia_planeada_m: 1500,
      tiempo_estimado_seg: 6300,
      created_at: new Date(),
      paradas: [],
    })

    const r = await service.importar(usuarioId, 'r1')
    expect(r.ya_existia).toBe(true)
    expect(plantillaCreate).not.toHaveBeenCalled()
    expect(plantillaFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuario_id_recorrido_publicado_id: { usuario_id: usuarioId, recorrido_publicado_id: 'r1' },
        },
      })
    )
  })

  it('carrera concurrente (P2002): devuelve la plantilla que creó el otro request', async () => {
    const { service, findFirst, plantillaFindUnique, plantillaCreate } = armar()
    findFirst.mockResolvedValue(RECORRIDO)
    plantillaCreate.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    plantillaFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'p1',
      nombre: 'Vuelta',
      tipo_actividad: 'trekking',
      origen_lat: 0,
      origen_lng: 0,
      origen_nombre: null,
      destino_lat: 0,
      destino_lng: 0,
      destino_nombre: null,
      linestring_geojson: {},
      distancia_planeada_m: null,
      tiempo_estimado_seg: null,
      created_at: new Date(),
      paradas: [],
    })
    const r = await service.importar(usuarioId, 'r1')
    expect(r.ya_existia).toBe(true)
  })

  it('404 si no existe o fue despublicado', async () => {
    const { service, findFirst, plantillaCreate } = armar()
    findFirst.mockResolvedValue(null)
    await expect(service.importar(usuarioId, 'r1')).rejects.toMatchObject({
      status: 404,
      code: 'RECORRIDO_NOT_FOUND',
    })
    expect(plantillaCreate).not.toHaveBeenCalled()
  })
})

describe('RecorridosPublicadosService valoraciones (SCRUM-63 / RN-082)', () => {
  const otroUsuario = '33333333-3333-3333-3333-333333333333'

  it('listar adjunta conteos, porcentaje y la valoración propia', async () => {
    const { service, findMany, valoracionGroupBy, valoracionFindMany } = armar()
    findMany.mockResolvedValue([FILA, { ...FILA, id: 'r2' }])
    valoracionGroupBy.mockResolvedValue([
      { recorrido_publicado_id: 'r1', recomiendo: true, _count: { _all: 2 } },
      { recorrido_publicado_id: 'r1', recomiendo: false, _count: { _all: 1 } },
    ])
    valoracionFindMany.mockResolvedValue([{ recorrido_publicado_id: 'r1', recomiendo: false }])

    const [r1, r2] = await service.listar(otroUsuario, { limit: 20, offset: 0 })

    expect(r1!.valoracion).toEqual({
      recomiendan: 2,
      no_recomiendan: 1,
      total: 3,
      porcentaje_recomienda: 67,
      mi_valoracion: false,
    })
    // Sin valoraciones: porcentaje null (no "0 %"), para no castigar a un recorrido nuevo.
    expect(r2!.valoracion).toEqual({
      recomiendan: 0,
      no_recomiendan: 0,
      total: 0,
      porcentaje_recomienda: null,
      mi_valoracion: null,
    })
    expect(valoracionGroupBy).toHaveBeenCalledOnce()
    expect(valoracionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recorrido_publicado_id: { in: ['r1', 'r2'] }, usuario_id: otroUsuario },
      })
    )
  })

  it('el listado sigue sin exponer velocidad (RN-070)', async () => {
    const { service } = armar()
    const [r] = await service.listar(otroUsuario, { limit: 20, offset: 0 })
    expect(JSON.stringify(r)).not.toMatch(/velocidad/)
  })

  it('obtener incluye la valoración', async () => {
    const { service, valoracionGroupBy } = armar()
    valoracionGroupBy.mockResolvedValue([
      { recorrido_publicado_id: 'r1', recomiendo: true, _count: { _all: 4 } },
    ])
    const r = await service.obtener(otroUsuario, 'r1')
    expect(r.valoracion).toMatchObject({ total: 4, porcentaje_recomienda: 100 })
  })

  it('valorar registra la opción y devuelve el resumen actualizado', async () => {
    const { service, findFirst, valoracionCreate, valoracionGroupBy, valoracionFindMany } = armar()
    findFirst.mockResolvedValue({ usuario_id: usuarioId })
    valoracionGroupBy.mockResolvedValue([
      { recorrido_publicado_id: 'r1', recomiendo: true, _count: { _all: 1 } },
    ])
    valoracionFindMany.mockResolvedValue([{ recorrido_publicado_id: 'r1', recomiendo: true }])

    const r = await service.valorar(otroUsuario, 'r1', true)

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1', activo: true } })
    )
    expect(valoracionCreate).toHaveBeenCalledWith({
      data: { recorrido_publicado_id: 'r1', usuario_id: otroUsuario, recomiendo: true },
    })
    expect(r).toEqual({
      recomiendan: 1,
      no_recomiendan: 0,
      total: 1,
      porcentaje_recomienda: 100,
      mi_valoracion: true,
    })
  })

  it('409 si ya lo había valorado (una sola vez por recorrido)', async () => {
    const { service, findFirst, valoracionCreate } = armar()
    findFirst.mockResolvedValue({ usuario_id: usuarioId })
    valoracionCreate.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    await expect(service.valorar(otroUsuario, 'r1', false)).rejects.toMatchObject({
      status: 409,
      code: 'VALORACION_EXISTENTE',
    })
  })

  it('403 si es el autor del recorrido', async () => {
    const { service, findFirst, valoracionCreate } = armar()
    findFirst.mockResolvedValue({ usuario_id: usuarioId })
    await expect(service.valorar(usuarioId, 'r1', true)).rejects.toMatchObject({
      status: 403,
      code: 'VALORACION_PROPIA',
    })
    expect(valoracionCreate).not.toHaveBeenCalled()
  })

  it('404 si no existe o fue despublicado', async () => {
    const { service, findFirst, valoracionCreate } = armar()
    findFirst.mockResolvedValue(null)
    await expect(service.valorar(otroUsuario, 'r1', true)).rejects.toMatchObject({
      status: 404,
      code: 'RECORRIDO_NOT_FOUND',
    })
    expect(valoracionCreate).not.toHaveBeenCalled()
  })

  it('otros errores de la base se propagan', async () => {
    const { service, findFirst, valoracionCreate } = armar()
    findFirst.mockResolvedValue({ usuario_id: usuarioId })
    valoracionCreate.mockRejectedValue(new Error('db caída'))
    await expect(service.valorar(otroUsuario, 'r1', true)).rejects.toThrow('db caída')
  })
})
