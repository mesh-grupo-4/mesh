import { describe, expect, it } from 'vitest'
import {
  importarRecorridoBody,
  listarRecorridosQuery,
  publicarRecorridoBody,
  valorarRecorridoBody,
} from './recorridos-publicados.schemas'

describe('listarRecorridosQuery (SCRUM-62)', () => {
  it('sin zona: zona undefined y paginación por defecto', () => {
    expect(listarRecorridosQuery.parse({})).toEqual({ limit: 20, offset: 0, zona: undefined })
  })

  it('arma la zona con radio por defecto de 25 km', () => {
    const q = listarRecorridosQuery.parse({ lat: '-31.4', lng: '-64.2' })
    expect(q.zona).toEqual({ lat: -31.4, lng: -64.2, radioKm: 25 })
  })

  it('respeta el radio pedido', () => {
    const q = listarRecorridosQuery.parse({ lat: '-31.4', lng: '-64.2', radioKm: '50' })
    expect(q.zona?.radioKm).toBe(50)
  })

  it('lat sin lng es inválido', () => {
    expect(listarRecorridosQuery.safeParse({ lat: '-31.4' }).success).toBe(false)
  })

  it('radioKm sin centro es inválido', () => {
    expect(listarRecorridosQuery.safeParse({ radioKm: '10' }).success).toBe(false)
  })

  it('radio fuera de rango o coordenadas inválidas', () => {
    expect(listarRecorridosQuery.safeParse({ lat: 0, lng: 0, radioKm: 500 }).success).toBe(false)
    expect(listarRecorridosQuery.safeParse({ lat: 95, lng: 0 }).success).toBe(false)
  })
})

describe('valorarRecorridoBody (SCRUM-63)', () => {
  it('acepta Recomiendo y No recomiendo', () => {
    expect(valorarRecorridoBody.parse({ recomiendo: true })).toEqual({ recomiendo: true })
    expect(valorarRecorridoBody.parse({ recomiendo: false })).toEqual({ recomiendo: false })
  })

  it('no acepta otra cosa que un booleano', () => {
    expect(valorarRecorridoBody.safeParse({}).success).toBe(false)
    expect(valorarRecorridoBody.safeParse({ recomiendo: 'si' }).success).toBe(false)
    expect(valorarRecorridoBody.safeParse({ estrellas: 5 }).success).toBe(false)
  })

  it('rechaza comentarios de texto (RN-083)', () => {
    const r = valorarRecorridoBody.safeParse({ recomiendo: true, comentario: 'Muy linda' })
    expect(r.success).toBe(false)
  })
})

describe('publicarRecorridoBody', () => {
  it('sin cuerpo publica sin comentario ni checklist', () => {
    expect(publicarRecorridoBody.parse({})).toEqual({ comentario: null, compartirChecklist: false })
  })

  it('recorta el comentario y lo vacío cuenta como ausente', () => {
    expect(publicarRecorridoBody.parse({ comentario: '  Linda vuelta ' }).comentario).toBe(
      'Linda vuelta'
    )
    expect(publicarRecorridoBody.parse({ comentario: '   ' }).comentario).toBeNull()
  })

  it('rechaza un comentario largo y los campos desconocidos', () => {
    expect(publicarRecorridoBody.safeParse({ comentario: 'x'.repeat(281) }).success).toBe(false)
    expect(publicarRecorridoBody.safeParse({ otro: true }).success).toBe(false)
  })

  it('acepta el path de una foto ya subida y rechaza uno vacío o demasiado largo', () => {
    const fotoPath = 'recorridos/u/v/1792000000000.jpg'
    expect(publicarRecorridoBody.parse({ fotoPath }).fotoPath).toBe(fotoPath)
    expect(publicarRecorridoBody.safeParse({ fotoPath: '  ' }).success).toBe(false)
    expect(publicarRecorridoBody.safeParse({ fotoPath: 'x'.repeat(201) }).success).toBe(false)
  })
})

describe('importarRecorridoBody', () => {
  it('por defecto no guarda el checklist', () => {
    expect(importarRecorridoBody.parse({})).toEqual({ guardarChecklist: false })
  })
})

describe('listarRecorridosQuery.q', () => {
  it('lo recorta y lo vacío equivale a no enviarlo', () => {
    expect(listarRecorridosQuery.parse({ q: ' dique ' }).q).toBe('dique')
    expect(listarRecorridosQuery.parse({ q: '  ' }).q).toBeUndefined()
  })

  it('rechaza búsquedas de más de 60 caracteres', () => {
    expect(listarRecorridosQuery.safeParse({ q: 'x'.repeat(61) }).success).toBe(false)
  })
})
