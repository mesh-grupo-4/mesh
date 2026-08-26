import { describe, expect, it } from 'vitest'
import { ChecklistService } from './checklist.service'
import { itemsSugeridos } from './checklistDefaults'
import { crearPrismaFake } from './prismaFake.testkit'

const viajeId = '11111111-1111-1111-1111-111111111111'
const viajeAnteriorId = '55555555-5555-5555-5555-555555555555'
const creadorId = '22222222-2222-2222-2222-222222222222'
const integranteId = '33333333-3333-3333-3333-333333333333'
const ajenoId = '44444444-4444-4444-4444-444444444444'

function armar(opts: {
  estado?: string
  tipoActividad?: string
  otrosViajes?: Record<string, { creador_id: string; estado: string; tipo_actividad: string }>
} = {}) {
  const { prisma, filas } = crearPrismaFake({
    viajeId,
    viaje: {
      creador_id: creadorId,
      estado: opts.estado ?? 'planificado',
      tipo_actividad: opts.tipoActividad ?? 'moto',
    },
    otrosViajes: opts.otrosViajes,
    integrantes: [integranteId],
  })
  return { service: new ChecklistService(prisma), filas }
}

describe('RN-026 — siembra de ítems sugeridos', () => {
  it('la primera lectura siembra los sugeridos del tipo de actividad', async () => {
    const { service } = armar({ tipoActividad: 'moto' })

    const items = await service.miChecklist(creadorId, viajeId)

    expect(items.map((i) => i.texto)).toEqual([...itemsSugeridos('moto')])
    expect(items.every((i) => i.origen === 'sugerido')).toBe(true)
    expect(items.every((i) => i.completado === false)).toBe(true)
    expect(items.map((i) => i.orden)).toEqual(items.map((_, idx) => idx))
  })

  it('siembra la lista de la actividad del viaje, no una genérica', async () => {
    const { service } = armar({ tipoActividad: 'trekking' })

    const items = await service.miChecklist(creadorId, viajeId)

    expect(items.map((i) => i.texto)).toEqual([...itemsSugeridos('trekking')])
  })

  it('leer dos veces no duplica ni resiembra lo que el usuario borró', async () => {
    const { service } = armar()

    const primera = await service.miChecklist(creadorId, viajeId)
    await service.eliminarItem(creadorId, viajeId, primera[0]!.id)
    const segunda = await service.miChecklist(creadorId, viajeId)

    expect(segunda).toHaveLength(primera.length - 1)
    expect(segunda.map((i) => i.texto)).not.toContain(primera[0]!.texto)
  })

  it('cada integrante tiene su propio checklist y su propio estado de completado', async () => {
    const { service } = armar()

    const delCreador = await service.miChecklist(creadorId, viajeId)
    await service.actualizarItem(creadorId, viajeId, delCreador[0]!.id, { completado: true })
    const delIntegrante = await service.miChecklist(integranteId, viajeId)

    expect(delIntegrante[0]!.id).not.toBe(delCreador[0]!.id)
    expect(delIntegrante[0]!.completado).toBe(false)
  })
})

describe('RN-026 — ítems personalizados', () => {
  it('agrega un ítem propio al final de la lista', async () => {
    const { service } = armar()
    await service.miChecklist(creadorId, viajeId)

    const item = await service.agregarItem(creadorId, viajeId, {
      texto: 'Cargador de celular y cable',
      paraTodos: false,
    })

    expect(item.origen).toBe('personal')
    expect(item.puede_editar).toBe(true)
    const items = await service.miChecklist(creadorId, viajeId)
    expect(items.at(-1)!.texto).toBe('Cargador de celular y cable')
  })

  it('rechaza un texto que ya está en el checklist', async () => {
    const { service } = armar()
    await service.miChecklist(creadorId, viajeId)

    await expect(
      service.agregarItem(creadorId, viajeId, { texto: 'Casco', paraTodos: false })
    ).rejects.toMatchObject({ status: 409, code: 'ITEM_DUPLICADO' })
  })

  it('marca y desmarca un ítem', async () => {
    const { service } = armar()
    const items = await service.miChecklist(creadorId, viajeId)

    const marcado = await service.actualizarItem(creadorId, viajeId, items[0]!.id, {
      completado: true,
    })
    expect(marcado.completado).toBe(true)

    const desmarcado = await service.actualizarItem(creadorId, viajeId, items[0]!.id, {
      completado: false,
    })
    expect(desmarcado.completado).toBe(false)
  })

  it('no deja tocar el ítem de otro integrante', async () => {
    const { service } = armar()
    const delIntegrante = await service.miChecklist(integranteId, viajeId)

    await expect(
      service.actualizarItem(creadorId, viajeId, delIntegrante[0]!.id, { completado: true })
    ).rejects.toMatchObject({ status: 404, code: 'ITEM_NOT_FOUND' })
  })
})

describe('RN-026 + RN-030 — ítems base del creador', () => {
  it('el creador define un ítem para todos y le llega a cada integrante', async () => {
    const { service } = armar()
    await service.miChecklist(creadorId, viajeId)
    await service.miChecklist(integranteId, viajeId)

    await service.agregarItem(creadorId, viajeId, {
      texto: 'Chaleco reflectivo',
      paraTodos: true,
    })

    const delIntegrante = await service.miChecklist(integranteId, viajeId)
    const copia = delIntegrante.find((i) => i.texto === 'Chaleco reflectivo')
    expect(copia).toBeDefined()
    expect(copia!.origen).toBe('lider')
    expect(copia!.puede_editar).toBe(false)
  })

  it('quien abre el checklist después también recibe los ítems base', async () => {
    const { service } = armar()
    await service.miChecklist(creadorId, viajeId)
    await service.agregarItem(creadorId, viajeId, {
      texto: 'Chaleco reflectivo',
      paraTodos: true,
    })

    const delIntegrante = await service.miChecklist(integranteId, viajeId)

    expect(delIntegrante.map((i) => i.texto)).toContain('Chaleco reflectivo')
  })

  it('un participante no puede crear ítems para todo el grupo (RN-030)', async () => {
    const { service } = armar()

    await expect(
      service.agregarItem(integranteId, viajeId, { texto: 'Mate', paraTodos: true })
    ).rejects.toMatchObject({ status: 403, code: 'NOT_CREATOR' })
  })

  it('el integrante marca el ítem base pero no lo edita ni lo borra', async () => {
    const { service } = armar()
    await service.miChecklist(creadorId, viajeId)
    await service.agregarItem(creadorId, viajeId, { texto: 'Chaleco reflectivo', paraTodos: true })
    const items = await service.miChecklist(integranteId, viajeId)
    const copia = items.find((i) => i.texto === 'Chaleco reflectivo')!

    const marcado = await service.actualizarItem(integranteId, viajeId, copia.id, {
      completado: true,
    })
    expect(marcado.completado).toBe(true)

    await expect(
      service.actualizarItem(integranteId, viajeId, copia.id, { texto: 'Otra cosa' })
    ).rejects.toMatchObject({ status: 403, code: 'ITEM_OBLIGATORIO' })
    await expect(
      service.eliminarItem(integranteId, viajeId, copia.id)
    ).rejects.toMatchObject({ status: 403, code: 'ITEM_OBLIGATORIO' })
  })

  it('si el creador renombra el ítem base, las copias se actualizan', async () => {
    const { service } = armar()
    await service.miChecklist(creadorId, viajeId)
    const base = await service.agregarItem(creadorId, viajeId, {
      texto: 'Chaleco',
      paraTodos: true,
    })
    await service.miChecklist(integranteId, viajeId)

    await service.actualizarItem(creadorId, viajeId, base.id, { texto: 'Chaleco reflectivo' })

    const items = await service.miChecklist(integranteId, viajeId)
    expect(items.map((i) => i.texto)).toContain('Chaleco reflectivo')
    expect(items.map((i) => i.texto)).not.toContain('Chaleco')
  })

  it('si el creador borra el ítem base, desaparece de todo el grupo', async () => {
    const { service } = armar()
    await service.miChecklist(creadorId, viajeId)
    const base = await service.agregarItem(creadorId, viajeId, {
      texto: 'Chaleco reflectivo',
      paraTodos: true,
    })
    await service.miChecklist(integranteId, viajeId)

    await service.eliminarItem(creadorId, viajeId, base.id)

    const items = await service.miChecklist(integranteId, viajeId)
    expect(items.map((i) => i.texto)).not.toContain('Chaleco reflectivo')
  })
})

describe('RN-026 — reutilización entre viajes', () => {
  const otrosViajes = {
    [viajeAnteriorId]: {
      creador_id: creadorId,
      estado: 'en_curso',
      tipo_actividad: 'moto',
    },
  }

  it('no vuelve a traer los ítems que el destino ya tenía', async () => {
    const { service } = armar({ otrosViajes })
    await service.miChecklist(creadorId, viajeAnteriorId)
    await service.miChecklist(creadorId, viajeId)

    const resultado = await service.importarDesdeViaje(creadorId, viajeId, {
      viajeOrigenId: viajeAnteriorId,
    })

    // Ambos viajes son de moto: todo lo del origen ya estaba sembrado en el destino.
    expect(resultado.importados).toBe(0)
    expect(resultado.omitidos).toBe(itemsSugeridos('moto').length)
    expect(resultado.items).toHaveLength(itemsSugeridos('moto').length)
  })

  it('trae los ítems personalizados que no estaban en el destino', async () => {
    const { service } = armar({ otrosViajes })
    await service.miChecklist(creadorId, viajeAnteriorId)
    await service.agregarItem(creadorId, viajeAnteriorId, {
      texto: 'Kit de primeros auxilios',
      paraTodos: false,
    })
    await service.miChecklist(creadorId, viajeId)

    const resultado = await service.importarDesdeViaje(creadorId, viajeId, {
      viajeOrigenId: viajeAnteriorId,
    })

    expect(resultado.importados).toBe(1)
    const importado = resultado.items.find((i) => i.texto === 'Kit de primeros auxilios')
    expect(importado).toBeDefined()
    // Se importa como personal aunque en el viaje origen fuera un ítem base.
    expect(importado!.origen).toBe('personal')
  })

  it('importa a un destino de otra actividad sin pisar sus sugeridos', async () => {
    const { service } = armar({ tipoActividad: 'bici', otrosViajes })
    await service.miChecklist(creadorId, viajeAnteriorId)
    const destinoAntes = await service.miChecklist(creadorId, viajeId)

    const resultado = await service.importarDesdeViaje(creadorId, viajeId, {
      viajeOrigenId: viajeAnteriorId,
    })

    // 'Casco' está en las dos listas: se omite una sola vez, no se duplica.
    expect(resultado.omitidos).toBeGreaterThan(0)
    expect(resultado.items.length).toBe(destinoAntes.length + resultado.importados)
    expect(new Set(resultado.items.map((i) => i.texto)).size).toBe(resultado.items.length)
  })

  it('rechaza importar el checklist del mismo viaje', async () => {
    const { service } = armar({ otrosViajes })

    await expect(
      service.importarDesdeViaje(creadorId, viajeId, { viajeOrigenId: viajeId })
    ).rejects.toMatchObject({ status: 400, code: 'MISMO_VIAJE' })
  })

  it('rechaza importar de un viaje inexistente', async () => {
    const { service } = armar()

    await expect(
      service.importarDesdeViaje(creadorId, viajeId, { viajeOrigenId: viajeAnteriorId })
    ).rejects.toMatchObject({ status: 404, code: 'VIAJE_ORIGEN_NOT_FOUND' })
  })
})

describe('RN-030 — autorización y estado del viaje', () => {
  it('quien no participa del viaje no ve el checklist', async () => {
    const { service } = armar()

    await expect(service.miChecklist(ajenoId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('un viaje inexistente da 404', async () => {
    const { service } = armar()

    await expect(
      service.miChecklist(creadorId, '99999999-9999-9999-9999-999999999999')
    ).rejects.toMatchObject({ status: 404, code: 'VIAJE_NOT_FOUND' })
  })

  it('el checklist sigue disponible con el viaje en curso', async () => {
    const { service } = armar({ estado: 'en_curso' })

    const items = await service.miChecklist(creadorId, viajeId)
    const marcado = await service.actualizarItem(creadorId, viajeId, items[0]!.id, {
      completado: true,
    })

    expect(marcado.completado).toBe(true)
  })

  it('un viaje finalizado queda de solo lectura', async () => {
    const { service, filas } = armar({ estado: 'finalizado' })

    // No se siembra nada sobre un viaje ya terminado.
    expect(await service.miChecklist(creadorId, viajeId)).toEqual([])
    expect(filas).toHaveLength(0)

    await expect(
      service.agregarItem(creadorId, viajeId, { texto: 'Casco', paraTodos: false })
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' })
  })
})
