import { describe, expect, it } from 'vitest'
import { TipoActividad } from '@prisma/client'
import { actualizarViajeSchema, createViajeSchema } from './viajes.schemas'

describe('fechaProgramada futura (RN-028)', () => {
  const base = {
    nombre: 'Salida test',
    esGrupal: false,
    tipoActividad: TipoActividad.bici,
  }

  it('rechaza fecha en el pasado al crear', () => {
    const pasada = new Date(Date.now() - 60_000).toISOString()
    const r = createViajeSchema.safeParse({ ...base, fechaProgramada: pasada })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('futura'))).toBe(true)
    }
  })

  it('rechaza fecha igual a ahora al crear', () => {
    const ahora = new Date().toISOString()
    const r = createViajeSchema.safeParse({ ...base, fechaProgramada: ahora })
    expect(r.success).toBe(false)
  })

  it('acepta fecha futura al crear', () => {
    const futura = new Date(Date.now() + 60 * 60_000).toISOString()
    const r = createViajeSchema.safeParse({ ...base, fechaProgramada: futura })
    expect(r.success).toBe(true)
  })

  it('rechaza fecha pasada al actualizar', () => {
    const pasada = new Date(Date.now() - 60_000).toISOString()
    const r = actualizarViajeSchema.safeParse({ fechaProgramada: pasada })
    expect(r.success).toBe(false)
  })
})
