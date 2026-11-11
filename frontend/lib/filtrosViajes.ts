import { etiquetaActividad } from './activityDefaults'
import { coincideBusqueda, normalizarBusqueda } from './busqueda'
import { aCamposArg, desdeCamposArg } from './tiempoArg'
import type { ModoViajeApi, TipoActividadApi } from './viajesApi'

/**
 * Filtros de la pestaña Viajes. Se aplican en el cliente sobre las listas que ya
 * trae la pantalla: son los viajes de la propia persona, así que no hace falta
 * paginar ni filtrar en el backend.
 */

export type PestanaViajes = 'mis_viajes' | 'pasados'

export type Formato = 'todos' | 'solo' | 'grupal'
export type Rol = 'todos' | 'creador' | 'participante'
export type PeriodoProximos = 'todos' | 'hoy' | '7d' | '30d'
export type PeriodoPasados = 'todos' | '30d' | '90d' | 'anio'
export type EstadoProximos = 'todos' | 'en_curso' | 'planificado'
export type OrdenPasados = 'recientes' | 'antiguos' | 'distancia'

export type FiltrosViajes = {
  /** Vacío = todas. */
  actividades: TipoActividadApi[]
  /** Vacío = todos. */
  modos: ModoViajeApi[]
  formato: Formato
  rol: Rol
  /** Solo en "Mis viajes". */
  periodoProximos: PeriodoProximos
  estadoProximos: EstadoProximos
  /** Solo en "Viajes pasados". */
  periodoPasados: PeriodoPasados
  ordenPasados: OrdenPasados
}

export const FILTROS_INICIALES: FiltrosViajes = {
  actividades: [],
  modos: [],
  formato: 'todos',
  rol: 'todos',
  periodoProximos: 'todos',
  estadoProximos: 'todos',
  periodoPasados: 'todos',
  ordenPasados: 'recientes',
}

export const ETIQUETA_MODO: Record<ModoViajeApi, string> = {
  recreativo: 'Recreativo',
  entrenamiento: 'Entrenamiento',
  competitivo: 'Competitivo',
}

export const ETIQUETA_FORMATO: Record<Exclude<Formato, 'todos'>, string> = {
  solo: 'Solo',
  grupal: 'Grupal',
}

export const ETIQUETA_ROL: Record<Exclude<Rol, 'todos'>, string> = {
  creador: 'Organizo yo',
  participante: 'Participo',
}

export const ETIQUETA_PERIODO_PROXIMOS: Record<Exclude<PeriodoProximos, 'todos'>, string> = {
  hoy: 'Hoy',
  '7d': 'Próximos 7 días',
  '30d': 'Próximos 30 días',
}

export const ETIQUETA_PERIODO_PASADOS: Record<Exclude<PeriodoPasados, 'todos'>, string> = {
  '30d': 'Último mes',
  '90d': 'Últimos 3 meses',
  anio: 'Este año',
}

export const ETIQUETA_ESTADO_PROXIMOS: Record<Exclude<EstadoProximos, 'todos'>, string> = {
  en_curso: 'En curso',
  planificado: 'Planificados',
}

export const ETIQUETA_ORDEN_PASADOS: Record<OrdenPasados, string> = {
  recientes: 'Más recientes',
  antiguos: 'Más antiguos',
  distancia: 'Mayor distancia',
}

type ViajeFiltrable = {
  nombre?: string | null
  tipo_actividad: TipoActividadApi
  modo?: ModoViajeApi
  es_grupal: boolean
  mi_estado: string | null
  estado: string
  fecha_programada: string
  fecha_fin_real?: string | null
}

const DIA_MS = 86_400_000

/** Medianoche (hora argentina, RN-105) del día de `instante` más `dias`. */
function inicioDiaArg(instante: number, dias = 0): number {
  const campos = aCamposArg(new Date(instante))
  campos.setHours(0, 0, 0, 0)
  campos.setDate(campos.getDate() + dias)
  return desdeCamposArg(campos).getTime()
}

function enPeriodoProximos(v: ViajeFiltrable, periodo: PeriodoProximos, ahora: number): boolean {
  // Un viaje en curso es "ahora": entra en cualquier período.
  if (periodo === 'todos' || v.estado === 'en_curso') return true
  const diasHasta = { hoy: 1, '7d': 7, '30d': 30 }[periodo]
  return new Date(v.fecha_programada).getTime() < inicioDiaArg(ahora, diasHasta)
}

function enPeriodoPasados(v: ViajeFiltrable, periodo: PeriodoPasados, ahora: number): boolean {
  if (periodo === 'todos') return true
  const referencia = new Date(v.fecha_fin_real ?? v.fecha_programada).getTime()
  if (periodo === 'anio') {
    const campos = aCamposArg(new Date(ahora))
    return referencia >= desdeCamposArg(new Date(campos.getFullYear(), 0, 1)).getTime()
  }
  const dias = periodo === '30d' ? 30 : 90
  return referencia >= ahora - dias * DIA_MS
}

/** Filtros que no dependen de la pestaña, más búsqueda por nombre o actividad. */
function coincideComunes(v: ViajeFiltrable, f: FiltrosViajes, consulta: string): boolean {
  if (!coincideBusqueda(consulta, [v.nombre, etiquetaActividad(v.tipo_actividad)])) return false
  if (f.actividades.length > 0 && !f.actividades.includes(v.tipo_actividad)) return false
  // Viajes viejos sin modo: el default de la base es recreativo.
  if (f.modos.length > 0 && !f.modos.includes(v.modo ?? 'recreativo')) return false
  if (f.formato === 'solo' && v.es_grupal) return false
  if (f.formato === 'grupal' && !v.es_grupal) return false
  if (f.rol === 'creador' && v.mi_estado !== 'creador') return false
  if (f.rol === 'participante' && (v.mi_estado === 'creador' || v.mi_estado === null)) return false
  return true
}

export function filtrarProximos<T extends ViajeFiltrable>(
  lista: T[],
  f: FiltrosViajes,
  busqueda: string,
  ahora = Date.now()
): T[] {
  const consulta = normalizarBusqueda(busqueda)
  return lista.filter(
    (v) =>
      coincideComunes(v, f, consulta) &&
      (f.estadoProximos === 'todos' || v.estado === f.estadoProximos) &&
      enPeriodoProximos(v, f.periodoProximos, ahora)
  )
}

/** Para los no realizados (planificados vencidos) y los finalizados. */
export function filtrarPasados<T extends ViajeFiltrable>(
  lista: T[],
  f: FiltrosViajes,
  busqueda: string,
  ahora = Date.now()
): T[] {
  const consulta = normalizarBusqueda(busqueda)
  return lista.filter((v) => coincideComunes(v, f, consulta) && enPeriodoPasados(v, f.periodoPasados, ahora))
}

/**
 * Orden de los finalizados. "Mayor distancia" es la distancia propia de cada viaje,
 * nunca una comparación con otras personas ni por velocidad (RN-070). Sin traza GPS, al final.
 */
export function ordenarFinalizados<
  T extends { fecha_programada: string; fecha_fin_real: string | null; mi_distancia_m: number | null },
>(lista: T[], orden: OrdenPasados): T[] {
  const fecha = (v: T) => new Date(v.fecha_fin_real ?? v.fecha_programada).getTime()
  const copia = [...lista]
  if (orden === 'distancia') {
    return copia.sort(
      (a, b) => (b.mi_distancia_m ?? -1) - (a.mi_distancia_m ?? -1) || fecha(b) - fecha(a)
    )
  }
  return copia.sort((a, b) => (orden === 'antiguos' ? fecha(a) - fecha(b) : fecha(b) - fecha(a)))
}

/** Un filtro aplicado, para mostrarlo como pastilla y poder quitarlo de a uno. */
export type FiltroActivo = { clave: string; etiqueta: string; quitar: (f: FiltrosViajes) => FiltrosViajes }

function listaLegible(items: string[]): string {
  return items.length <= 2 ? items.join(' y ') : `${items.slice(0, 2).join(', ')} +${items.length - 2}`
}

/**
 * Filtros activos de la pestaña, en el orden en que aparecen en la hoja. El orden de
 * los pasados no cuenta: no oculta viajes.
 */
export function filtrosActivos(f: FiltrosViajes, pestana: PestanaViajes): FiltroActivo[] {
  const activos: FiltroActivo[] = []
  if (f.actividades.length > 0) {
    activos.push({
      clave: 'actividades',
      etiqueta: listaLegible(f.actividades.map(etiquetaActividad)),
      quitar: (x) => ({ ...x, actividades: [] }),
    })
  }
  if (f.modos.length > 0) {
    activos.push({
      clave: 'modos',
      etiqueta: listaLegible(f.modos.map((m) => ETIQUETA_MODO[m])),
      quitar: (x) => ({ ...x, modos: [] }),
    })
  }
  if (f.formato !== 'todos') {
    activos.push({
      clave: 'formato',
      etiqueta: ETIQUETA_FORMATO[f.formato],
      quitar: (x) => ({ ...x, formato: 'todos' }),
    })
  }
  if (f.rol !== 'todos') {
    activos.push({ clave: 'rol', etiqueta: ETIQUETA_ROL[f.rol], quitar: (x) => ({ ...x, rol: 'todos' }) })
  }
  if (pestana === 'mis_viajes') {
    if (f.estadoProximos !== 'todos') {
      activos.push({
        clave: 'estado',
        etiqueta: ETIQUETA_ESTADO_PROXIMOS[f.estadoProximos],
        quitar: (x) => ({ ...x, estadoProximos: 'todos' }),
      })
    }
    if (f.periodoProximos !== 'todos') {
      activos.push({
        clave: 'periodo',
        etiqueta: ETIQUETA_PERIODO_PROXIMOS[f.periodoProximos],
        quitar: (x) => ({ ...x, periodoProximos: 'todos' }),
      })
    }
  } else if (f.periodoPasados !== 'todos') {
    activos.push({
      clave: 'periodo',
      etiqueta: ETIQUETA_PERIODO_PASADOS[f.periodoPasados],
      quitar: (x) => ({ ...x, periodoPasados: 'todos' }),
    })
  }
  return activos
}

/** Limpia los filtros de la pestaña. El orden de los pasados se conserva: no es un filtro. */
export function limpiarFiltros(f: FiltrosViajes): FiltrosViajes {
  return { ...FILTROS_INICIALES, ordenPasados: f.ordenPasados }
}

/** Agrega o saca un valor de una selección múltiple. */
export function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]
}
