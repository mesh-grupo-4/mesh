/**
 * Verificaciones del seed de demo que no escriben nada.
 *
 * - `verificarGuion`: revisa `guion.ts` antes de tocar la base. Un nombre mal escrito o
 *   un circuito mal armado se detecta acá, y no a mitad del seed con lo demo ya borrado.
 * - `migracionesFaltantes`: migraciones del repo que la base todavía no tiene.
 * - `informeGuion`: lo que va a quedar en la tab Entrenar, calculado con la simulación.
 *
 * `npm run demo:verificar` corre las tres cosas y termina sin escribir.
 */
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { PrismaClient, TipoActividad } from '@prisma/client'
import { esMotorizado } from '../../lib/actividad'
import { momento, MS_MIN, rutaDemo, semillaDe } from './comun'
import {
  AMISTADES,
  CIRCUITOS,
  ELENCO,
  GRUPOS,
  INVITACIONES_GRUPO,
  PROTAGONISTA,
  RUTAS_GUARDADAS,
  VIAJES_PLANIFICADOS,
  VIAJES_VITRINA,
  type ViajeVitrina,
} from './guion'
import { simularViaje, type ResultadoSimulacion } from './trazas'

/** Actividad de un viaje del guion: la propia o, si no la define, la de su ruta. */
export function actividadDe(v: { ruta?: string; actividad?: TipoActividad }): TipoActividad {
  if (v.actividad) return v.actividad
  if (!v.ruta) throw new Error('Un viaje sin ruta tiene que definir su actividad')
  return rutaDemo(v.ruta).def.actividad
}

const simulaciones = new Map<string, ResultadoSimulacion>()

/** Traza de todos los integrantes de un viaje de vitrina. Se calcula una sola vez por horario. */
export function simularVitrina(v: ViajeVitrina, inicio: Date): ResultadoSimulacion {
  const llave = `${v.clave}:${inicio.getTime()}`
  const guardada = simulaciones.get(llave)
  if (guardada) return guardada

  const ruta = rutaDemo(v.ruta)
  const sim = simularViaje({
    camino: ruta.puntos,
    actividad: actividadDe(v),
    altura: ruta.def.altura,
    inicio,
    semilla: semillaDe(v.clave),
    vuelta: v.vuelta,
    cortarEnM: v.cortarEnKm ? v.cortarEnKm * 1000 : undefined,
    libre: v.libre,
    paradasGrupo: (v.paradas ?? []).map((p) => ({ fraccion: p.en, minutos: p.min })),
    integrantes: [v.creador, ...v.integrantes].map((clave) => ({
      clave,
      ritmo: v.ritmos?.[clave],
      paradas: (v.paradasDe ?? [])
        .filter((p) => p.quien === clave)
        .map((p) => ({ fraccion: p.en, minutos: p.min })),
      saleEnFraccion: v.sale?.quien === clave ? v.sale.en : undefined,
    })),
  })
  simulaciones.set(llave, sim)
  return sim
}

/** Inicio real de un viaje de vitrina si se sembrara hoy, sin el corrimiento de una semana. */
const inicioDe = (v: ViajeVitrina, hoy: string) => new Date(momento(hoy, v.haceDias, v.hora).getTime() + 4 * MS_MIN)

function repetidos(lista: string[]): string[] {
  return [...new Set(lista.filter((x, i) => lista.indexOf(x) !== i))]
}

// ── Guion ────────────────────────────────────────────────────────────────────

export function verificarGuion(hoy: string, ahora: Date): { errores: string[]; avisos: string[] } {
  const errores: string[] = []
  const avisos: string[] = []
  const usuarios = new Map(ELENCO.map((u) => [u.clave, u]))
  const grupos = new Map(GRUPOS.map((g) => [g.clave, g]))
  const vitrina = new Map(VIAJES_VITRINA.map((v) => [v.clave, v]))
  const planificados = new Map(VIAJES_PLANIFICADOS.map((p) => [p.clave, p]))

  const existeUsuario = (clave: string, donde: string) => {
    if (!usuarios.has(clave)) errores.push(`${donde}: no existe el usuario "${clave}"`)
  }
  const existeGrupo = (clave: string | undefined, donde: string) => {
    if (clave && !grupos.has(clave)) errores.push(`${donde}: no existe el grupo "${clave}"`)
  }
  /** La ruta existe y tiene geometría; devuelve la actividad del viaje o null. */
  const actividadSegura = (v: { ruta?: string; actividad?: TipoActividad }, donde: string) => {
    try {
      return actividadDe(v)
    } catch (err) {
      errores.push(`${donde}: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }
  /** RN-070: moto y auto no compiten ni entrenan. */
  const sinMotorizadosCompitiendo = (actividad: TipoActividad | null, modo: string, donde: string) => {
    if (actividad && esMotorizado(actividad) && modo !== 'recreativo') {
      errores.push(`${donde}: un viaje en ${actividad} no puede ser ${modo} (RN-070)`)
    }
  }

  for (const [que, claves] of [
    ['usuario', ELENCO.map((u) => u.clave)],
    ['grupo', GRUPOS.map((g) => g.clave)],
    ['viaje de vitrina', VIAJES_VITRINA.map((v) => v.clave)],
    ['viaje planificado', VIAJES_PLANIFICADOS.map((p) => p.clave)],
  ] as const) {
    for (const clave of repetidos(claves)) errores.push(`Hay más de un ${que} con la clave "${clave}"`)
  }
  if (!usuarios.get(PROTAGONISTA)?.login) errores.push(`La protagonista "${PROTAGONISTA}" no existe o no tiene login`)

  // Las fotos se suben desde `fotos/`: si falta un archivo, mejor saberlo antes de borrar nada.
  const fotos = [
    ...ELENCO.flatMap((u) => (u.foto ? [{ archivo: u.foto, de: `Usuario "${u.clave}"` }] : [])),
    ...VIAJES_VITRINA.flatMap((v) => (v.publicar?.foto ? [{ archivo: v.publicar.foto, de: `Viaje "${v.clave}"` }] : [])),
  ]
  for (const f of fotos) {
    if (!existsSync(path.join(__dirname, 'fotos', f.archivo))) errores.push(`${f.de}: no existe la foto fotos/${f.archivo}`)
  }

  for (const g of GRUPOS) {
    const donde = `Grupo "${g.clave}"`
    for (const clave of [g.lider, ...g.miembros]) existeUsuario(clave, donde)
    for (const clave of repetidos([g.lider, ...g.miembros])) errores.push(`${donde}: "${clave}" figura dos veces`)
  }
  for (const par of repetidos(AMISTADES.map((a) => [a.de, a.a].sort().join(' y ')))) {
    errores.push(`Amistades: ${par} tienen más de una solicitud entre sí`)
  }
  for (const a of AMISTADES) {
    existeUsuario(a.de, 'Amistades')
    existeUsuario(a.a, 'Amistades')
  }
  for (const par of repetidos(INVITACIONES_GRUPO.map((i) => `"${i.a}" al grupo "${i.grupo}"`))) {
    errores.push(`Invitaciones a grupos: se invita dos veces a ${par}`)
  }
  for (const inv of INVITACIONES_GRUPO) {
    const donde = `Invitación de "${inv.a}" al grupo "${inv.grupo}"`
    existeUsuario(inv.a, donde)
    existeUsuario(inv.de, donde)
    existeGrupo(inv.grupo, donde)
    existeGrupo(inv.grupoOrigen, donde)
    const grupo = grupos.get(inv.grupo)
    if (grupo && inv.estado !== 'aceptada' && [grupo.lider, ...grupo.miembros].includes(inv.a)) {
      errores.push(`${donde}: ya es integrante de ese grupo`)
    }
  }

  // ── Viajes de vitrina ──
  /** Quién estuvo en qué viaje y cuándo, para detectar a alguien en dos lugares a la vez. */
  const agenda = new Map<string, { clave: string; desde: number; hasta: number }[]>()
  for (const v of VIAJES_VITRINA) {
    const donde = `Viaje "${v.clave}"`
    const fueron = [v.creador, ...v.integrantes]
    const invitados = [...fueron, ...(v.ausentes ?? []), ...(v.rechazaron ?? [])]
    for (const clave of invitados) existeUsuario(clave, donde)
    for (const clave of repetidos(invitados)) errores.push(`${donde}: "${clave}" figura dos veces`)
    existeGrupo(v.grupo, donde)

    const actividad = actividadSegura(v, donde)
    sinMotorizadosCompitiendo(actividad, v.modo, donde)

    const nombrados = [
      ...Object.keys(v.ritmos ?? {}),
      ...(v.paradasDe ?? []).map((p) => p.quien),
      ...(v.alertas ?? []).map((a) => a.por),
      ...(v.solicitudes ?? []).map((s) => s.por),
      ...(v.gastos ?? []).flatMap((g) => [g.por, ...(g.entre ?? [])]),
      ...(v.noComparte ?? []),
      ...(v.sale ? [v.sale.quien] : []),
      ...(v.sinSenal ? [v.sinSenal.quien] : []),
      ...(v.publicar ? [v.publicar.por] : []),
    ]
    for (const clave of new Set(nombrados.filter((c) => !fueron.includes(c)))) {
      errores.push(`${donde}: nombra a "${clave}", que no fue a ese viaje`)
    }
    if (v.sale?.quien === v.creador) errores.push(`${donde}: quien lo armó no puede bajarse (es quien lo finaliza)`)
    if (v.libre && v.paradas?.length) avisos.push(`${donde}: con \`libre\` las paradas de grupo se ignoran`)
    for (const clave of fueron) {
      const ficha = usuarios.get(clave)
      if (ficha && ficha.altaHaceDias <= v.haceDias) {
        errores.push(`${donde}: "${clave}" todavía no tenía cuenta hace ${v.haceDias} días`)
      }
      if (ficha?.nuevo) errores.push(`${donde}: "${clave}" es una cuenta nueva, sin viajes`)
    }

    if (!actividad) continue
    const inicio = inicioDe(v, hoy)
    const sim = simularVitrina(v, inicio)
    if (sim.fin.getTime() > ahora.getTime() - 20 * MS_MIN && !v.opcional) {
      avisos.push(`${donde}: a esta hora todavía no pudo terminar; se siembra una semana antes`)
    }
    for (const clave of fueron) {
      const traza = sim.trazas.get(clave)
      if (!traza?.length) continue
      const hasta = traza[traza.length - 1]!.timestamp.getTime()
      agenda.set(clave, [...(agenda.get(clave) ?? []), { clave: v.clave, desde: inicio.getTime(), hasta }])
    }
  }
  for (const [persona, salidas] of agenda) {
    const ordenadas = salidas.sort((a, b) => a.desde - b.desde)
    ordenadas.forEach((s, i) => {
      const siguiente = ordenadas[i + 1]
      if (siguiente && siguiente.desde < s.hasta) {
        errores.push(`"${persona}" está en dos viajes a la vez: "${s.clave}" y "${siguiente.clave}"`)
      }
    })
  }

  // ── Viajes planificados ──
  for (const p of VIAJES_PLANIFICADOS) {
    const donde = `Planificado "${p.clave}"`
    const invitados = [p.creador, ...(p.confirmados ?? []), ...(p.pendientes ?? []), ...(p.rechazados ?? [])]
    for (const clave of invitados) existeUsuario(clave, donde)
    for (const clave of repetidos(invitados)) errores.push(`${donde}: "${clave}" figura dos veces`)
    existeGrupo(p.grupo, donde)
    sinMotorizadosCompitiendo(actividadSegura(p, donde), p.modo, donde)
    if (p.enDias < 1) errores.push(`${donde}: tiene que ser a futuro (RN-107)`)
    if (p.compartirRuta && !p.ruta) errores.push(`${donde}: no se puede compartir una ruta que no tiene`)
  }

  // ── Rutas guardadas y circuitos ──
  for (const g of RUTAS_GUARDADAS) {
    if (!vitrina.get(g.viaje)?.publicar) {
      errores.push(`Rutas guardadas: "${g.viaje}" no es un recorrido publicado`)
    }
  }
  for (const clave of repetidos(RUTAS_GUARDADAS.map((g) => g.viaje))) {
    errores.push(`Rutas guardadas: "${clave}" está dos veces`)
  }

  const yaEnCircuito = new Set<string>()
  for (const c of CIRCUITOS) {
    const donde = `Circuito "${c.nombre}" de ${c.de}`
    existeUsuario(c.de, donde)
    if (c.sesiones.length === 0) errores.push(`${donde}: no tiene sesiones`)

    const actividades = new Set<TipoActividad>()
    let anterior = Infinity
    for (const clave of c.sesiones) {
      const v = vitrina.get(clave)
      if (!v) {
        errores.push(`${donde}: no existe el viaje "${clave}"`)
        continue
      }
      if (v.modo !== 'entrenamiento') errores.push(`${donde}: "${clave}" no es un entrenamiento`)
      if (![v.creador, ...v.integrantes].includes(c.de)) errores.push(`${donde}: ${c.de} no fue a "${clave}"`)
      if (v.haceDias >= anterior) errores.push(`${donde}: las sesiones van de la más vieja a la más nueva ("${clave}")`)
      anterior = v.haceDias
      const actividad = actividadSegura(v, donde)
      if (actividad) actividades.add(actividad)
      // PK (usuario, viaje): una sesión está como mucho en un circuito por persona.
      if (yaEnCircuito.has(`${c.de}:${clave}`)) errores.push(`${donde}: "${clave}" ya está en otro circuito suyo`)
      yaEnCircuito.add(`${c.de}:${clave}`)
    }
    if (actividades.size > 1) errores.push(`${donde}: mezcla actividades (${[...actividades].join(', ')})`)
    for (const a of actividades) {
      if (esMotorizado(a)) errores.push(`${donde}: no hay circuitos en ${a} (RN-070)`)
    }

    if (c.plantilla) {
      if (c.de !== PROTAGONISTA) errores.push(`${donde}: solo la protagonista tiene rutas guardadas`)
      if (!RUTAS_GUARDADAS.some((g) => g.viaje === c.plantilla)) {
        errores.push(`${donde}: "${c.plantilla}" no está en RUTAS_GUARDADAS`)
      }
      if (CIRCUITOS.filter((x) => x.de === c.de && x.plantilla === c.plantilla).length > 1) {
        errores.push(`${donde}: hay más de un circuito de la ruta guardada "${c.plantilla}"`)
      }
    }
    if (c.proximaSesion) {
      const p = planificados.get(c.proximaSesion)
      if (!p) {
        errores.push(`${donde}: no existe el planificado "${c.proximaSesion}"`)
      } else {
        if (p.creador !== c.de) errores.push(`${donde}: "${p.clave}" lo armó otra persona`)
        if (p.modo !== 'entrenamiento') errores.push(`${donde}: "${p.clave}" no es un entrenamiento`)
        const actividad = actividadSegura(p, donde)
        if (actividad && actividades.size === 1 && !actividades.has(actividad)) {
          errores.push(`${donde}: "${p.clave}" es de otra actividad (${actividad})`)
        }
      }
      if (yaEnCircuito.has(`${c.de}:${c.proximaSesion}`)) {
        errores.push(`${donde}: "${c.proximaSesion}" ya está en otro circuito suyo`)
      }
      yaEnCircuito.add(`${c.de}:${c.proximaSesion}`)
    }
  }

  return { errores, avisos }
}

// ── Migraciones ──────────────────────────────────────────────────────────────

/**
 * Migraciones de `prisma/migrations` que la base todavía no tiene aplicadas. El seed
 * usa el cliente Prisma del repo: si la base está atrasada, falla en la primera tabla
 * o columna que no encuentra.
 */
export async function migracionesFaltantes(prisma: PrismaClient): Promise<string[]> {
  const carpeta = path.resolve(__dirname, '../../../prisma/migrations')
  const delRepo = readdirSync(carpeta, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  const aplicadas = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
  const enLaBase = new Set(aplicadas.map((m) => m.migration_name))
  return delRepo.filter((nombre) => !enLaBase.has(nombre))
}

// ── Informe ──────────────────────────────────────────────────────────────────

/** Distancia y tiempo en movimiento de una persona en un viaje, según la simulación. */
function sesionSimulada(v: ViajeVitrina, persona: string, hoy: string) {
  const traza = simularVitrina(v, inicioDe(v, hoy)).trazas.get(persona) ?? []
  let metros = 0
  let segundos = 0
  for (const p of traza) {
    if (p.velocidad_kmh < 0.5) continue
    metros += (p.velocidad_kmh / 3.6) * 5
    segundos += 5
  }
  return { metros, segundos }
}

function ritmo(actividad: TipoActividad, metros: number, segundos: number): string {
  if (metros <= 0 || segundos <= 0) return 's/d'
  if (actividad === 'bici') return `${(metros / 1000 / (segundos / 3600)).toFixed(1)} km/h`
  const minKm = segundos / 60 / (metros / 1000)
  const min = Math.floor(minKm)
  return `${min}:${String(Math.round((minKm - min) * 60) % 60).padStart(2, '0')} /km`
}

/** Lo que va a mostrar la tab Entrenar de cada cuenta con login. Valores aproximados. */
export function informeGuion(hoy: string): string {
  const lineas: string[] = [
    '',
    `Guion: ${ELENCO.length} usuarios, ${GRUPOS.length} grupos, ${VIAJES_VITRINA.length} viajes con traza, ` +
      `${VIAJES_PLANIFICADOS.length} planificados, ${CIRCUITOS.length} circuitos.`,
  ]
  const detalle = (v: ViajeVitrina, persona: string) => {
    const actividad = actividadDe(v)
    const { metros, segundos } = sesionSimulada(v, persona, hoy)
    const ajeno = v.creador === persona ? '' : ` · lo armó ${v.creador}`
    return (
      `      hace ${String(v.haceDias).padStart(2)} días  ${(metros / 1000).toFixed(1).padStart(5)} km  ` +
      `${ritmo(actividad, metros, segundos).padStart(10)}  ${v.nombre}${ajeno}`
    )
  }

  for (const u of ELENCO.filter((x) => x.login)) {
    const sesiones = VIAJES_VITRINA.filter(
      (v) => v.modo === 'entrenamiento' && [v.creador, ...v.integrantes].includes(u.clave)
    )
    const circuitos = CIRCUITOS.filter((c) => c.de === u.clave)
    const enCircuito = new Set(circuitos.flatMap((c) => c.sesiones))
    const sueltas = sesiones.filter((v) => !enCircuito.has(v.clave)).sort((a, b) => b.haceDias - a.haceDias)
    const invitaciones = VIAJES_PLANIFICADOS.filter(
      (p) => p.modo === 'entrenamiento' && (p.pendientes ?? []).includes(u.clave)
    )

    lineas.push('', `Entrenar de ${u.nombre}: ${circuitos.length} circuitos, ${sesiones.length} sesiones`)
    for (const c of circuitos) {
      const primera = VIAJES_VITRINA.find((v) => v.clave === c.sesiones[0])
      const origen = c.plantilla ? 'desde ruta guardada' : 'con Repetir'
      lineas.push(`  ${c.nombre} (${primera ? actividadDe(primera) : '?'}, ${origen})`)
      for (const clave of c.sesiones) {
        const v = VIAJES_VITRINA.find((x) => x.clave === clave)
        if (v) lineas.push(detalle(v, u.clave))
      }
      if (c.proximaSesion) {
        const p = VIAJES_PLANIFICADOS.find((x) => x.clave === c.proximaSesion)
        if (p) lineas.push(`      en ${String(p.enDias).padStart(4)} días  planificado: ${p.nombre}`)
      }
    }
    if (sueltas.length > 0) {
      lineas.push('  Sesiones sueltas')
      for (const v of sueltas) lineas.push(`${detalle(v, u.clave)} (${actividadDe(v)})`)
    }
    if (invitaciones.length > 0) {
      lineas.push(`  Invitaciones a entrenamientos sin responder: ${invitaciones.map((p) => p.nombre).join(', ')}`)
    }
  }
  lineas.push('')
  return lineas.join('\n')
}
