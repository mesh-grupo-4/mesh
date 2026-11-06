// Máquina de estados del simulador: pura, determinista, sin red ni GPS del visitante.
// Quién recibe cada aviso respeta RN-036: desvío y atraso solo al líder; posible incidente a todo
// el grupo salvo la persona afectada, que ve el banner "¿Estás bien?".
import { SIM } from '../content/copy'
import { INTEGRANTES_EJEMPLO } from './datos-ejemplo'

export type EstadoIntegrante = 'en_movimiento' | 'detenido_voluntario' | 'posible_incidente'
export type Incidencia = 'ninguna' | 'desvio' | 'atraso'

export interface Integrante {
  id: string
  nombre: string
  estado: EstadoIntegrante
  incidencia: Incidencia
  progreso: number // 0..1 sobre la cinta
  offset: number // separación lateral de la cinta
}

export type Evento =
  | { tipo: 'DESVIAR' | 'ATRASAR' | 'INICIAR_PARADA' | 'DETENCION_SIN_AVISO'; id: string }
  | { tipo: 'VOLVER' | 'FIN_PARADA' | 'ESTOY_BIEN' | 'ESTOY_MAL'; id: string }
  | { tipo: 'REINICIAR' }

export type Situacion = 'desvio' | 'atraso' | 'parada' | 'incidente'
export type Destinatarios = 'lider' | 'grupo' | 'grupo_salvo_afectado'
export type TipoAviso = 'desvio' | 'atraso' | 'parada' | 'posible_incidente' | 'peligro' | 'info'

export interface Aviso {
  tipo: TipoAviso
  texto: string
  detalle: string
  destinatarios: Destinatarios
  integranteId: string
}

export interface EstadoSim {
  integrantes: Integrante[]
  avisos: Aviso[]
  activa: Situacion | null
  /** Solo en la situación de Cami: ya respondió "Estoy mal" y el grupo va hacia ella. */
  ayudaEnCamino: boolean
  completadas: Situacion[]
}

export const TOTAL_SITUACIONES = 4
export const DESVIO_OFFSET = 74
export const ATRASO_PROGRESO = 0.15

export const estadoInicial = (): EstadoSim => ({
  integrantes: INTEGRANTES_EJEMPLO.map((i) => ({ ...i })),
  avisos: [],
  activa: null,
  ayudaEnCamino: false,
  completadas: [],
})

const inicialDe = (id: string) => INTEGRANTES_EJEMPLO.find((i) => i.id === id)

/** Deja a todos en su lugar y da por vista la situación que estuviera en curso. */
function cerrarActiva(e: EstadoSim): EstadoSim {
  return {
    ...e,
    integrantes: e.integrantes.map((i) => ({ ...(inicialDe(i.id) ?? i) })),
    activa: null,
    ayudaEnCamino: false,
    completadas: e.activa && !e.completadas.includes(e.activa) ? [...e.completadas, e.activa] : e.completadas,
  }
}

function modificar(e: EstadoSim, id: string, cambio: Partial<Integrante>): Integrante[] {
  return e.integrantes.map((i) => (i.id === id ? { ...i, ...cambio } : i))
}

function abrir(e: EstadoSim, situacion: Situacion, id: string, cambio: Partial<Integrante>, aviso: Omit<Aviso, 'integranteId'>): EstadoSim {
  const limpio = cerrarActiva(e)
  return {
    ...limpio,
    integrantes: modificar(limpio, id, cambio),
    activa: situacion,
    avisos: [{ ...aviso, integranteId: id }, ...limpio.avisos],
  }
}

export function reducir(e: EstadoSim, ev: Evento): EstadoSim {
  const s = SIM.situaciones
  switch (ev.tipo) {
    case 'DESVIAR':
      return abrir(e, 'desvio', ev.id, { incidencia: 'desvio', offset: DESVIO_OFFSET }, {
        tipo: 'desvio', texto: s.desvio.aviso, detalle: s.desvio.destino, destinatarios: 'lider',
      })
    case 'ATRASAR': {
      const inicial = inicialDe(ev.id)?.progreso ?? 0
      return abrir(e, 'atraso', ev.id, { incidencia: 'atraso', progreso: Math.max(0, inicial - ATRASO_PROGRESO) }, {
        tipo: 'atraso', texto: s.atraso.aviso, detalle: s.atraso.destino, destinatarios: 'lider',
      })
    }
    case 'INICIAR_PARADA':
      return abrir(e, 'parada', ev.id, { estado: 'detenido_voluntario' }, {
        tipo: 'parada', texto: s.parada.aviso, detalle: s.parada.destino, destinatarios: 'grupo',
      })
    case 'DETENCION_SIN_AVISO':
      return abrir(e, 'incidente', ev.id, { estado: 'posible_incidente' }, {
        tipo: 'posible_incidente', texto: s.incidente.aviso, detalle: `${s.incidente.detalle}. ${s.incidente.destino}`, destinatarios: 'grupo_salvo_afectado',
      })
    case 'VOLVER':
    case 'FIN_PARADA':
      return cerrarActiva(e)
    case 'ESTOY_BIEN': {
      const cerrado = cerrarActiva({ ...e, avisos: e.avisos.filter((a) => a.tipo !== 'posible_incidente') })
      return {
        ...cerrado,
        avisos: [{ tipo: 'info', texto: s.incidente.avisoBien, detalle: s.incidente.destino, destinatarios: 'grupo', integranteId: ev.id }, ...cerrado.avisos],
      }
    }
    case 'ESTOY_MAL':
      return {
        ...e,
        ayudaEnCamino: true,
        completadas: e.completadas.includes('incidente') ? e.completadas : [...e.completadas, 'incidente'],
        avisos: [{ tipo: 'peligro', texto: s.incidente.avisoMal, detalle: s.incidente.destino, destinatarios: 'grupo', integranteId: ev.id }, ...e.avisos],
      }
    case 'REINICIAR':
      return estadoInicial()
  }
}
