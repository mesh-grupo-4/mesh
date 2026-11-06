import { describe, expect, it } from 'vitest'
import { estadoInicial, reducir, TOTAL_SITUACIONES, type EstadoSim, type Evento } from '../src/sim/estado'

const correr = (...eventos: Evento[]): EstadoSim => eventos.reduce(reducir, estadoInicial())
const persona = (e: EstadoSim, id: string) => e.integrantes.find((i) => i.id === id)!

describe('quién recibe cada aviso (RN-036)', () => {
  it('el desvío avisa solo al líder', () => {
    const e = correr({ tipo: 'DESVIAR', id: 'gonza' })
    expect(e.avisos[0]).toMatchObject({ tipo: 'desvio', destinatarios: 'lider', integranteId: 'gonza' })
    expect(persona(e, 'gonza').incidencia).toBe('desvio')
    expect(persona(e, 'gonza').offset).toBeGreaterThan(0)
  })

  it('el atraso avisa solo al líder', () => {
    const e = correr({ tipo: 'ATRASAR', id: 'flor' })
    expect(e.avisos[0]).toMatchObject({ tipo: 'atraso', destinatarios: 'lider' })
    expect(persona(e, 'flor').progreso).toBeLessThan(persona(estadoInicial(), 'flor').progreso)
  })

  it('la parada voluntaria avisa al grupo', () => {
    const e = correr({ tipo: 'INICIAR_PARADA', id: 'nico' })
    expect(e.avisos[0]).toMatchObject({ tipo: 'parada', destinatarios: 'grupo' })
    expect(persona(e, 'nico').estado).toBe('detenido_voluntario')
  })

  it('el posible incidente avisa a todo el grupo salvo a quien le pasa', () => {
    const e = correr({ tipo: 'DETENCION_SIN_AVISO', id: 'cami' })
    expect(e.avisos[0]).toMatchObject({ tipo: 'posible_incidente', destinatarios: 'grupo_salvo_afectado' })
    expect(persona(e, 'cami').estado).toBe('posible_incidente')
  })
})

describe('salidas', () => {
  it('VOLVER resuelve el desvío', () => {
    const e = correr({ tipo: 'DESVIAR', id: 'gonza' }, { tipo: 'VOLVER', id: 'gonza' })
    expect(persona(e, 'gonza')).toEqual(persona(estadoInicial(), 'gonza'))
    expect(e.completadas).toEqual(['desvio'])
    expect(e.activa).toBeNull()
  })

  it('FIN_PARADA vuelve a poner en movimiento', () => {
    const e = correr({ tipo: 'INICIAR_PARADA', id: 'nico' }, { tipo: 'FIN_PARADA', id: 'nico' })
    expect(persona(e, 'nico').estado).toBe('en_movimiento')
  })

  it('ESTOY_BIEN cancela el posible incidente', () => {
    const e = correr({ tipo: 'DETENCION_SIN_AVISO', id: 'cami' }, { tipo: 'ESTOY_BIEN', id: 'cami' })
    expect(persona(e, 'cami').estado).toBe('en_movimiento')
    expect(e.avisos.some((a) => a.tipo === 'posible_incidente')).toBe(false)
    expect(e.avisos.some((a) => a.tipo === 'peligro')).toBe(false)
  })

  it('ESTOY_MAL genera una alerta de peligro para todo el grupo', () => {
    const e = correr({ tipo: 'DETENCION_SIN_AVISO', id: 'cami' }, { tipo: 'ESTOY_MAL', id: 'cami' })
    expect(e.avisos[0]).toMatchObject({ tipo: 'peligro', destinatarios: 'grupo', integranteId: 'cami' })
    expect(e.ayudaEnCamino).toBe(true)
    expect(e.completadas).toContain('incidente')
  })

  it('una situación nueva cierra la anterior', () => {
    const e = correr({ tipo: 'DESVIAR', id: 'gonza' }, { tipo: 'ATRASAR', id: 'flor' })
    expect(persona(e, 'gonza').incidencia).toBe('ninguna')
    expect(e.activa).toBe('atraso')
    expect(e.completadas).toEqual(['desvio'])
  })

  it('REINICIAR deja todo como al principio', () => {
    const e = correr({ tipo: 'DESVIAR', id: 'gonza' }, { tipo: 'DETENCION_SIN_AVISO', id: 'cami' }, { tipo: 'ESTOY_MAL', id: 'cami' }, { tipo: 'REINICIAR' })
    expect(e).toEqual(estadoInicial())
  })
})

describe('progreso', () => {
  it('las cuatro situaciones completan el simulador', () => {
    const e = correr(
      { tipo: 'DESVIAR', id: 'gonza' }, { tipo: 'VOLVER', id: 'gonza' },
      { tipo: 'ATRASAR', id: 'flor' }, { tipo: 'VOLVER', id: 'flor' },
      { tipo: 'INICIAR_PARADA', id: 'nico' }, { tipo: 'FIN_PARADA', id: 'nico' },
      { tipo: 'DETENCION_SIN_AVISO', id: 'cami' }, { tipo: 'ESTOY_BIEN', id: 'cami' },
    )
    expect(e.completadas).toHaveLength(TOTAL_SITUACIONES)
  })

  it('repetir una situación no cuenta dos veces', () => {
    const e = correr({ tipo: 'DESVIAR', id: 'gonza' }, { tipo: 'VOLVER', id: 'gonza' }, { tipo: 'DESVIAR', id: 'gonza' }, { tipo: 'VOLVER', id: 'gonza' })
    expect(e.completadas).toEqual(['desvio'])
  })

  it('el reductor es puro', () => {
    const inicial = estadoInicial()
    const copia = structuredClone(inicial)
    reducir(inicial, { tipo: 'DESVIAR', id: 'gonza' })
    expect(inicial).toEqual(copia)
  })
})
