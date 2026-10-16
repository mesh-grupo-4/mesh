import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/**
 * Reportería del backoffice (RN-127 a RN-131). Contrato en
 * `backend/openapi/paths/reportes.yaml`. Todo es agregado: sin datos personales,
 * sin posiciones y sin velocidades (RN-070).
 */

export type Granularidad = 'dia' | 'semana' | 'mes'
export type Actividad = 'moto' | 'bici' | 'running' | 'trekking' | 'otro'

export type FiltroReporte = {
  /** Fechas calendario en hora argentina (AAAA-MM-DD), ambas inclusive. */
  desde?: string
  hasta?: string
  granularidad?: Granularidad
  actividad?: Actividad
}

export type PeriodoReporte = { desde: string; hasta: string; granularidad: Granularidad }
export type Kpi = { actual: number; anterior: number; variacion_pct: number | null }
export type PorRango = { rango: string; cantidad: number }
export type PorEstado = { estado: string; cantidad: number }
export type ResumenEstados = {
  por_estado: PorEstado[]
  aceptadas: number
  rechazadas: number
  pendientes: number
  tasa_aceptacion: number | null
}

export type ReporteResumen = {
  periodo: PeriodoReporte
  periodo_anterior: PeriodoReporte
  kpis: Record<
    | 'altas'
    | 'usuarios_activos'
    | 'viajes_iniciados'
    | 'viajes_finalizados'
    | 'km_recorridos'
    | 'horas_actividad'
    | 'grupos_creados'
    | 'incidentes_detectados',
    Kpi
  >
  tasa_realizacion: { actual: number | null; anterior: number | null; variacion_pp: number | null }
}

export type ReporteCrecimiento = {
  periodo: PeriodoReporte
  serie: { balde: string; altas: number; usuarios_activos: number; usuarios_totales: number }[]
  activacion: {
    altas: number
    activados: number
    tasa: number | null
    mediana_dias_hasta_primer_viaje: number | null
  }
  actividad_preferida: { actividad: string; cantidad: number }[]
}

export type ReporteRetencion = {
  meses: number
  desde: string
  hasta: string
  cohortes: { cohorte: string; tamano: number; retencion: (number | null)[] }[]
}

export type ReporteViajes = {
  periodo: PeriodoReporte
  actividad: string | null
  serie: { balde: string; creados: number; iniciados: number; finalizados: number }[]
  por_actividad: {
    actividad: string
    viajes: number
    km_total: number | null
    km_promedio: number | null
    duracion_promedio_min: number | null
    personas_promedio: number | null
  }[]
  por_modo: { modo: string; cantidad: number }[]
  grupales_vs_individuales: { grupales: number; individuales: number }
  tamano_grupo: PorRango[]
  embudo: {
    programados: number
    iniciados: number
    finalizados: number
    no_realizados: number
    tasa_realizacion: number | null
  }
  horarios: { dia_semana: number; hora: number; cantidad: number }[]
}

export type ReporteComunidad = {
  periodo: PeriodoReporte
  serie: {
    balde: string
    grupos_creados: number
    amistades_nuevas: number
    rutas_compartidas: number
    rutas_importadas: number
  }[]
  grupos: {
    totales: number
    activos_en_periodo: number
    tasa_actividad: number | null
    tamano_promedio: number | null
    distribucion_tamano: PorRango[]
  }
  amistades: {
    aceptadas_totales: number
    amigos_promedio_por_usuario: number | null
    solicitudes_periodo: ResumenEstados
  }
  invitaciones_grupo: ResumenEstados
  invitaciones_viaje: ResumenEstados
  canales_incorporacion: { canal: string; cantidad: number }[]
}

type ConteoIncidentes = {
  detectados: number
  falsas_alarmas: number
  pidieron_ayuda: number
  sin_respuesta: number
  tasa_falsas_alarmas: number | null
}

export type ReporteSeguridad = {
  periodo: PeriodoReporte
  actividad: string | null
  alertas: {
    total: number
    cada_100_viajes: number | null
    por_tipo_y_origen: { tipo: string; origen: string; cantidad: number }[]
    por_estado: PorEstado[]
  }
  incidentes: ConteoIncidentes & {
    cada_100_viajes: number | null
    por_actividad: (ConteoIncidentes & { actividad: string })[]
  }
  solicitudes_parada: {
    total: number
    aprobadas: number
    rechazadas: number
    canceladas: number
    pendientes: number
    mediana_respuesta_seg: number | null
    tasa_aprobacion: number | null
  }
  paradas_voluntarias: { categoria: string; cantidad: number; duracion_promedio_min: number | null }[]
}

export type ReporteDestinos = {
  periodo: PeriodoReporte
  actividad: string | null
  umbral_k_anonimato: number
  top_destinos: { lugar: string; viajes: number }[]
  top_origenes: { lugar: string; viajes: number }[]
  distancia_planeada: PorRango[]
  paradas_planificadas_por_categoria: { categoria: string; cantidad: number }[]
}

export type ReporteAdopcion = {
  periodo: PeriodoReporte
  viajes_iniciados: number
  viajes_grupales: number
  funcionalidades: { funcionalidad: string; viajes: number; tasa: number | null }[]
  usuarios: { activos: number; indicadores: { indicador: string; usuarios: number; tasa: number | null }[] }
  privacidad: { participaciones: number; con_ubicacion_apagada: number; tasa_ubicacion_apagada: number | null }
}

export type ReporteGastos = {
  periodo: PeriodoReporte
  actividad: string | null
  resumen: {
    viajes_iniciados: number
    viajes_con_gastos: number
    tasa_uso: number | null
    gastos_registrados: number
    monto_total: number | null
    promedio_por_viaje: number | null
    promedio_por_persona: number | null
  }
  por_actividad: {
    actividad: string
    viajes_con_gastos: number
    gastos: number
    monto_total: number | null
    promedio_por_viaje: number | null
    promedio_por_persona: number | null
  }[]
  serie: { balde: string; monto: number }[]
}

function query(params: Record<string, string | number | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `?${qs}` : ''
}

async function get<T>(reporte: string, params: Record<string, string | number | undefined>): Promise<T> {
  return parseJson<T>(await meshFetchAuthed(apiUrl(`/api/admin/reportes/${reporte}${query(params)}`)))
}

/** Los reportes que no filtran por actividad no la reciben: la URL refleja lo que el reporte usa. */
function sinActividad({ actividad: _a, ...f }: FiltroReporte) {
  return f
}

export const reporteResumen = (f: FiltroReporte) => get<ReporteResumen>('resumen', sinActividad(f))
export const reporteCrecimiento = (f: FiltroReporte) =>
  get<ReporteCrecimiento>('crecimiento', sinActividad(f))
export const reporteRetencion = (meses: number) => get<ReporteRetencion>('retencion', { meses })
export const reporteViajes = (f: FiltroReporte) => get<ReporteViajes>('viajes', f)
export const reporteComunidad = (f: FiltroReporte) => get<ReporteComunidad>('comunidad', sinActividad(f))
export const reporteSeguridad = (f: FiltroReporte) =>
  get<ReporteSeguridad>('seguridad', { ...f, granularidad: undefined })
export const reporteDestinos = (f: FiltroReporte) =>
  get<ReporteDestinos>('destinos', { ...f, granularidad: undefined })
export const reporteAdopcion = (f: FiltroReporte) =>
  get<ReporteAdopcion>('adopcion', { ...sinActividad(f), granularidad: undefined })
export const reporteGastos = (f: FiltroReporte) => get<ReporteGastos>('gastos', f)
