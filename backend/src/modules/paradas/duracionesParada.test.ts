import { describe, expect, it, vi } from 'vitest'
import {
  duracionesPorDefecto,
  obtenerDuracionesVigentes,
  tiempoParadasSeg,
} from './duracionesParada'

describe('duraciones de parada (RN-134)', () => {
  it('suma los minutos de cada parada según su categoría', () => {
    const d = duracionesPorDefecto()
    // gastronomía 45 + combustible 10 + gastronomía 45
    expect(tiempoParadasSeg(['gastronomia', 'combustible', 'gastronomia'], d)).toBe(100 * 60)
  })

  it('sin paradas no suma tiempo, y accidente no cuenta', () => {
    const d = duracionesPorDefecto()
    expect(tiempoParadasSeg([], d)).toBe(0)
    expect(tiempoParadasSeg(['accidente'], d)).toBe(0)
  })

  it('lo que definió el superadmin pisa al valor por defecto', async () => {
    const prisma = {
      duracionParada: {
        findMany: vi.fn().mockResolvedValue([{ categoria: 'gastronomia', minutos: 60 }]),
      },
    }
    const d = await obtenerDuracionesVigentes(prisma as never)
    expect(d.gastronomia).toBe(60)
    expect(d.combustible).toBe(10)
  })

  it('si la tabla no se puede leer, rigen los valores por defecto', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const prisma = {
      duracionParada: { findMany: vi.fn().mockRejectedValue(new Error('relation does not exist')) },
    }
    await expect(obtenerDuracionesVigentes(prisma as never)).resolves.toEqual(duracionesPorDefecto())
    warn.mockRestore()
  })
})
