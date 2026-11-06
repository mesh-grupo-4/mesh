import { describe, expect, it } from 'vitest'
import { postPosicionesSchema, upsertUbicacionVivaSchema } from './viajes.schemas'

describe('datos extra del GPS en la validación de entrada', () => {
  const base = { lat: -31.42, lng: -64.18, recordedAt: '2026-08-31T12:00:00.000Z' }

  it('acepta pings sin datos extra (apps viejas)', () => {
    const r = upsertUbicacionVivaSchema.parse(base)
    expect(r.altitud).toBeUndefined()
    expect(r.velocidadKmh).toBeUndefined()
  })

  it('pasa los valores válidos tal cual', () => {
    const r = upsertUbicacionVivaSchema.parse({
      ...base,
      altitud: 452.3,
      precisionAltitud: 6.5,
      velocidadKmh: 21.6,
      rumbo: 87.5,
    })
    expect(r).toMatchObject({ altitud: 452.3, precisionAltitud: 6.5, velocidadKmh: 21.6, rumbo: 87.5 })
  })

  it('RN-038: un extra fuera de rango queda en null sin rechazar el lote', () => {
    const r = postPosicionesSchema.parse({
      source: 'offline_sync',
      posiciones: [
        { lat: -31.42, lng: -64.18, timestamp: '2026-08-31T12:00:00.000Z', velocidadKmh: 9999, rumbo: -1, altitud: 'x' },
      ],
    })
    expect(r.posiciones[0]).toMatchObject({ velocidadKmh: null, rumbo: null, altitud: null })
  })
})
