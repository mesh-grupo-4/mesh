import { describe, expect, it } from 'vitest'
import { aReputacion, type FilaReputacion } from './recorridos-publicados.reputacion'

const AHORA = new Date('2026-11-09T15:00:00.000Z')

function insignia(codigo: string) {
  return { insignia: { codigo, nombre: codigo, icono: 'award' } }
}

function fila(overrides: Partial<FilaReputacion> = {}): FilaReputacion {
  return { id: 'u1', created_at: new Date('2026-11-01T00:00:00.000Z'), racha: null, insignias: [], ...overrides }
}

const RACHA_VIGENTE = (semanas: number) => ({
  semanas_consecutivas: semanas,
  ultima_actividad: new Date('2026-11-09T12:00:00.000Z'),
})

describe('aReputacion', () => {
  it('un autor nuevo es común', () => {
    expect(aReputacion(fila(), AHORA)).toEqual({
      miembro_desde: '2026-11-01T00:00:00.000Z',
      racha_semanas: 0,
      insignias_total: 0,
      insignias_destacadas: [],
      nivel: 'comun',
    })
  })

  it('una racha que ya se cortó no suma', () => {
    const r = aReputacion(
      fila({
        racha: {
          semanas_consecutivas: 12,
          ultima_actividad: new Date('2026-09-01T12:00:00.000Z'),
        },
      }),
      AHORA
    )
    expect(r).toMatchObject({ racha_semanas: 0, nivel: 'comun' })
  })

  it('con racha de 5 semanas es destacado', () => {
    expect(aReputacion(fila({ racha: RACHA_VIGENTE(5) }), AHORA).nivel).toBe('destacado')
  })

  it('racha larga más insignias raras es leyenda', () => {
    const r = aReputacion(
      fila({
        racha: RACHA_VIGENTE(10),
        insignias: [insignia('centurion_bici'), insignia('media_maraton')],
      }),
      AHORA
    )
    expect(r.nivel).toBe('leyenda')
  })

  it('muestra hasta 3 insignias, las raras primero', () => {
    const r = aReputacion(
      fila({
        insignias: [
          insignia('primer_recorrido'),
          insignia('hora_en_marcha'),
          insignia('diez_k_running'),
          insignia('trekker_resistente'),
        ],
      }),
      AHORA
    )
    expect(r.insignias_total).toBe(4)
    expect(r.insignias_destacadas.map((i) => i.codigo)).toEqual([
      'trekker_resistente',
      'primer_recorrido',
      'hora_en_marcha',
    ])
  })

  it('una insignia de moto nunca es rara (RN-070)', () => {
    const r = aReputacion(fila({ insignias: [insignia('rodador_100')] }), AHORA)
    expect(r.insignias_destacadas[0]).toMatchObject({ codigo: 'rodador_100', rara: false })
  })
})
