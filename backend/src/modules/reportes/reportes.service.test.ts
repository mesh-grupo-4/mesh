import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ReportesService } from './reportes.service'
import { resolverPeriodo } from './reportes.periodo'

function prismaCon(...respuestas: unknown[][]) {
  const queryRaw = vi.fn()
  for (const r of respuestas) queryRaw.mockResolvedValueOnce(r)
  return { prisma: { $queryRaw: queryRaw } as unknown as PrismaClient, queryRaw }
}

const kpis = (o: Partial<Record<string, number>> = {}) => ({
  altas: 0,
  usuarios_activos: 0,
  viajes_iniciados: 0,
  viajes_finalizados: 0,
  km_recorridos: 0,
  horas_actividad: 0,
  grupos_creados: 0,
  incidentes: 0,
  programados: 0,
  programados_realizados: 0,
  ...o,
})

describe('ReportesService.resumen', () => {
  it('compara cada KPI contra el período anterior', async () => {
    const { prisma } = prismaCon(
      [kpis({ altas: 30, km_recorridos: 1234.56, programados: 10, programados_realizados: 8 })],
      [kpis({ altas: 20, programados: 10, programados_realizados: 6 })]
    )
    const r = await new ReportesService(prisma).resumen(
      resolverPeriodo({ desde: '2026-10-01', hasta: '2026-10-10' })
    )
    expect(r.kpis.altas).toEqual({ actual: 30, anterior: 20, variacion_pct: 50 })
    expect(r.kpis.km_recorridos.actual).toBe(1234.6)
    expect(r.tasa_realizacion).toEqual({ actual: 0.8, anterior: 0.6, variacion_pp: 20 })
    expect(r.periodo_anterior).toMatchObject({ desde: '2026-09-21', hasta: '2026-09-30' })
  })
})

describe('ReportesService.crecimiento', () => {
  it('arma la serie completa con el acumulado de usuarios', async () => {
    const { prisma } = prismaCon(
      [{ balde: '2026-10-02', valor: 3 }],
      [{ balde: '2026-10-01', valor: 7 }],
      [{ total: 100 }],
      [{ altas: 3, activados: 2, mediana_dias: 1.26 }],
      [{ actividad: 'bici', cantidad: 50 }]
    )
    const r = await new ReportesService(prisma).crecimiento(
      resolverPeriodo({ desde: '2026-10-01', hasta: '2026-10-03' })
    )
    expect(r.serie).toEqual([
      { balde: '2026-10-01', altas: 0, usuarios_activos: 7, usuarios_totales: 100 },
      { balde: '2026-10-02', altas: 3, usuarios_activos: 0, usuarios_totales: 103 },
      { balde: '2026-10-03', altas: 0, usuarios_activos: 0, usuarios_totales: 103 },
    ])
    expect(r.activacion).toEqual({
      altas: 3,
      activados: 2,
      tasa: 0.6667,
      mediana_dias_hasta_primer_viaje: 1.3,
    })
  })
})

describe('salvaguardas', () => {
  const fuente = readFileSync(join(__dirname, 'reportes.service.ts'), 'utf8')

  // RN-070: la reportería no expone velocidades de ninguna actividad, así que no
  // hay forma de terminar comparando velocidades de motos en un tablero.
  it('ningún reporte lee columnas de velocidad', () => {
    expect(fuente).not.toMatch(/velocidad_(promedio|maxima|esperada)/)
  })

  // RN-126: el backoffice no vigila. Los reportes no tocan posiciones GPS.
  it('ningún reporte lee posiciones GPS ni ubicaciones vivas', () => {
    expect(fuente).not.toMatch(/registro_gps|ubicacion_viva|\blat\b|\blng\b/)
  })

  // RN-127: solo agregados, nunca datos que identifiquen personas.
  it('ningún reporte selecciona nombres ni emails', () => {
    expect(fuente).not.toMatch(/\b(u|usuario)\.(email|nombre|apellido|telefono)\b/)
  })
})
