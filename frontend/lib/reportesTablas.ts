import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

import type { Tabla } from '@/components/admin/charts'
import type {
  ReporteAdopcion,
  ReporteComunidad,
  ReporteCrecimiento,
  ReporteDestinos,
  ReporteGastos,
  ReporteResumen,
  ReporteRetencion,
  ReporteSeguridad,
  ReporteViajes,
} from './reportesApi'

/** Rótulos en castellano de los valores que devuelve la API. */
export const ROTULO: Record<string, string> = {
  moto: 'Moto',
  bici: 'Bici',
  running: 'Running',
  trekking: 'Trekking',
  otro: 'Otro',
  sin_definir: 'Sin definir',
  recreativo: 'Recreativo',
  entrenamiento: 'Entrenamiento',
  competitivo: 'Competitivo',
  qr: 'QR del viaje',
  link: 'Link de invitación',
  grupo: 'Desde un grupo',
  amigo: 'Invitación de un amigo',
  parada: 'Parada',
  combustible: 'Combustible',
  desvio: 'Desvío',
  peligro: 'Peligro',
  informacion: 'Información',
  atraso: 'Atraso',
  lider: 'Líder',
  integrante: 'Integrante',
  sistema: 'Sistema (automática)',
  activa: 'Activa',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
  resuelta: 'Resuelta',
  descanso: 'Descanso',
  gastronomia: 'Gastronomía',
  sanitario: 'Sanitario',
  accidente: 'Accidente',
  punto_control: 'Punto de control',
  sin_categoria: 'Sin categoría',
  ruta_planificada: 'Ruta planificada',
  checklist: 'Checklist de preparativos',
  paradas_voluntarias: 'Paradas voluntarias',
  alertas_manuales: 'Alertas manuales',
  solicitudes_parada: 'Solicitudes de parada',
  gastos: 'Gastos compartidos',
  ruta_compartida: 'Ruta compartida por link',
  modo_entrenamiento: 'Modo entrenamiento',
  modo_competitivo: 'Modo competitivo',
  consentimiento_vigente: 'Consentimiento de ubicación vigente',
  comparte_por_defecto: 'Comparte ubicación por defecto',
  notificaciones_push: 'Notificaciones push activas',
  actividad_preferida: 'Actividad preferida cargada',
}

export const rotulo = (v: string) => ROTULO[v] ?? v

const pct = (t: number | null) => (t == null ? null : Math.round(t * 1000) / 10)

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function tablasResumen(r: ReporteResumen): Tabla[] {
  const nombres: Record<keyof ReporteResumen['kpis'], string> = {
    altas: 'Altas de usuarios',
    usuarios_activos: 'Usuarios activos',
    viajes_iniciados: 'Viajes iniciados',
    viajes_finalizados: 'Viajes finalizados',
    km_recorridos: 'Km recorridos',
    horas_actividad: 'Horas de actividad',
    grupos_creados: 'Grupos creados',
    incidentes_detectados: 'Incidentes detectados',
  }
  return [
    {
      titulo: `Resumen ${r.periodo.desde} a ${r.periodo.hasta} (vs. ${r.periodo_anterior.desde} a ${r.periodo_anterior.hasta})`,
      columnas: ['Indicador', 'Actual', 'Anterior', 'Variación %'],
      filas: [
        ...(Object.keys(nombres) as (keyof typeof nombres)[]).map((k) => [
          nombres[k],
          r.kpis[k].actual,
          r.kpis[k].anterior,
          r.kpis[k].variacion_pct,
        ]),
        [
          'Tasa de realización (%)',
          pct(r.tasa_realizacion.actual),
          pct(r.tasa_realizacion.anterior),
          r.tasa_realizacion.variacion_pp,
        ],
      ],
    },
  ]
}

export function tablasCrecimiento(r: ReporteCrecimiento): Tabla[] {
  return [
    {
      titulo: 'Usuarios por período',
      columnas: ['Período', 'Altas', 'Activos', 'Total acumulado'],
      filas: r.serie.map((f) => [f.balde, f.altas, f.usuarios_activos, f.usuarios_totales]),
    },
    {
      titulo: 'Activación de cuentas nuevas',
      columnas: ['Altas', 'Activadas', 'Tasa %', 'Mediana días al 1er viaje'],
      filas: [
        [
          r.activacion.altas,
          r.activacion.activados,
          pct(r.activacion.tasa),
          r.activacion.mediana_dias_hasta_primer_viaje,
        ],
      ],
    },
    {
      titulo: 'Actividad preferida (todas las cuentas)',
      columnas: ['Actividad', 'Usuarios'],
      filas: r.actividad_preferida.map((f) => [rotulo(f.actividad), f.cantidad]),
    },
  ]
}

export function tablasRetencion(r: ReporteRetencion): Tabla[] {
  const meses = Math.max(0, ...r.cohortes.map((c) => c.retencion.length))
  return [
    {
      titulo: 'Retención por cohorte (% que participó en un viaje en el mes N desde el alta)',
      columnas: ['Cohorte', 'Altas', ...Array.from({ length: meses }, (_, k) => `Mes ${k}`)],
      filas: r.cohortes.map((c) => [c.cohorte, c.tamano, ...c.retencion.map(pct)]),
    },
  ]
}

export function tablasViajes(r: ReporteViajes): Tabla[] {
  return [
    {
      titulo: 'Viajes por período',
      columnas: ['Período', 'Creados', 'Iniciados', 'Finalizados'],
      filas: r.serie.map((f) => [f.balde, f.creados, f.iniciados, f.finalizados]),
    },
    {
      titulo: 'Por actividad (viajes iniciados)',
      columnas: ['Actividad', 'Viajes', 'Km total', 'Km promedio', 'Duración prom. (min)', 'Personas prom.'],
      filas: r.por_actividad.map((f) => [
        rotulo(f.actividad),
        f.viajes,
        f.km_total,
        f.km_promedio,
        f.duracion_promedio_min,
        f.personas_promedio,
      ]),
    },
    {
      titulo: 'Por modo',
      columnas: ['Modo', 'Viajes'],
      filas: r.por_modo.map((f) => [rotulo(f.modo), f.cantidad]),
    },
    {
      titulo: 'Tamaño de los viajes grupales',
      columnas: ['Personas', 'Viajes'],
      filas: r.tamano_grupo.map((f) => [f.rango, f.cantidad]),
    },
    {
      titulo: 'Embudo de viajes programados',
      columnas: ['Programados', 'Iniciados', 'Finalizados', 'No realizados', 'Tasa realización %'],
      filas: [
        [
          r.embudo.programados,
          r.embudo.iniciados,
          r.embudo.finalizados,
          r.embudo.no_realizados,
          pct(r.embudo.tasa_realizacion),
        ],
      ],
    },
    {
      titulo: 'Inicios por día y hora (hora argentina)',
      columnas: ['Día', 'Hora', 'Viajes'],
      filas: r.horarios.map((h) => [DIAS_SEMANA[h.dia_semana - 1], h.hora, h.cantidad]),
    },
  ]
}

export function tablasComunidad(r: ReporteComunidad): Tabla[] {
  const estados = (titulo: string, e: ReporteComunidad['invitaciones_grupo']): Tabla => ({
    titulo,
    columnas: ['Aceptadas', 'Rechazadas', 'Pendientes', 'Tasa aceptación %'],
    filas: [[e.aceptadas, e.rechazadas, e.pendientes, pct(e.tasa_aceptacion)]],
  })
  return [
    {
      titulo: 'Comunidad por período',
      columnas: ['Período', 'Grupos creados', 'Amistades nuevas', 'Rutas compartidas', 'Rutas importadas'],
      filas: r.serie.map((f) => [f.balde, f.grupos_creados, f.amistades_nuevas, f.rutas_compartidas, f.rutas_importadas]),
    },
    {
      titulo: 'Canales de incorporación a viajes',
      columnas: ['Canal', 'Personas'],
      filas: r.canales_incorporacion.map((f) => [rotulo(f.canal), f.cantidad]),
    },
    {
      titulo: 'Tamaño de los grupos',
      columnas: ['Integrantes', 'Grupos'],
      filas: r.grupos.distribucion_tamano.map((f) => [f.rango, f.cantidad]),
    },
    estados('Invitaciones a grupos', r.invitaciones_grupo),
    estados('Invitaciones a viajes', r.invitaciones_viaje),
    estados('Solicitudes de amistad', r.amistades.solicitudes_periodo),
  ]
}

export function tablasSeguridad(r: ReporteSeguridad): Tabla[] {
  return [
    {
      titulo: 'Alertas por tipo y origen',
      columnas: ['Tipo', 'Origen', 'Cantidad'],
      filas: r.alertas.por_tipo_y_origen.map((f) => [rotulo(f.tipo), rotulo(f.origen), f.cantidad]),
    },
    {
      titulo: 'Posibles incidentes por actividad',
      columnas: ['Actividad', 'Detectados', 'Falsas alarmas', 'Pidieron ayuda', 'Sin respuesta', 'Falsas alarmas %'],
      filas: r.incidentes.por_actividad.map((f) => [
        rotulo(f.actividad),
        f.detectados,
        f.falsas_alarmas,
        f.pidieron_ayuda,
        f.sin_respuesta,
        pct(f.tasa_falsas_alarmas),
      ]),
    },
    {
      titulo: 'Solicitudes de parada',
      columnas: ['Total', 'Aprobadas', 'Rechazadas', 'Canceladas', 'Pendientes', 'Aprobación %', 'Mediana respuesta (s)'],
      filas: [
        [
          r.solicitudes_parada.total,
          r.solicitudes_parada.aprobadas,
          r.solicitudes_parada.rechazadas,
          r.solicitudes_parada.canceladas,
          r.solicitudes_parada.pendientes,
          pct(r.solicitudes_parada.tasa_aprobacion),
          r.solicitudes_parada.mediana_respuesta_seg,
        ],
      ],
    },
    {
      titulo: 'Paradas voluntarias por categoría',
      columnas: ['Categoría', 'Paradas', 'Duración prom. (min)'],
      filas: r.paradas_voluntarias.map((f) => [rotulo(f.categoria), f.cantidad, f.duracion_promedio_min]),
    },
  ]
}

export function tablasDestinos(r: ReporteDestinos): Tabla[] {
  return [
    {
      titulo: `Destinos más elegidos (mínimo ${r.umbral_k_anonimato} creadores distintos)`,
      columnas: ['Destino', 'Viajes'],
      filas: r.top_destinos.map((f) => [f.lugar, f.viajes]),
    },
    {
      titulo: `Orígenes más elegidos (mínimo ${r.umbral_k_anonimato} creadores distintos)`,
      columnas: ['Origen', 'Viajes'],
      filas: r.top_origenes.map((f) => [f.lugar, f.viajes]),
    },
    {
      titulo: 'Distancia planeada',
      columnas: ['Rango', 'Viajes'],
      filas: r.distancia_planeada.map((f) => [f.rango, f.cantidad]),
    },
    {
      titulo: 'Paradas planificadas por categoría',
      columnas: ['Categoría', 'Paradas'],
      filas: r.paradas_planificadas_por_categoria.map((f) => [rotulo(f.categoria), f.cantidad]),
    },
  ]
}

export function tablasAdopcion(r: ReporteAdopcion): Tabla[] {
  return [
    {
      titulo: `Uso de funcionalidades (sobre ${r.viajes_iniciados} viajes iniciados)`,
      columnas: ['Funcionalidad', 'Viajes', '% de viajes'],
      filas: r.funcionalidades.map((f) => [rotulo(f.funcionalidad), f.viajes, pct(f.tasa)]),
    },
    {
      titulo: `Indicadores de cuentas (sobre ${r.usuarios.activos} cuentas activas)`,
      columnas: ['Indicador', 'Usuarios', '%'],
      filas: r.usuarios.indicadores.map((f) => [rotulo(f.indicador), f.usuarios, pct(f.tasa)]),
    },
    {
      titulo: 'Privacidad en viajes',
      columnas: ['Participaciones', 'Con ubicación apagada', '%'],
      filas: [
        [
          r.privacidad.participaciones,
          r.privacidad.con_ubicacion_apagada,
          pct(r.privacidad.tasa_ubicacion_apagada),
        ],
      ],
    },
  ]
}

export function tablasGastos(r: ReporteGastos): Tabla[] {
  return [
    {
      titulo: 'Gastos por período',
      columnas: ['Período', 'Monto'],
      filas: r.serie.map((f) => [f.balde, f.monto]),
    },
    {
      titulo: 'Gastos por actividad',
      columnas: ['Actividad', 'Viajes con gastos', 'Gastos', 'Monto total', 'Prom. por viaje', 'Prom. por persona'],
      filas: r.por_actividad.map((f) => [
        rotulo(f.actividad),
        f.viajes_con_gastos,
        f.gastos,
        f.monto_total,
        f.promedio_por_viaje,
        f.promedio_por_persona,
      ]),
    },
  ]
}

// ── CSV ───────────────────────────────────────────────────────────────────

/**
 * CSV pensado para abrir con Excel/Sheets configurados en castellano (Argentina):
 * separador `;`, coma decimal y BOM UTF-8 para que los acentos no se rompan.
 * Varias tablas en un mismo archivo, cada una con su título y una línea en blanco.
 */
export function aCsv(tablas: Tabla[]): string {
  const celda = (v: string | number | null) => {
    if (v == null) return ''
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const bloques = tablas.map((t) =>
    [celda(t.titulo), t.columnas.map(celda).join(';'), ...t.filas.map((f) => f.map(celda).join(';'))].join('\n')
  )
  return '﻿' + bloques.join('\n\n') + '\n'
}

export async function compartirCsv(nombre: string, tablas: Tabla[]): Promise<void> {
  const archivo = new File(Paths.cache, `${nombre}.csv`)
  archivo.create({ overwrite: true })
  archivo.write(aCsv(tablas))
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite compartir archivos.')
  }
  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'text/csv',
    dialogTitle: `Exportar ${nombre}`,
    UTI: 'public.comma-separated-values-text',
  })
}
