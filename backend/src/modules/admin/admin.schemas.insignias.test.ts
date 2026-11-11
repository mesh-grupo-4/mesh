import { describe, expect, it } from 'vitest'
import { actualizarInsigniaSchema, crearInsigniaSchema } from './admin.schemas'

const alta = { codigo: 'maraton', nombre: 'Maratón', icono: 'award' }

describe('crearInsigniaSchema (RN-133)', () => {
  it('completa los opcionales con sus valores por defecto', () => {
    expect(crearInsigniaSchema.parse(alta)).toEqual({
      ...alta,
      descripcion: null,
      rareza: 'comun',
      criterio_distancia_m: null,
      criterio_duracion_seg: null,
      criterio_actividad: null,
      activa: true,
    })
  })

  it('rechaza un criterio de velocidad (RN-070)', () => {
    expect(crearInsigniaSchema.safeParse({ ...alta, criterio_velocidad_kmh: 30 }).success).toBe(false)
  })

  it('valida el formato del código y del ícono', () => {
    expect(crearInsigniaSchema.safeParse({ ...alta, codigo: 'Maratón 42' }).success).toBe(false)
    expect(crearInsigniaSchema.safeParse({ ...alta, icono: 'Award!' }).success).toBe(false)
  })

  it('exige criterios positivos y una duración entera', () => {
    expect(crearInsigniaSchema.safeParse({ ...alta, criterio_distancia_m: 0 }).success).toBe(false)
    expect(crearInsigniaSchema.safeParse({ ...alta, criterio_duracion_seg: 90.5 }).success).toBe(false)
  })

  it('una descripción vacía se guarda como null', () => {
    expect(crearInsigniaSchema.parse({ ...alta, descripcion: '  ' }).descripcion).toBeNull()
  })
})

describe('actualizarInsigniaSchema (RN-133)', () => {
  it('no permite cambiar el código', () => {
    expect(actualizarInsigniaSchema.safeParse({ codigo: 'otro' }).success).toBe(false)
  })

  it('exige al menos un campo', () => {
    expect(actualizarInsigniaSchema.safeParse({}).success).toBe(false)
  })

  it('permite quitar un criterio con null', () => {
    expect(actualizarInsigniaSchema.parse({ criterio_actividad: null })).toEqual({ criterio_actividad: null })
  })
})
