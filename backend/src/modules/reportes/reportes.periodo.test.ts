import { describe, expect, it } from 'vitest'
import {
  armarMatrizCohortes,
  clavesSerie,
  completarSerie,
  diaArg,
  inicioBalde,
  periodoAnterior,
  resolverPeriodo,
  tasa,
  variacion,
} from './reportes.periodo'

describe('período en hora argentina (RN-105)', () => {
  it('a las 01:00 UTC todavía es el día anterior en Argentina', () => {
    expect(diaArg(new Date('2026-10-06T01:00:00.000Z'))).toBe('2026-10-05')
    expect(diaArg(new Date('2026-10-06T03:00:00.000Z'))).toBe('2026-10-06')
  })

  it('el período va de 00:00 ART del primer día a 00:00 ART del día siguiente al último', () => {
    const p = resolverPeriodo({ desde: '2026-10-01', hasta: '2026-10-15' })
    expect(p.desde.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(p.hasta.toISOString()).toBe('2026-10-16T03:00:00.000Z')
  })

  it('sin fechas toma los últimos 90 días hasta hoy (ART)', () => {
    const p = resolverPeriodo({}, new Date('2026-10-16T02:00:00.000Z'))
    expect(p.hastaDia).toBe('2026-10-15')
    expect(p.desdeDia).toBe('2026-07-18')
    expect(p.granularidad).toBe('semana')
  })

  it('elige la granularidad según la duración', () => {
    expect(resolverPeriodo({ desde: '2026-10-01', hasta: '2026-10-31' }).granularidad).toBe('dia')
    expect(resolverPeriodo({ desde: '2025-01-01', hasta: '2026-01-01' }).granularidad).toBe('mes')
    expect(resolverPeriodo({ desde: '2026-10-01', hasta: '2026-10-31', granularidad: 'mes' }).granularidad).toBe('mes')
  })

  it('el período anterior tiene la misma duración y termina donde empieza el actual', () => {
    const p = resolverPeriodo({ desde: '2026-10-01', hasta: '2026-10-10' })
    const a = periodoAnterior(p)
    expect(a.hasta).toEqual(p.desde)
    expect(a.desdeDia).toBe('2026-09-21')
    expect(a.hastaDia).toBe('2026-09-30')
  })
})

describe('series', () => {
  it('las semanas arrancan el lunes, igual que date_trunc', () => {
    expect(inicioBalde('2026-10-15', 'semana')).toBe('2026-10-12') // jueves → lunes
    expect(inicioBalde('2026-10-12', 'semana')).toBe('2026-10-12')
    expect(inicioBalde('2026-10-18', 'semana')).toBe('2026-10-12') // domingo
    expect(inicioBalde('2026-10-18', 'mes')).toBe('2026-10-01')
  })

  it('genera todas las claves del período, cruzando el cambio de año', () => {
    const p = resolverPeriodo({ desde: '2025-11-15', hasta: '2026-02-03', granularidad: 'mes' })
    expect(clavesSerie(p)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01'])
  })

  it('rellena con 0 los baldes sin datos', () => {
    const serie = completarSerie(['2026-01-01', '2026-02-01', '2026-03-01'], {
      altas: [{ balde: '2026-02-01', valor: 5 }],
      bajas: [{ balde: '2026-01-01', valor: 1 }],
    })
    expect(serie).toEqual([
      { balde: '2026-01-01', altas: 0, bajas: 1 },
      { balde: '2026-02-01', altas: 5, bajas: 0 },
      { balde: '2026-03-01', altas: 0, bajas: 0 },
    ])
  })
})

describe('tasas y variaciones', () => {
  it('sin base no inventa un 0 %', () => {
    expect(tasa(3, 0)).toBeNull()
    expect(variacion(10, 0)).toBeNull()
  })

  it('redondea', () => {
    expect(tasa(1, 3)).toBe(0.3333)
    expect(variacion(150, 100)).toBe(50)
    expect(variacion(50, 100)).toBe(-50)
  })
})

describe('matriz de cohortes', () => {
  it('calcula la retención por mes desde el alta y deja en null los meses futuros', () => {
    const matriz = armarMatrizCohortes(
      [
        { cohorte: '2026-08', tamano: 10 },
        { cohorte: '2026-10', tamano: 4 },
      ],
      [
        { cohorte: '2026-08', mes_offset: 0, activos: 5 },
        { cohorte: '2026-08', mes_offset: 2, activos: 2 },
        { cohorte: '2026-10', mes_offset: 0, activos: 1 },
      ],
      '2026-10'
    )
    expect(matriz).toEqual([
      { cohorte: '2026-08', tamano: 10, retencion: [0.5, 0, 0.2] },
      { cohorte: '2026-10', tamano: 4, retencion: [0.25, null, null] },
    ])
  })
})
