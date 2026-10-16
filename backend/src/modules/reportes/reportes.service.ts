import { Prisma, type PrismaClient } from '@prisma/client'
import { VERSION_CONSENTIMIENTO_UBICACION } from '../privacidad/privacidad.schemas'
import {
  armarMatrizCohortes,
  clavesSerie,
  completarSerie,
  diaArg,
  inicioDiaArg,
  kpi,
  periodoAnterior,
  redondear,
  tasa,
  type Granularidad,
  type Periodo,
} from './reportes.periodo'

/**
 * Reportería del backoffice (RN-127 a RN-131).
 *
 * Reglas que valen para TODOS los reportes de este archivo:
 * - Solo agregados: ningún reporte devuelve nombres, emails ni ids de personas.
 * - Sin velocidades de ningún tipo (RN-070): ni promedios por actividad ni
 *   comparaciones. Distancia y duración sí.
 * - Sin posiciones GPS (RN-126). Los lugares salen de los nombres de las rutas
 *   planificadas y solo si los usaron al menos K creadores distintos (RN-130).
 * - Baldes temporales en hora argentina (RN-105): `col - interval '3 hours'`.
 * - El cálculo se hace en PostgreSQL; acá solo se arma la respuesta.
 */

/** RN-130: un lugar aparece en el ranking solo si lo usaron K creadores distintos. */
export const UMBRAL_K_ANONIMATO = 3

type Fila = Record<string, unknown>

const UNIDAD: Record<Granularidad, string> = { dia: 'day', semana: 'week', mes: 'month' }

/**
 * Instante como `timestamp` UTC sin zona, el tipo de las columnas de Prisma. Se
 * castea explícito para no depender del `TimeZone` de la sesión de Postgres.
 */
function ts(d: Date) {
  return Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`
}

/** `col >= desde AND col < hasta`. */
function enPeriodo(col: string, p: { desde: Date; hasta: Date }) {
  return Prisma.sql`${Prisma.raw(col)} >= ${ts(p.desde)} AND ${Prisma.raw(col)} < ${ts(p.hasta)}`
}

/** Clave del balde (ART) al que pertenece `col`, como `YYYY-MM-DD`. */
function balde(col: string, g: Granularidad) {
  return Prisma.sql`to_char(date_trunc(${UNIDAD[g]}::text, ${Prisma.raw(col)} - interval '3 hours'), 'YYYY-MM-DD')`
}

function filtroActividad(actividad: string | undefined, col = 'v.tipo_actividad') {
  return actividad ? Prisma.sql`AND ${Prisma.raw(col)}::text = ${actividad}` : Prisma.empty
}

/**
 * Participaciones efectivas en viajes que arrancaron: el creador (aunque no tenga
 * fila en viaje_integrante, viajes legacy) más los integrantes confirmados o que
 * salieron a mitad de camino. Es la base de "usuario activo" (RN-131).
 */
const PARTICIPACIONES = Prisma.sql`
  participaciones AS (
    SELECT v.id AS viaje_id, v.creador_id AS usuario_id, v.fecha_inicio_real AS inicio,
           v.tipo_actividad::text AS actividad
    FROM viaje v
    WHERE v.fecha_inicio_real IS NOT NULL
    UNION
    SELECT v.id, vi.usuario_id, v.fecha_inicio_real, v.tipo_actividad::text
    FROM viaje_integrante vi
    JOIN viaje v ON v.id = vi.viaje_id
    WHERE v.fecha_inicio_real IS NOT NULL AND vi.estado IN ('confirmado', 'salido')
  )`

/** Viajes iniciados en el período con su cantidad de personas y su resumen. */
function viajesIniciados(p: Periodo, actividad?: string) {
  return Prisma.sql`
    iniciados AS (
      SELECT v.id, v.tipo_actividad::text AS actividad, v.modo::text AS modo, v.es_grupal,
             v.fecha_inicio_real, r.distancia_real_m, r.duracion_segundos,
             1 + (
               SELECT count(*) FROM viaje_integrante vi
               WHERE vi.viaje_id = v.id AND vi.usuario_id <> v.creador_id
                 AND vi.estado IN ('confirmado', 'salido')
             ) AS personas
      FROM viaje v
      LEFT JOIN resumen_viaje r ON r.viaje_id = v.id
      WHERE ${enPeriodo('v.fecha_inicio_real', p)} ${filtroActividad(actividad)}
    )`
}

function periodoRespuesta(p: Periodo) {
  return { desde: p.desdeDia, hasta: p.hastaDia, granularidad: p.granularidad }
}

/** Distribución en rangos, siempre con todos los rangos aunque estén vacíos. */
function distribucion(rangos: string[], filas: { rango: string; cantidad: number }[]) {
  const m = new Map(filas.map((f) => [f.rango, f.cantidad]))
  return rangos.map((rango) => ({ rango, cantidad: m.get(rango) ?? 0 }))
}

const RANGOS_PERSONAS = ['1', '2-5', '6-10', '11-20', '21-50', '51+']
const CASE_PERSONAS = (col: string) => Prisma.sql`
  CASE WHEN ${Prisma.raw(col)} <= 1 THEN '1'
       WHEN ${Prisma.raw(col)} <= 5 THEN '2-5'
       WHEN ${Prisma.raw(col)} <= 10 THEN '6-10'
       WHEN ${Prisma.raw(col)} <= 20 THEN '11-20'
       WHEN ${Prisma.raw(col)} <= 50 THEN '21-50'
       ELSE '51+' END`

const RANGOS_KM = ['< 10 km', '10-50 km', '50-100 km', '100-300 km', '300+ km']

export class ReportesService {
  constructor(private readonly prisma: PrismaClient) {}

  private q<T = Fila>(sql: Prisma.Sql): Promise<T[]> {
    return this.prisma.$queryRaw<T[]>(sql)
  }

  // ── Resumen ejecutivo ──────────────────────────────────────────────────────

  private async kpisCrudos(p: Periodo, ahora: Date) {
    const [fila] = await this.q<{
      altas: number
      usuarios_activos: number
      viajes_iniciados: number
      viajes_finalizados: number
      km_recorridos: number
      horas_actividad: number
      grupos_creados: number
      incidentes: number
      programados: number
      programados_realizados: number
    }>(Prisma.sql`
      SELECT
        (SELECT count(*)::int FROM usuario WHERE ${enPeriodo('created_at', p)}) AS altas,
        (WITH ${PARTICIPACIONES}
          SELECT count(DISTINCT usuario_id)::int FROM participaciones
          WHERE ${enPeriodo('inicio', p)}) AS usuarios_activos,
        (SELECT count(*)::int FROM viaje WHERE ${enPeriodo('fecha_inicio_real', p)}) AS viajes_iniciados,
        (SELECT count(*)::int FROM viaje WHERE ${enPeriodo('fecha_fin_real', p)}) AS viajes_finalizados,
        (SELECT (coalesce(sum(r.distancia_real_m), 0) / 1000)::float8
           FROM resumen_viaje r JOIN viaje v ON v.id = r.viaje_id
          WHERE ${enPeriodo('v.fecha_inicio_real', p)}) AS km_recorridos,
        (SELECT (coalesce(sum(r.duracion_segundos), 0) / 3600.0)::float8
           FROM resumen_viaje r JOIN viaje v ON v.id = r.viaje_id
          WHERE ${enPeriodo('v.fecha_inicio_real', p)}) AS horas_actividad,
        (SELECT count(*)::int FROM grupo WHERE ${enPeriodo('fecha_creacion', p)}) AS grupos_creados,
        (SELECT count(*)::int FROM parada
          WHERE tipo = 'incidente_detectado' AND ${enPeriodo('inicio', p)}) AS incidentes,
        (SELECT count(*)::int FROM viaje
          WHERE ${enPeriodo('fecha_programada', p)} AND fecha_programada < ${ts(ahora)}) AS programados,
        (SELECT count(*)::int FROM viaje
          WHERE ${enPeriodo('fecha_programada', p)} AND fecha_programada < ${ts(ahora)}
            AND fecha_inicio_real IS NOT NULL) AS programados_realizados
    `)
    return fila
  }

  /** KPIs del período contra el período anterior de igual duración. */
  async resumen(p: Periodo, ahora = new Date()) {
    const anterior = periodoAnterior(p)
    const [a, b] = await Promise.all([this.kpisCrudos(p, ahora), this.kpisCrudos(anterior, ahora)])
    const realizacionA = tasa(a.programados_realizados, a.programados)
    const realizacionB = tasa(b.programados_realizados, b.programados)
    return {
      periodo: periodoRespuesta(p),
      periodo_anterior: periodoRespuesta(anterior),
      kpis: {
        altas: kpi(a.altas, b.altas),
        usuarios_activos: kpi(a.usuarios_activos, b.usuarios_activos),
        viajes_iniciados: kpi(a.viajes_iniciados, b.viajes_iniciados),
        viajes_finalizados: kpi(a.viajes_finalizados, b.viajes_finalizados),
        km_recorridos: kpi(redondear(a.km_recorridos)!, redondear(b.km_recorridos)!),
        horas_actividad: kpi(redondear(a.horas_actividad)!, redondear(b.horas_actividad)!),
        grupos_creados: kpi(a.grupos_creados, b.grupos_creados),
        incidentes_detectados: kpi(a.incidentes, b.incidentes),
      },
      tasa_realizacion: {
        actual: realizacionA,
        anterior: realizacionB,
        variacion_pp:
          realizacionA != null && realizacionB != null
            ? redondear((realizacionA - realizacionB) * 100)
            : null,
      },
    }
  }

  // ── Crecimiento y activación ───────────────────────────────────────────────

  async crecimiento(p: Periodo) {
    const g = p.granularidad
    const [altas, activos, [base], [activacion], actividad] = await Promise.all([
      this.q<{ balde: string; valor: number }>(Prisma.sql`
        SELECT ${balde('created_at', g)} AS balde, count(*)::int AS valor
        FROM usuario WHERE ${enPeriodo('created_at', p)} GROUP BY 1`),
      this.q<{ balde: string; valor: number }>(Prisma.sql`
        WITH ${PARTICIPACIONES}
        SELECT ${balde('inicio', g)} AS balde, count(DISTINCT usuario_id)::int AS valor
        FROM participaciones WHERE ${enPeriodo('inicio', p)} GROUP BY 1`),
      this.q<{ total: number }>(Prisma.sql`
        SELECT count(*)::int AS total FROM usuario WHERE created_at < ${ts(p.desde)}`),
      this.q<{ altas: number; activados: number; mediana_dias: number | null }>(Prisma.sql`
        WITH ${PARTICIPACIONES},
        primera AS (SELECT usuario_id, min(inicio) AS primera FROM participaciones GROUP BY 1)
        SELECT count(*)::int AS altas,
               count(pr.primera)::int AS activados,
               percentile_cont(0.5) WITHIN GROUP (
                 ORDER BY GREATEST(0, extract(epoch FROM pr.primera - u.created_at) / 86400.0)
               )::float8 AS mediana_dias
        FROM usuario u LEFT JOIN primera pr ON pr.usuario_id = u.id
        WHERE ${enPeriodo('u.created_at', p)}`),
      this.q<{ actividad: string; cantidad: number }>(Prisma.sql`
        SELECT coalesce(actividad_preferida::text, 'sin_definir') AS actividad, count(*)::int AS cantidad
        FROM usuario GROUP BY 1 ORDER BY 2 DESC`),
    ])

    let acumulado = base.total
    const serie = completarSerie(clavesSerie(p), { altas, usuarios_activos: activos }).map((f) => {
      acumulado += f.altas
      return { ...f, usuarios_totales: acumulado }
    })

    return {
      periodo: periodoRespuesta(p),
      serie,
      activacion: {
        altas: activacion.altas,
        activados: activacion.activados,
        tasa: tasa(activacion.activados, activacion.altas),
        mediana_dias_hasta_primer_viaje: redondear(activacion.mediana_dias),
      },
      actividad_preferida: actividad,
    }
  }

  // ── Retención por cohortes ─────────────────────────────────────────────────

  async retencion(meses: number, ahora = new Date()) {
    const mesActual = diaArg(ahora).slice(0, 7)
    const [anio, mes] = mesActual.split('-').map(Number)
    const indiceInicio = anio * 12 + (mes - 1) - (meses - 1)
    const mesInicio = `${Math.floor(indiceInicio / 12)}-${String((indiceInicio % 12) + 1).padStart(2, '0')}`
    const inicio = inicioDiaArg(`${mesInicio}-01`)

    const cohortesSql = Prisma.sql`
      cohortes AS (
        SELECT id, date_trunc('month', created_at - interval '3 hours') AS mes
        FROM usuario WHERE created_at >= ${ts(inicio)}
      )`

    const [cohortes, actividad] = await Promise.all([
      this.q<{ cohorte: string; tamano: number }>(Prisma.sql`
        WITH ${cohortesSql}
        SELECT to_char(mes, 'YYYY-MM') AS cohorte, count(*)::int AS tamano
        FROM cohortes GROUP BY 1 ORDER BY 1`),
      this.q<{ cohorte: string; mes_offset: number; activos: number }>(Prisma.sql`
        WITH ${cohortesSql}, ${PARTICIPACIONES},
        actividad AS (
          SELECT DISTINCT usuario_id, date_trunc('month', inicio - interval '3 hours') AS mes
          FROM participaciones WHERE inicio >= ${ts(inicio)}
        )
        SELECT to_char(c.mes, 'YYYY-MM') AS cohorte,
               ((extract(year FROM a.mes) * 12 + extract(month FROM a.mes))
                 - (extract(year FROM c.mes) * 12 + extract(month FROM c.mes)))::int AS mes_offset,
               count(DISTINCT a.usuario_id)::int AS activos
        FROM cohortes c
        JOIN actividad a ON a.usuario_id = c.id AND a.mes >= c.mes
        GROUP BY 1, 2`),
    ])

    return {
      meses,
      desde: mesInicio,
      hasta: mesActual,
      cohortes: armarMatrizCohortes(cohortes, actividad, mesActual),
    }
  }

  // ── Viajes y uso del producto ──────────────────────────────────────────────

  async viajes(p: Periodo, actividad?: string, ahora = new Date()) {
    const g = p.granularidad
    const fa = filtroActividad(actividad, 'tipo_actividad')
    const serieDe = (col: string) =>
      this.q<{ balde: string; valor: number }>(Prisma.sql`
        SELECT ${balde(col, g)} AS balde, count(*)::int AS valor
        FROM viaje WHERE ${enPeriodo(col, p)} ${fa} GROUP BY 1`)

    const [creados, iniciados, finalizados, porActividad, porModo, tamanos, [embudo], horarios] =
      await Promise.all([
        serieDe('created_at'),
        serieDe('fecha_inicio_real'),
        serieDe('fecha_fin_real'),
        this.q<{
          actividad: string
          viajes: number
          km_total: number
          km_promedio: number | null
          duracion_promedio_min: number | null
          personas_promedio: number | null
        }>(Prisma.sql`
          WITH ${viajesIniciados(p, actividad)}
          SELECT actividad, count(*)::int AS viajes,
                 (coalesce(sum(distancia_real_m), 0) / 1000)::float8 AS km_total,
                 (avg(distancia_real_m) / 1000)::float8 AS km_promedio,
                 (avg(duracion_segundos) / 60)::float8 AS duracion_promedio_min,
                 avg(personas)::float8 AS personas_promedio
          FROM iniciados GROUP BY 1 ORDER BY 2 DESC`),
        this.q<{ modo: string; es_grupal: boolean; cantidad: number }>(Prisma.sql`
          WITH ${viajesIniciados(p, actividad)}
          SELECT modo, es_grupal, count(*)::int AS cantidad FROM iniciados GROUP BY 1, 2`),
        this.q<{ rango: string; cantidad: number }>(Prisma.sql`
          WITH ${viajesIniciados(p, actividad)}
          SELECT ${CASE_PERSONAS('personas')} AS rango, count(*)::int AS cantidad
          FROM iniciados WHERE es_grupal GROUP BY 1`),
        this.q<{ programados: number; iniciados: number; finalizados: number; no_realizados: number }>(
          Prisma.sql`
          SELECT count(*)::int AS programados,
                 count(*) FILTER (WHERE fecha_inicio_real IS NOT NULL)::int AS iniciados,
                 count(*) FILTER (WHERE estado = 'finalizado')::int AS finalizados,
                 count(*) FILTER (WHERE estado = 'planificado')::int AS no_realizados
          FROM viaje
          WHERE ${enPeriodo('fecha_programada', p)} AND fecha_programada < ${ts(ahora)} ${fa}`
        ),
        this.q<{ dia_semana: number; hora: number; cantidad: number }>(Prisma.sql`
          SELECT extract(isodow FROM fecha_inicio_real - interval '3 hours')::int AS dia_semana,
                 extract(hour FROM fecha_inicio_real - interval '3 hours')::int AS hora,
                 count(*)::int AS cantidad
          FROM viaje WHERE ${enPeriodo('fecha_inicio_real', p)} ${fa}
          GROUP BY 1, 2 ORDER BY 1, 2`),
      ])

    const modos = new Map<string, number>()
    let grupales = 0
    let individuales = 0
    for (const f of porModo) {
      modos.set(f.modo, (modos.get(f.modo) ?? 0) + f.cantidad)
      if (f.es_grupal) grupales += f.cantidad
      else individuales += f.cantidad
    }

    return {
      periodo: periodoRespuesta(p),
      actividad: actividad ?? null,
      serie: completarSerie(clavesSerie(p), { creados, iniciados, finalizados }),
      por_actividad: porActividad.map((f) => ({
        actividad: f.actividad,
        viajes: f.viajes,
        km_total: redondear(f.km_total),
        km_promedio: redondear(f.km_promedio),
        duracion_promedio_min: redondear(f.duracion_promedio_min, 0),
        personas_promedio: redondear(f.personas_promedio),
      })),
      por_modo: ['recreativo', 'entrenamiento', 'competitivo'].map((modo) => ({
        modo,
        cantidad: modos.get(modo) ?? 0,
      })),
      grupales_vs_individuales: { grupales, individuales },
      tamano_grupo: distribucion(RANGOS_PERSONAS, tamanos),
      embudo: { ...embudo, tasa_realizacion: tasa(embudo.iniciados, embudo.programados) },
      horarios,
    }
  }

  // ── Comunidad y crecimiento viral ──────────────────────────────────────────

  async comunidad(p: Periodo) {
    const g = p.granularidad
    const serieDe = (tabla: string, col: string, extra = Prisma.empty) =>
      this.q<{ balde: string; valor: number }>(Prisma.sql`
        SELECT ${balde(col, g)} AS balde, count(*)::int AS valor
        FROM ${Prisma.raw(tabla)} WHERE ${enPeriodo(col, p)} ${extra} GROUP BY 1`)
    const porEstado = (sql: Prisma.Sql) => this.q<{ estado: string; cantidad: number }>(sql)

    const [
      grupos,
      amistades,
      links,
      importaciones,
      tamanos,
      [snapshot],
      invGrupo,
      invViaje,
      solicitudesAmistad,
      canales,
    ] = await Promise.all([
      serieDe('grupo', 'fecha_creacion'),
      serieDe('amistad', 'created_at', Prisma.sql`AND estado = 'aceptada'`),
      serieDe('ruta_compartida', 'created_at'),
      serieDe('ruta_plantilla', 'created_at'),
      this.q<{ rango: string; cantidad: number }>(Prisma.sql`
        WITH t AS (SELECT grupo_id, count(*) AS n FROM grupo_miembro GROUP BY 1)
        SELECT ${CASE_PERSONAS('n')} AS rango, count(*)::int AS cantidad FROM t GROUP BY 1`),
      this.q<{
        grupos_totales: number
        tamano_promedio: number | null
        grupos_activos: number
        amistades_aceptadas: number
        usuarios: number
      }>(Prisma.sql`
        SELECT
          (SELECT count(*)::int FROM grupo) AS grupos_totales,
          (SELECT avg(n)::float8 FROM (SELECT count(*) AS n FROM grupo_miembro GROUP BY grupo_id) t) AS tamano_promedio,
          (SELECT count(DISTINCT vg.grupo_id)::int FROM viaje_grupo vg JOIN viaje v ON v.id = vg.viaje_id
            WHERE ${enPeriodo('v.fecha_inicio_real', p)}) AS grupos_activos,
          (SELECT count(*)::int FROM amistad WHERE estado = 'aceptada') AS amistades_aceptadas,
          (SELECT count(*)::int FROM usuario) AS usuarios`),
      porEstado(Prisma.sql`
        SELECT estado::text AS estado, count(*)::int AS cantidad
        FROM grupo_invitacion WHERE ${enPeriodo('created_at', p)} GROUP BY 1`),
      porEstado(Prisma.sql`
        SELECT estado::text AS estado, count(*)::int AS cantidad
        FROM viaje_integrante
        WHERE ${enPeriodo('created_at', p)} AND origen IN ('grupo', 'amigo') GROUP BY 1`),
      porEstado(Prisma.sql`
        SELECT estado::text AS estado, count(*)::int AS cantidad
        FROM amistad WHERE ${enPeriodo('created_at', p)} GROUP BY 1`),
      this.q<{ canal: string; cantidad: number }>(Prisma.sql`
        SELECT origen::text AS canal, count(*)::int AS cantidad
        FROM viaje_integrante
        WHERE ${enPeriodo('created_at', p)} AND origen <> 'creador' GROUP BY 1 ORDER BY 2 DESC`),
    ])

    const resumirEstados = (filas: { estado: string; cantidad: number }[], aceptado: string[]) => {
      const m = Object.fromEntries(filas.map((f) => [f.estado, f.cantidad])) as Record<string, number>
      const aceptadas = aceptado.reduce((s, e) => s + (m[e] ?? 0), 0)
      const rechazadas = (m.rechazada ?? 0) + (m.rechazado ?? 0)
      return {
        por_estado: filas,
        aceptadas,
        rechazadas,
        pendientes: m.pendiente ?? 0,
        tasa_aceptacion: tasa(aceptadas, aceptadas + rechazadas),
      }
    }

    return {
      periodo: periodoRespuesta(p),
      serie: completarSerie(clavesSerie(p), {
        grupos_creados: grupos,
        amistades_nuevas: amistades,
        rutas_compartidas: links,
        rutas_importadas: importaciones,
      }),
      grupos: {
        totales: snapshot.grupos_totales,
        activos_en_periodo: snapshot.grupos_activos,
        tasa_actividad: tasa(snapshot.grupos_activos, snapshot.grupos_totales),
        tamano_promedio: redondear(snapshot.tamano_promedio),
        distribucion_tamano: distribucion(RANGOS_PERSONAS, tamanos),
      },
      amistades: {
        aceptadas_totales: snapshot.amistades_aceptadas,
        amigos_promedio_por_usuario: redondear(
          snapshot.usuarios ? (2 * snapshot.amistades_aceptadas) / snapshot.usuarios : null
        ),
        solicitudes_periodo: resumirEstados(solicitudesAmistad, ['aceptada']),
      },
      invitaciones_grupo: resumirEstados(invGrupo, ['aceptada']),
      invitaciones_viaje: resumirEstados(invViaje, ['confirmado', 'salido']),
      canales_incorporacion: canales,
    }
  }

  // ── Seguridad y operación ──────────────────────────────────────────────────

  async seguridad(p: Periodo, actividad?: string) {
    const fa = filtroActividad(actividad)
    const [alertas, alertasEstado, incidentes, [solicitudes], paradas, [{ viajes }]] = await Promise.all([
      this.q<{ tipo: string; origen: string; cantidad: number }>(Prisma.sql`
        SELECT a.tipo::text AS tipo, a.origen::text AS origen, count(*)::int AS cantidad
        FROM alerta a JOIN viaje v ON v.id = a.viaje_id
        WHERE ${enPeriodo('a.created_at', p)} ${fa} GROUP BY 1, 2 ORDER BY 3 DESC`),
      this.q<{ estado: string; cantidad: number }>(Prisma.sql`
        SELECT a.estado::text AS estado, count(*)::int AS cantidad
        FROM alerta a JOIN viaje v ON v.id = a.viaje_id
        WHERE ${enPeriodo('a.created_at', p)} ${fa} GROUP BY 1`),
      this.q<{
        actividad: string
        detectados: number
        falsas_alarmas: number
        pidieron_ayuda: number
        sin_respuesta: number
      }>(Prisma.sql`
        SELECT v.tipo_actividad::text AS actividad,
               count(*)::int AS detectados,
               count(*) FILTER (WHERE pa.confirmado_bien IS TRUE)::int AS falsas_alarmas,
               count(*) FILTER (WHERE pa.confirmado_bien IS FALSE)::int AS pidieron_ayuda,
               count(*) FILTER (WHERE pa.confirmado_bien IS NULL)::int AS sin_respuesta
        FROM parada pa JOIN viaje v ON v.id = pa.viaje_id
        WHERE pa.tipo = 'incidente_detectado' AND ${enPeriodo('pa.inicio', p)} ${fa}
        GROUP BY 1 ORDER BY 2 DESC`),
      this.q<{
        total: number
        aprobadas: number
        rechazadas: number
        canceladas: number
        pendientes: number
        mediana_respuesta_seg: number | null
      }>(Prisma.sql`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE s.estado = 'aprobada')::int AS aprobadas,
               count(*) FILTER (WHERE s.estado = 'rechazada')::int AS rechazadas,
               count(*) FILTER (WHERE s.estado = 'cancelada')::int AS canceladas,
               count(*) FILTER (WHERE s.estado = 'pendiente')::int AS pendientes,
               percentile_cont(0.5) WITHIN GROUP (
                 ORDER BY extract(epoch FROM s.resolved_at - s.created_at)
               ) FILTER (WHERE s.estado IN ('aprobada', 'rechazada') AND s.resolved_at IS NOT NULL)::float8
                 AS mediana_respuesta_seg
        FROM solicitud_parada s JOIN viaje v ON v.id = s.viaje_id
        WHERE ${enPeriodo('s.created_at', p)} ${fa}`),
      this.q<{ categoria: string; cantidad: number; duracion_promedio_min: number | null }>(Prisma.sql`
        SELECT coalesce(pa.categoria::text, 'sin_categoria') AS categoria, count(*)::int AS cantidad,
               (avg(extract(epoch FROM pa.fin - pa.inicio)) FILTER (WHERE pa.fin IS NOT NULL) / 60)::float8
                 AS duracion_promedio_min
        FROM parada pa JOIN viaje v ON v.id = pa.viaje_id
        WHERE pa.tipo = 'voluntaria' AND ${enPeriodo('pa.inicio', p)} ${fa}
        GROUP BY 1 ORDER BY 2 DESC`),
      this.q<{ viajes: number }>(Prisma.sql`
        SELECT count(*)::int AS viajes FROM viaje v
        WHERE ${enPeriodo('v.fecha_inicio_real', p)} ${fa}`),
    ])

    const totalAlertas = alertas.reduce((s, a) => s + a.cantidad, 0)
    const inc = incidentes.reduce(
      (s, f) => ({
        detectados: s.detectados + f.detectados,
        falsas_alarmas: s.falsas_alarmas + f.falsas_alarmas,
        pidieron_ayuda: s.pidieron_ayuda + f.pidieron_ayuda,
        sin_respuesta: s.sin_respuesta + f.sin_respuesta,
      }),
      { detectados: 0, falsas_alarmas: 0, pidieron_ayuda: 0, sin_respuesta: 0 }
    )

    return {
      periodo: periodoRespuesta(p),
      actividad: actividad ?? null,
      alertas: {
        total: totalAlertas,
        cada_100_viajes: redondear(viajes ? (totalAlertas / viajes) * 100 : null),
        por_tipo_y_origen: alertas,
        por_estado: alertasEstado,
      },
      incidentes: {
        ...inc,
        tasa_falsas_alarmas: tasa(inc.falsas_alarmas, inc.detectados),
        cada_100_viajes: redondear(viajes ? (inc.detectados / viajes) * 100 : null),
        por_actividad: incidentes.map((f) => ({
          ...f,
          tasa_falsas_alarmas: tasa(f.falsas_alarmas, f.detectados),
        })),
      },
      solicitudes_parada: {
        ...solicitudes,
        mediana_respuesta_seg: redondear(solicitudes.mediana_respuesta_seg, 0),
        tasa_aprobacion: tasa(solicitudes.aprobadas, solicitudes.aprobadas + solicitudes.rechazadas),
      },
      paradas_voluntarias: paradas.map((f) => ({
        ...f,
        duracion_promedio_min: redondear(f.duracion_promedio_min),
      })),
    }
  }

  // ── Destinos y demanda de servicios en ruta ────────────────────────────────

  async destinos(p: Periodo, actividad?: string) {
    const fa = filtroActividad(actividad)
    const topLugares = (col: 'destino_nombre' | 'origen_nombre') =>
      this.q<{ lugar: string; viajes: number }>(Prisma.sql`
        SELECT btrim(r.${Prisma.raw(col)}) AS lugar, count(*)::int AS viajes
        FROM ruta r JOIN viaje v ON v.id = r.viaje_id
        WHERE ${enPeriodo('v.fecha_inicio_real', p)} ${fa}
          AND r.${Prisma.raw(col)} IS NOT NULL AND btrim(r.${Prisma.raw(col)}) <> ''
        GROUP BY 1
        HAVING count(DISTINCT v.creador_id) >= ${UMBRAL_K_ANONIMATO}
        ORDER BY 2 DESC, 1
        LIMIT 10`)

    const [destinos, origenes, distancias, categorias] = await Promise.all([
      topLugares('destino_nombre'),
      topLugares('origen_nombre'),
      this.q<{ rango: string; cantidad: number }>(Prisma.sql`
        SELECT CASE WHEN r.distancia_planeada_m < 10000 THEN '< 10 km'
                    WHEN r.distancia_planeada_m < 50000 THEN '10-50 km'
                    WHEN r.distancia_planeada_m < 100000 THEN '50-100 km'
                    WHEN r.distancia_planeada_m < 300000 THEN '100-300 km'
                    ELSE '300+ km' END AS rango,
               count(*)::int AS cantidad
        FROM ruta r JOIN viaje v ON v.id = r.viaje_id
        WHERE ${enPeriodo('v.fecha_inicio_real', p)} ${fa} AND r.distancia_planeada_m IS NOT NULL
        GROUP BY 1`),
      this.q<{ categoria: string; cantidad: number }>(Prisma.sql`
        SELECT pi.categoria::text AS categoria, count(*)::int AS cantidad
        FROM parada_intermedia pi
        JOIN ruta r ON r.id = pi.ruta_id
        JOIN viaje v ON v.id = r.viaje_id
        WHERE ${enPeriodo('v.fecha_inicio_real', p)} ${fa}
        GROUP BY 1 ORDER BY 2 DESC`),
    ])

    return {
      periodo: periodoRespuesta(p),
      actividad: actividad ?? null,
      umbral_k_anonimato: UMBRAL_K_ANONIMATO,
      top_destinos: destinos,
      top_origenes: origenes,
      distancia_planeada: distribucion(RANGOS_KM, distancias),
      paradas_planificadas_por_categoria: categorias,
    }
  }

  // ── Adopción de funcionalidades y confianza ────────────────────────────────

  async adopcion(p: Periodo) {
    const [[viajes], [usuarios], [privacidad]] = await Promise.all([
      this.q<Record<string, number>>(Prisma.sql`
        WITH vs AS (SELECT id, modo, es_grupal FROM viaje WHERE ${enPeriodo('fecha_inicio_real', p)})
        SELECT
          count(*)::int AS viajes,
          count(*) FILTER (WHERE es_grupal)::int AS grupales,
          count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ruta r WHERE r.viaje_id = vs.id))::int AS ruta_planificada,
          count(*) FILTER (WHERE EXISTS (SELECT 1 FROM checklist_item c WHERE c.viaje_id = vs.id))::int AS checklist,
          count(*) FILTER (WHERE EXISTS (SELECT 1 FROM gasto g WHERE g.viaje_id = vs.id))::int AS gastos,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM alerta a WHERE a.viaje_id = vs.id AND a.origen IN ('lider', 'integrante')
          ))::int AS alertas_manuales,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM parada pa WHERE pa.viaje_id = vs.id AND pa.tipo = 'voluntaria'
          ))::int AS paradas_voluntarias,
          count(*) FILTER (WHERE EXISTS (SELECT 1 FROM solicitud_parada s WHERE s.viaje_id = vs.id))::int
            AS solicitudes_parada,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM ruta r JOIN ruta_compartida rc ON rc.ruta_id = r.id WHERE r.viaje_id = vs.id
          ))::int AS ruta_compartida,
          count(*) FILTER (WHERE modo = 'entrenamiento')::int AS modo_entrenamiento,
          count(*) FILTER (WHERE modo = 'competitivo')::int AS modo_competitivo
        FROM vs`),
      this.q<Record<string, number>>(Prisma.sql`
        SELECT count(*)::int AS usuarios,
               count(*) FILTER (WHERE consentimiento_ubicacion_version = ${VERSION_CONSENTIMIENTO_UBICACION})::int
                 AS consentimiento_vigente,
               count(*) FILTER (WHERE comparte_ubicacion_default)::int AS comparte_por_defecto,
               count(*) FILTER (WHERE push_token IS NOT NULL)::int AS notificaciones_push,
               count(*) FILTER (WHERE actividad_preferida IS NOT NULL)::int AS actividad_preferida
        FROM usuario WHERE suspendido_at IS NULL`),
      this.q<{ participaciones: number; ubicacion_apagada: number }>(Prisma.sql`
        WITH ${PARTICIPACIONES}
        SELECT count(*)::int AS participaciones,
               count(*) FILTER (
                 WHERE coalesce(pv.comparte_ubicacion, u.comparte_ubicacion_default) = false
               )::int AS ubicacion_apagada
        FROM participaciones pt
        JOIN usuario u ON u.id = pt.usuario_id
        LEFT JOIN privacidad_viaje pv ON pv.viaje_id = pt.viaje_id AND pv.usuario_id = pt.usuario_id
        WHERE ${enPeriodo('pt.inicio', p)}`),
    ])

    const funcionalidades = [
      'ruta_planificada',
      'checklist',
      'paradas_voluntarias',
      'alertas_manuales',
      'solicitudes_parada',
      'gastos',
      'ruta_compartida',
      'modo_entrenamiento',
      'modo_competitivo',
    ].map((clave) => ({ funcionalidad: clave, viajes: viajes[clave], tasa: tasa(viajes[clave], viajes.viajes) }))

    return {
      periodo: periodoRespuesta(p),
      viajes_iniciados: viajes.viajes,
      viajes_grupales: viajes.grupales,
      funcionalidades,
      usuarios: {
        activos: usuarios.usuarios,
        indicadores: [
          'consentimiento_vigente',
          'comparte_por_defecto',
          'notificaciones_push',
          'actividad_preferida',
        ].map((clave) => ({ indicador: clave, usuarios: usuarios[clave], tasa: tasa(usuarios[clave], usuarios.usuarios) })),
      },
      privacidad: {
        participaciones: privacidad.participaciones,
        con_ubicacion_apagada: privacidad.ubicacion_apagada,
        tasa_ubicacion_apagada: tasa(privacidad.ubicacion_apagada, privacidad.participaciones),
      },
    }
  }

  // ── Gastos compartidos (señal económica) ───────────────────────────────────

  async gastos(p: Periodo, actividad?: string) {
    const fa = filtroActividad(actividad)
    const [porActividad, serie] = await Promise.all([
      this.q<{
        actividad: string
        viajes_con_gastos: number
        gastos: number
        monto_total: number
        personas: number
      }>(Prisma.sql`
        WITH ${viajesIniciados(p, actividad)},
        por_viaje AS (
          SELECT i.id, i.actividad, i.personas, count(g.id) AS gastos, sum(g.monto) AS monto
          FROM iniciados i JOIN gasto g ON g.viaje_id = i.id
          GROUP BY i.id, i.actividad, i.personas
        )
        SELECT actividad, count(*)::int AS viajes_con_gastos, sum(gastos)::int AS gastos,
               sum(monto)::float8 AS monto_total, sum(personas)::int AS personas
        FROM por_viaje GROUP BY 1 ORDER BY 4 DESC`),
      this.q<{ balde: string; valor: number }>(Prisma.sql`
        SELECT ${balde('g.created_at', p.granularidad)} AS balde, sum(g.monto)::float8 AS valor
        FROM gasto g JOIN viaje v ON v.id = g.viaje_id
        WHERE ${enPeriodo('g.created_at', p)} ${fa} GROUP BY 1`),
    ])

    const total = porActividad.reduce(
      (s, f) => ({
        viajes: s.viajes + f.viajes_con_gastos,
        gastos: s.gastos + f.gastos,
        monto: s.monto + f.monto_total,
        personas: s.personas + f.personas,
      }),
      { viajes: 0, gastos: 0, monto: 0, personas: 0 }
    )
    const [{ viajes: iniciados }] = await this.q<{ viajes: number }>(Prisma.sql`
      SELECT count(*)::int AS viajes FROM viaje v WHERE ${enPeriodo('v.fecha_inicio_real', p)} ${fa}`)

    return {
      periodo: periodoRespuesta(p),
      actividad: actividad ?? null,
      resumen: {
        viajes_iniciados: iniciados,
        viajes_con_gastos: total.viajes,
        tasa_uso: tasa(total.viajes, iniciados),
        gastos_registrados: total.gastos,
        monto_total: redondear(total.monto, 2),
        promedio_por_viaje: redondear(total.viajes ? total.monto / total.viajes : null, 2),
        promedio_por_persona: redondear(total.personas ? total.monto / total.personas : null, 2),
      },
      por_actividad: porActividad.map((f) => ({
        actividad: f.actividad,
        viajes_con_gastos: f.viajes_con_gastos,
        gastos: f.gastos,
        monto_total: redondear(f.monto_total, 2),
        promedio_por_viaje: redondear(f.monto_total / f.viajes_con_gastos, 2),
        promedio_por_persona: redondear(f.personas ? f.monto_total / f.personas : null, 2),
      })),
      serie: completarSerie(clavesSerie(p), { monto: serie }).map((f) => ({
        balde: f.balde,
        monto: redondear(f.monto, 2) ?? 0,
      })),
    }
  }
}
