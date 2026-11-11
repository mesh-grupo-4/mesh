/**
 * Seed de demo: deja la plataforma como si la usara una comunidad activa.
 *
 *   npm run demo:seed                         borra lo demo anterior y lo vuelve a crear
 *   npm run demo:seed -- --password otra123   idem, con otra contraseña para las cuentas
 *   npm run demo:limpiar                      borra todo lo demo, incluidas las cuentas de Firebase
 *
 * Escribe en la base de `backend/.env.demo` si ese archivo existe, y si no en la de
 * `.env` (ver `entorno.ts`). Lo primero que muestra es contra qué base va a correr.
 *
 * Todo lo que crea se reconoce por el dominio de email `@demo.mesh`: nunca toca cuentas
 * ni viajes reales. Las fechas son relativas al día en que se corre, así que conviene
 * volver a correrlo el día anterior a una presentación (las rachas se cortan solas
 * después de una semana sin actividad).
 *
 * Es una herramienta aparte: la app no importa nada de esta carpeta. Las trazas GPS son
 * simuladas (`trazas.ts`), pero las métricas, insignias, rachas, publicaciones y rutas
 * guardadas se generan con los mismos servicios que usa el backend, para que lo que se
 * ve en pantalla sea coherente con los datos.
 *
 * El contenido (personas, grupos, viajes) está en `guion.ts`.
 */
import { ARCHIVO_ENV, baseDestino } from './entorno'
import { randomUUID } from 'node:crypto'
import type { CategoriaParada, Prisma, TipoActividad } from '@prisma/client'
import { firebaseAuth } from '../../config/firebase'
import { prisma } from '../../config/prisma'
import { nombreVisible } from '../../lib/nombres'
import { itemsSugeridos } from '../../modules/checklist/checklistDefaults'
import { InsigniasService } from '../../modules/insignias/insignias.service'
import { prefijoAlertaAfectado } from '../../modules/motor-eventos/motorEventos.config'
import { VERSION_CONSENTIMIENTO_UBICACION } from '../../modules/privacidad/privacidad.schemas'
import { RachasService } from '../../modules/rachas/rachas.service'
import { RecorridosPublicadosService } from '../../modules/recorridos-publicados/recorridos-publicados.service'
import { diaArg } from '../../modules/reportes/reportes.periodo'
import { RutasCompartidasService } from '../../modules/rutas-compartidas/rutas-compartidas.service'
import { TablaPosicionesService } from '../../modules/tabla-posiciones/tabla-posiciones.service'
import { parametrosPorActividad } from '../../modules/viajes/activityDefaults'
import { ViajesService } from '../../modules/viajes/viajes.service'
import {
  enParalelo,
  filasRuta,
  momento,
  MS_DIA,
  MS_HORA,
  MS_MIN,
  porLotes,
  rutaDemo,
  semillaDe,
  type Contexto,
} from './comun'
import {
  AMISTADES,
  CIRCUITOS,
  DOMINIO_DEMO,
  ELENCO,
  GRUPOS,
  INVITACIONES_GRUPO,
  PASSWORD_POR_DEFECTO,
  PROTAGONISTA,
  RUTAS_GUARDADAS,
  VIAJES_PLANIFICADOS,
  VIAJES_VITRINA,
  type ViajePlanificado,
  type ViajeVitrina,
} from './guion'
import { DIAS_SUSPENSION, generarRelleno } from './relleno'
import { crearAzar, simularViaje, type PuntoGps } from './trazas'

const email = (clave: string) => `${clave}@${DOMINIO_DEMO}`
const FILTRO_DEMO = { email: { endsWith: `@${DOMINIO_DEMO}` } }

const arranque = Date.now()

function log(texto: string) {
  const seg = Math.round((Date.now() - arranque) / 1000)
  console.log(`· [${String(seg).padStart(3)} s] ${texto}`)
}

function esUsuarioInexistente(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && err.code === 'auth/user-not-found')
}

// ── Limpieza ─────────────────────────────────────────────────────────────────

/**
 * Borra todo lo que creó el seed. El orden importa: `viaje.creador` y `grupo.lider`
 * son RESTRICT, así que primero caen los viajes y grupos de los usuarios demo y recién
 * después los usuarios (que arrastran en cascada todo lo demás).
 */
async function limpiar(): Promise<number> {
  const usuarios = await prisma.usuario.findMany({ where: FILTRO_DEMO, select: { id: true } })
  const ids = usuarios.map((u) => u.id)

  // La bitácora del backoffice no tiene FK a propósito (RN-121): se limpia a mano.
  await prisma.auditoriaAdmin.deleteMany({
    where: { OR: [{ actor_id: { in: ids } }, { detalle: { path: ['demo'], equals: true } }] },
  })
  if (ids.length === 0) return 0

  // Un link de ruta sobrevive a su viaje (ruta_id pasa a null): se anota antes de borrar.
  const links = await prisma.rutaCompartida.findMany({
    where: { ruta: { viaje: { creador_id: { in: ids } } } },
    select: { id: true },
  })

  await prisma.viaje.deleteMany({ where: { creador_id: { in: ids } } })
  await prisma.grupo.deleteMany({ where: { lider_id: { in: ids } } })
  await prisma.usuario.deleteMany({ where: { id: { in: ids } } })
  // Si una cuenta real guardó una de esas rutas, el link se conserva (FK RESTRICT).
  await prisma.rutaCompartida.deleteMany({
    where: { id: { in: links.map((l) => l.id) }, plantillas: { none: {} } },
  })
  return ids.length
}

async function borrarCuentasFirebase() {
  for (const u of ELENCO.filter((x) => x.login)) {
    try {
      const cuenta = await firebaseAuth.getUserByEmail(email(u.clave))
      await firebaseAuth.deleteUser(cuenta.uid)
      log(`Firebase: cuenta ${email(u.clave)} eliminada`)
    } catch (err) {
      if (!esUsuarioInexistente(err)) throw err
    }
  }
}

// ── Usuarios, grupos y amistades ─────────────────────────────────────────────

/** Crea la cuenta en Firebase o, si ya existe, le deja la contraseña pedida. */
async function cuentaFirebase(clave: string, nombre: string, password: string): Promise<string> {
  const datos = { password, displayName: nombre, emailVerified: true, disabled: false }
  try {
    const existente = await firebaseAuth.getUserByEmail(email(clave))
    await firebaseAuth.updateUser(existente.uid, datos)
    return existente.uid
  } catch (err) {
    if (!esUsuarioInexistente(err)) throw err
    const creada = await firebaseAuth.createUser({ email: email(clave), ...datos })
    return creada.uid
  }
}

async function crearUsuarios(hoy: string, password: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  const filas: Prisma.UsuarioCreateManyInput[] = []
  for (const [i, u] of ELENCO.entries()) {
    const id = randomUUID()
    ids.set(u.clave, id)
    const alta = momento(hoy, u.altaHaceDias, 9 + (i % 10))
    filas.push({
      id,
      // Los que no tienen login llevan un uid que no existe en Firebase.
      firebase_uid: u.login
        ? await cuentaFirebase(u.clave, `${u.nombre} ${u.apellido}`, password)
        : `demo-seed:${u.clave}`,
      email: email(u.clave),
      nombre: u.nombre,
      apellido: u.apellido,
      telefono: `+54 9 351 ${String(5550000 + i * 137).slice(0, 3)}-${String(1000 + i * 271).slice(-4)}`,
      actividad_preferida: u.actividad,
      consentimiento_ubicacion_at: u.nuevo ? null : new Date(alta.getTime() + 5 * MS_MIN),
      consentimiento_ubicacion_version: u.nuevo ? null : VERSION_CONSENTIMIENTO_UBICACION,
      visibilidad_logros: u.visibilidad ?? 'todos',
      rol_sistema: u.superadmin ? 'superadmin' : 'usuario',
      suspendido_at: u.suspendido ? momento(hoy, DIAS_SUSPENSION, 16) : null,
      motivo_suspension: u.suspendido ?? null,
      created_at: alta,
    })
  }
  await prisma.usuario.createMany({ data: filas })
  return ids
}

async function crearGrupos(ctx: Contexto): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  const miembros: Prisma.GrupoMiembroCreateManyInput[] = []
  const grupos: Prisma.GrupoCreateManyInput[] = GRUPOS.map((g) => {
    const id = randomUUID()
    ids.set(g.clave, id)
    const creado = momento(ctx.hoy, g.creadoHaceDias, 19)
    miembros.push({ grupo_id: id, usuario_id: ctx.usuario(g.lider), rol: 'lider', fecha_union: creado })
    g.miembros.forEach((clave, i) => {
      // Nadie se une antes de tener cuenta ni después de hoy.
      const alta = momento(ctx.hoy, ctx.ficha(clave).altaHaceDias - 1, 20)
      const union = Math.max(creado.getTime() + (i + 1) * 2 * MS_DIA, alta.getTime())
      miembros.push({
        grupo_id: id,
        usuario_id: ctx.usuario(clave),
        rol: 'participante',
        fecha_union: new Date(Math.min(union, ctx.ahora.getTime() - MS_HORA)),
      })
    })
    return { id, nombre: g.nombre, lider_id: ctx.usuario(g.lider), fecha_creacion: creado }
  })
  await prisma.grupo.createMany({ data: grupos })
  await prisma.grupoMiembro.createMany({ data: miembros })
  return ids
}

async function crearRelaciones(ctx: Contexto) {
  /** Una relación no puede ser anterior a la cuenta más nueva de las dos, ni futura. */
  const cuando = (haceDias: number, a: string, b: string, hora: number) => {
    const tope = Math.min(ctx.ficha(a).altaHaceDias, ctx.ficha(b).altaHaceDias) - 1
    const fecha = momento(ctx.hoy, Math.min(haceDias, Math.max(0, tope)), hora)
    return new Date(Math.min(fecha.getTime(), ctx.ahora.getTime() - 10 * MS_MIN))
  }
  await prisma.amistad.createMany({
    data: AMISTADES.map((a, i) => ({
      solicitante_id: ctx.usuario(a.de),
      destinatario_id: ctx.usuario(a.a),
      estado: a.estado,
      created_at: cuando(a.haceDias, a.de, a.a, 8 + (i % 12)),
    })),
  })
  await prisma.grupoInvitacion.createMany({
    data: INVITACIONES_GRUPO.map((inv, i) => ({
      grupo_id: ctx.grupo(inv.grupo),
      usuario_id: ctx.usuario(inv.a),
      invitado_por_id: ctx.usuario(inv.de),
      grupo_origen_id: inv.grupoOrigen ? ctx.grupo(inv.grupoOrigen) : null,
      estado: inv.estado,
      created_at: cuando(inv.haceDias, inv.a, inv.de, 10 + (i % 9)),
    })),
  })
}

// ── Viajes de vitrina (con traza GPS) ────────────────────────────────────────

type ViajeSembrado = { clave: string; viajeId: string; creadorId: string; fin: Date }

/** Ítems de checklist de una persona: los sugeridos de la actividad más los del líder. */
function filasChecklist(op: {
  viajeId: string
  actividad: TipoActividad
  creador: string
  personas: string[]
  delLider: string[]
  /** Proporción de ítems tildados por persona. */
  completado: (clave: string) => number
  creado: Date
  ctx: Contexto
  azar: () => number
}): Prisma.ChecklistItemCreateManyInput[] {
  const filas: Prisma.ChecklistItemCreateManyInput[] = []
  const sugeridos = itemsSugeridos(op.actividad)
  const base = op.delLider.map((texto) => ({ id: randomUUID(), texto }))
  for (const clave of op.personas) {
    const usuario_id = op.ctx.usuario(clave)
    const tildado = () => op.azar() < op.completado(clave)
    sugeridos.forEach((texto, orden) => {
      filas.push({
        viaje_id: op.viajeId,
        usuario_id,
        texto,
        origen: 'sugerido',
        completado: tildado(),
        orden,
        created_at: op.creado,
      })
    })
    // Los del líder son el original en su checklist y una copia en el de cada integrante.
    base.forEach((item, i) => {
      const esOriginal = clave === op.creador
      filas.push({
        id: esOriginal ? item.id : randomUUID(),
        viaje_id: op.viajeId,
        usuario_id,
        origen_item_id: esOriginal ? null : item.id,
        texto: item.texto,
        origen: 'lider',
        completado: tildado(),
        orden: sugeridos.length + i,
        created_at: op.creado,
      })
    })
  }
  // Las copias referencian al original: tiene que insertarse primero.
  return filas.sort((a, b) => Number(Boolean(a.origen_item_id)) - Number(Boolean(b.origen_item_id)))
}

async function sembrarVitrina(v: ViajeVitrina, ctx: Contexto): Promise<ViajeSembrado | null> {
  const ruta = rutaDemo(v.ruta)
  const actividad = v.actividad ?? ruta.def.actividad
  const azar = crearAzar(semillaDe(`extras:${v.clave}`))
  const claves = [v.creador, ...v.integrantes]
  const id = ctx.usuario
  const nombre = (clave: string) => nombreVisible(ctx.ficha(clave).nombre, ctx.ficha(clave).apellido)

  const simular = (inicio: Date) =>
    simularViaje({
      camino: ruta.puntos,
      actividad,
      altura: ruta.def.altura,
      inicio,
      semilla: semillaDe(v.clave),
      vuelta: v.vuelta,
      cortarEnM: v.cortarEnKm ? v.cortarEnKm * 1000 : undefined,
      libre: v.libre,
      paradasGrupo: (v.paradas ?? []).map((p) => ({ fraccion: p.en, minutos: p.min })),
      integrantes: claves.map((clave) => ({
        clave,
        ritmo: v.ritmos?.[clave],
        paradas: (v.paradasDe ?? [])
          .filter((p) => p.quien === clave)
          .map((p) => ({ fraccion: p.en, minutos: p.min })),
        saleEnFraccion: v.sale?.quien === clave ? v.sale.en : undefined,
      })),
    })

  // El viaje se programa a una hora redonda y arranca unos minutos después.
  let programado = momento(ctx.hoy, v.haceDias, v.hora)
  let sim = simular(new Date(programado.getTime() + 4 * MS_MIN))
  if (sim.fin.getTime() > ctx.ahora.getTime() - 20 * MS_MIN) {
    // Todavía no pudo haber terminado: se omite o se corre a la semana anterior.
    if (v.opcional) return null
    programado = new Date(programado.getTime() - 7 * MS_DIA)
    sim = simular(new Date(programado.getTime() + 4 * MS_MIN))
  }
  const inicio = new Date(programado.getTime() + 4 * MS_MIN)
  const fin = new Date(sim.fin.getTime() + MS_MIN)
  const duracionMs = sim.fin.getTime() - inicio.getTime()
  const esGrupal = v.integrantes.length > 0
  const params = parametrosPorActividad(actividad)
  const creado = new Date(programado.getTime() - (esGrupal ? 3 * MS_DIA : 15 * MS_MIN))
  const viajeId = randomUUID()
  const creadorId = id(v.creador)

  await prisma.viaje.create({
    data: {
      id: viajeId,
      creador_id: creadorId,
      nombre: v.nombre,
      es_grupal: esGrupal,
      tipo_actividad: actividad,
      modo: v.modo,
      velocidad_esperada: params.velocidadEsperada,
      distancia_max_separacion: params.distanciaMaxSeparacion,
      alerta_incidente_habilitada: esGrupal,
      estado: 'finalizado',
      fecha_programada: programado,
      fecha_inicio_real: inicio,
      fecha_fin_real: fin,
      created_at: creado,
    },
  })

  const traza = (clave: string) => sim.trazas.get(clave)!
  const ultimoPing = (clave: string) => traza(clave)[traza(clave).length - 1]!.timestamp
  /** Punto de la traza de alguien cuando iba `f` (0–1) del viaje. */
  const puntoEn = (clave: string, f: number): PuntoGps => {
    const t = traza(clave)
    return t[Math.min(t.length - 1, Math.round(f * (t.length - 1)))]!
  }
  const instante = (f: number) => new Date(inicio.getTime() + f * duracionMs)

  const origen = v.grupo ? ('grupo' as const) : ('amigo' as const)
  const grupo_origen_id = v.grupo ? ctx.grupo(v.grupo) : null
  await prisma.viajeIntegrante.createMany({
    data: [
      { viaje_id: viajeId, usuario_id: creadorId, estado: 'confirmado', origen: 'creador', check_in_at: inicio, created_at: creado },
      ...v.integrantes.map((clave, i) => ({
        viaje_id: viajeId,
        usuario_id: id(clave),
        estado: v.sale?.quien === clave ? ('salido' as const) : ('confirmado' as const),
        origen,
        grupo_origen_id,
        check_in_at: new Date(inicio.getTime() + (i % 3) * 40_000),
        fecha_salida: v.sale?.quien === clave ? ultimoPing(clave) : null,
        created_at: new Date(creado.getTime() + (i + 1) * 17 * MS_MIN),
      })),
      // RN-029c: confirmó pero no hizo check-in. No tiene traza ni métricas.
      ...(v.ausentes ?? []).map((clave) => ({
        viaje_id: viajeId,
        usuario_id: id(clave),
        estado: 'ausente' as const,
        origen,
        grupo_origen_id,
        created_at: new Date(creado.getTime() + 2 * MS_HORA),
      })),
      ...(v.rechazaron ?? []).map((clave) => ({
        viaje_id: viajeId,
        usuario_id: id(clave),
        estado: 'rechazado' as const,
        origen,
        grupo_origen_id,
        created_at: new Date(creado.getTime() + 3 * MS_HORA),
      })),
    ],
  })
  if (v.grupo) {
    await prisma.viajeGrupo.create({ data: { viaje_id: viajeId, grupo_id: ctx.grupo(v.grupo), created_at: creado } })
  }

  const filas = filasRuta(viajeId, v.ruta, actividad)
  await prisma.ruta.create({ data: filas.ruta })
  if (filas.paradas.length > 0) await prisma.paradaIntermedia.createMany({ data: filas.paradas })

  // Pings GPS. El tramo sin señal de alguien entra junto al reconectar (RN-038).
  const gps: Prisma.RegistroGPSCreateManyInput[] = []
  for (const clave of claves) {
    const t = traza(clave)
    const sinSenal = v.sinSenal?.quien === clave ? v.sinSenal : null
    const desde = sinSenal ? Math.floor(sinSenal.de * t.length) : -1
    const hasta = sinSenal ? Math.floor(sinSenal.a * t.length) : -1
    const reconexion = sinSenal ? t[Math.min(t.length - 1, hasta)]!.timestamp : null
    t.forEach((p, i) => {
      const offline = i >= desde && i < hasta
      gps.push({
        viaje_id: viajeId,
        usuario_id: id(clave),
        ...p,
        source: offline ? 'offline_sync' : 'live',
        created_at: offline ? reconexion! : new Date(p.timestamp.getTime() + 800),
      })
    })
  }
  await porLotes(gps, (lote) => prisma.registroGPS.createMany({ data: lote }), 2500)

  // Paradas: la simulación dice cuándo y dónde; el guion, de qué tipo fueron.
  const alertas: Prisma.AlertaCreateManyInput[] = []
  const paradas: Prisma.ParadaCreateManyInput[] = []
  const grupales = sim.paradas.filter((p) => p.clave === null).sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
  const grupalesGuion = [...(v.paradas ?? [])].sort((a, b) => a.en - b.en)
  grupales.forEach((p, i) => {
    const categoria: CategoriaParada = grupalesGuion[i]?.categoria ?? 'descanso'
    // RN-045: una fila por integrante presente, todas con el mismo inicio.
    for (const clave of claves.filter((c) => ultimoPing(c).getTime() >= p.inicio.getTime())) {
      paradas.push({
        viaje_id: viajeId,
        usuario_id: id(clave),
        lat: p.lat,
        lng: p.lng,
        tipo: 'voluntaria',
        categoria,
        inicio: p.inicio,
        fin: p.fin,
        grupal: true,
      })
    }
  })
  for (const clave of claves) {
    const propias = sim.paradas.filter((p) => p.clave === clave).sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    const guion = (v.paradasDe ?? []).filter((p) => p.quien === clave).sort((a, b) => a.en - b.en)
    propias.forEach((p, i) => {
      const g = guion[i]
      paradas.push({
        viaje_id: viajeId,
        usuario_id: id(clave),
        lat: p.lat,
        lng: p.lng,
        tipo: g?.incidente ? 'incidente_detectado' : 'voluntaria',
        categoria: g?.incidente ? null : (g?.categoria ?? 'otro'),
        inicio: p.inicio,
        fin: p.fin,
        confirmado_bien: g?.incidente ? true : null,
        grupal: false,
      })
      if (g?.incidente) {
        // RN-036: el motor avisa al grupo; la persona después confirma que está bien.
        alertas.push({
          viaje_id: viajeId,
          creada_por_id: null,
          tipo: 'peligro',
          origen: 'sistema',
          mensaje: `${prefijoAlertaAfectado(id(clave))}Posible incidente — ${nombre(clave)} lleva 5 min detenido sin registrar parada`,
          lat: p.lat,
          lng: p.lng,
          estado: 'resuelta',
          created_at: new Date(p.inicio.getTime() + 5 * MS_MIN),
          resolved_at: p.fin,
        })
      }
    })
  }
  if (paradas.length > 0) await prisma.parada.createMany({ data: paradas })

  for (const a of v.alertas ?? []) {
    const p = puntoEn(a.por, a.f)
    const mensaje =
      a.origen !== 'sistema'
        ? (a.mensaje ?? null)
        : a.tipo === 'desvio'
          ? `${prefijoAlertaAfectado(id(a.por))}${nombre(a.por)} se desvió ~${a.metros ?? 200} m de la ruta`
          : `${prefijoAlertaAfectado(id(a.por))}${nombre(a.por)} va ~${a.metros ?? 500} m atrás del grupo`
    alertas.push({
      viaje_id: viajeId,
      creada_por_id: a.origen === 'sistema' ? null : id(a.por),
      tipo: a.tipo,
      origen: a.origen,
      mensaje,
      lat: p.lat,
      lng: p.lng,
      estado: a.estado ?? 'resuelta',
      created_at: instante(a.f),
      resolved_at: new Date(Math.min(fin.getTime(), instante(a.f).getTime() + (4 + Math.floor(azar() * 10)) * MS_MIN)),
    })
  }
  if (alertas.length > 0) await prisma.alerta.createMany({ data: alertas })

  if (v.solicitudes?.length) {
    await prisma.solicitudParada.createMany({
      data: v.solicitudes.map((s) => {
        const p = puntoEn(s.por, s.f)
        return {
          viaje_id: viajeId,
          solicitante_id: id(s.por),
          lat: p.lat,
          lng: p.lng,
          motivo: s.motivo,
          estado: s.estado,
          resuelta_por_id: s.estado === 'cancelada' ? null : creadorId,
          created_at: instante(s.f),
          resolved_at: new Date(instante(s.f).getTime() + 90_000),
        }
      }),
    })
  }

  for (const [i, g] of (v.gastos ?? []).entries()) {
    await prisma.gasto.create({
      data: {
        viaje_id: viajeId,
        usuario_id: id(g.por),
        monto: g.monto,
        descripcion: g.descripcion,
        created_at: instante((i + 1) / ((v.gastos?.length ?? 0) + 1)),
        participantes: { createMany: { data: (g.entre ?? claves).map((clave) => ({ usuario_id: id(clave) })) } },
      },
    })
  }

  await prisma.checklistItem.createMany({
    data: filasChecklist({
      viajeId,
      actividad,
      creador: v.creador,
      personas: claves,
      delLider: v.checklistLider ?? [],
      completado: () => 0.92,
      creado,
      ctx,
      azar,
    }),
  })

  if (v.noComparte?.length) {
    await prisma.privacidadViaje.createMany({
      data: v.noComparte.map((clave) => ({ viaje_id: viajeId, usuario_id: id(clave), comparte_ubicacion: false })),
    })
  }

  // RN-112: quién vio la ubicación de quién, agregado por trío (viaje, observado, observador).
  if (esGrupal) {
    const comparten = claves.filter((c) => !(v.noComparte ?? []).includes(c))
    const accesos: Prisma.AccesoUbicacionCreateManyInput[] = []
    for (const observado of comparten) {
      for (const observador of claves) {
        if (observado === observador) continue
        accesos.push({
          viaje_id: viajeId,
          observado_id: id(observado),
          observador_id: id(observador),
          primera_vez: new Date(inicio.getTime() + Math.floor(azar() * 8) * MS_MIN),
          ultima_vez: new Date(sim.fin.getTime() - Math.floor(azar() * 10) * MS_MIN),
          veces: 4 + Math.floor(azar() * 60),
        })
      }
    }
    await prisma.accesoUbicacion.createMany({ data: accesos })
  }

  return { clave: v.clave, viajeId, creadorId, fin }
}

// ── Viajes planificados ──────────────────────────────────────────────────────

async function sembrarPlanificado(p: ViajePlanificado, ctx: Contexto): Promise<string> {
  const actividad = p.actividad ?? rutaDemo(p.ruta!).def.actividad
  const azar = crearAzar(semillaDe(p.clave))
  const id = ctx.usuario
  const viajeId = randomUUID()
  const confirmados = p.confirmados ?? []
  const pendientes = p.pendientes ?? []
  const rechazados = p.rechazados ?? []
  const esGrupal = confirmados.length + pendientes.length + rechazados.length > 0
  const params = parametrosPorActividad(actividad)
  const creado = new Date(ctx.ahora.getTime() - (1 + Math.floor(azar() * 4)) * MS_DIA)
  const origen = p.grupo ? ('grupo' as const) : ('amigo' as const)
  const grupo_origen_id = p.grupo ? ctx.grupo(p.grupo) : null

  await prisma.viaje.create({
    data: {
      id: viajeId,
      creador_id: id(p.creador),
      nombre: p.nombre,
      es_grupal: esGrupal,
      tipo_actividad: actividad,
      modo: p.modo,
      velocidad_esperada: params.velocidadEsperada,
      distancia_max_separacion: params.distanciaMaxSeparacion,
      alerta_incidente_habilitada: esGrupal,
      estado: 'planificado',
      fecha_programada: momento(ctx.hoy, -p.enDias, p.hora),
      created_at: creado,
    },
  })
  const invitado = (estado: 'confirmado' | 'pendiente' | 'rechazado') => (clave: string, i: number) => ({
    viaje_id: viajeId,
    usuario_id: id(clave),
    estado,
    origen,
    grupo_origen_id,
    created_at: new Date(creado.getTime() + (i + 1) * 9 * MS_MIN),
  })
  await prisma.viajeIntegrante.createMany({
    data: [
      { viaje_id: viajeId, usuario_id: id(p.creador), estado: 'confirmado', origen: 'creador', created_at: creado },
      ...confirmados.map(invitado('confirmado')),
      ...pendientes.map(invitado('pendiente')),
      ...rechazados.map(invitado('rechazado')),
    ],
  })
  if (p.grupo) await prisma.viajeGrupo.create({ data: { viaje_id: viajeId, grupo_id: ctx.grupo(p.grupo), created_at: creado } })

  if (p.ruta) {
    const filas = filasRuta(viajeId, p.ruta, actividad)
    await prisma.ruta.create({ data: filas.ruta })
    if (filas.paradas.length > 0) await prisma.paradaIntermedia.createMany({ data: filas.paradas })
  }

  // Preparativos a medio hacer: es lo que se muestra en la pantalla de checklist.
  await prisma.checklistItem.createMany({
    data: filasChecklist({
      viajeId,
      actividad,
      creador: p.creador,
      personas: [p.creador, ...confirmados],
      delLider: p.checklistLider ?? [],
      completado: (clave) => (clave === PROTAGONISTA ? 0.6 : 0.2 + azar() * 0.7),
      creado,
      ctx,
      azar,
    }),
  })
  return viajeId
}

/**
 * RN-066: circuitos de entrenamiento de la tab Entrenar. Se escriben igual que los
 * deja "Repetir": cada sesión apunta a la anterior (`repite_viaje_id`) y todas quedan
 * en el circuito de su dueño. Una sesión `opcional` que no se sembró se saltea.
 */
async function sembrarCircuitos(
  ctx: Contexto,
  vitrina: ViajeSembrado[],
  planificados: Map<string, string>
): Promise<number> {
  let creados = 0
  for (const c of CIRCUITOS) {
    const usuarioId = ctx.usuario(c.de)
    const sesiones = c.sesiones.flatMap((clave) => {
      const def = VIAJES_VITRINA.find((v) => v.clave === clave)
      if (!def) throw new Error(`El circuito "${c.nombre}" nombra el viaje "${clave}" que no existe`)
      if (def.modo !== 'entrenamiento' || ![def.creador, ...def.integrantes].includes(c.de)) {
        throw new Error(`"${clave}" no es una sesión de entrenamiento de ${c.de} (circuito "${c.nombre}")`)
      }
      const sembrado = vitrina.find((v) => v.clave === clave)
      return sembrado ? [{ ...sembrado, actividad: def.actividad ?? rutaDemo(def.ruta).def.actividad }] : []
    })
    const primera = sesiones[0]
    const ultima = sesiones[sesiones.length - 1]
    if (!primera || !ultima) continue

    const circuito = await prisma.circuitoEntrenamiento.create({
      data: {
        usuario_id: usuarioId,
        nombre: c.nombre,
        tipo_actividad: primera.actividad,
        // El circuito nace con la primera repetición.
        created_at: (sesiones[1] ?? primera).fin,
        sesiones: {
          create: sesiones.map((s) => ({ usuario_id: usuarioId, viaje_id: s.viajeId, created_at: s.fin })),
        },
      },
      select: { id: true },
    })
    await Promise.all(
      sesiones.slice(1).map((s, i) =>
        prisma.viaje.update({ where: { id: s.viajeId }, data: { repite_viaje_id: sesiones[i]!.viajeId } })
      )
    )

    if (c.repeticionPlanificada) {
      const viajeId = planificados.get(c.repeticionPlanificada)
      if (!viajeId) {
        throw new Error(`El circuito "${c.nombre}" nombra el planificado "${c.repeticionPlanificada}" que no existe`)
      }
      await prisma.viaje.update({ where: { id: viajeId }, data: { repite_viaje_id: ultima.viajeId } })
      await prisma.circuitoSesion.create({
        data: { usuario_id: usuarioId, viaje_id: viajeId, circuito_id: circuito.id },
      })
    }
    creados++
  }
  return creados
}

// ── Cierre: métricas, insignias y rachas ─────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const soloLimpiar = args.includes('--limpiar')
  const iPassword = args.indexOf('--password')
  const password = iPassword >= 0 ? args[iPassword + 1] : PASSWORD_POR_DEFECTO
  if (!password || password.length < 8) {
    throw new Error('La contraseña tiene que tener al menos 8 caracteres (RN-003)')
  }
  if (process.env.NODE_ENV === 'production' && !args.includes('--forzar')) {
    throw new Error('NODE_ENV=production: el seed de demo no corre en producción sin --forzar')
  }

  log(`Base de datos: ${baseDestino()} (según ${ARCHIVO_ENV})`)
  const borrados = await limpiar()
  log(`Limpieza: ${borrados} usuarios demo anteriores y todo lo que colgaba de ellos`)
  if (soloLimpiar) {
    await borrarCuentasFirebase()
    return
  }

  const ahora = new Date()
  const hoy = diaArg(ahora)
  const usuarios = await crearUsuarios(hoy, password)
  const grupos = new Map<string, string>()
  const buscar = (mapa: Map<string, string>, que: string) => (clave: string) => {
    const valor = mapa.get(clave)
    if (!valor) throw new Error(`El guion nombra ${que} "${clave}" que no existe`)
    return valor
  }
  const ctx: Contexto = {
    ahora,
    hoy,
    usuario: buscar(usuarios, 'al usuario'),
    grupo: buscar(grupos, 'al grupo'),
    ficha: (clave) => {
      const ficha = ELENCO.find((u) => u.clave === clave)
      if (!ficha) throw new Error(`El guion nombra al usuario "${clave}" que no existe`)
      return ficha
    },
  }
  for (const [clave, id] of await crearGrupos(ctx)) grupos.set(clave, id)
  await crearRelaciones(ctx)
  log(`${ELENCO.length} usuarios, ${GRUPOS.length} grupos, ${AMISTADES.length} amistades, ${INVITACIONES_GRUPO.length} invitaciones a grupos`)

  // Viajes con traza.
  const vitrina = (await enParalelo(VIAJES_VITRINA, 5, (v) => sembrarVitrina(v, ctx))).filter(
    (v): v is ViajeSembrado => v !== null
  )
  const puntos = await prisma.registroGPS.count({ where: { usuario: FILTRO_DEMO } })
  log(`${vitrina.length} viajes con traza GPS (${puntos.toLocaleString('es-AR')} puntos)`)

  // Viajes sin traza. Primero los viajes; lo que cuelga de ellos entra en paralelo.
  const relleno = generarRelleno(ctx)
  await porLotes(relleno.viajes, (l) => prisma.viaje.createMany({ data: l }))
  await Promise.all([
    porLotes(relleno.integrantes, (l) => prisma.viajeIntegrante.createMany({ data: l })),
    porLotes(relleno.viajeGrupos, (l) => prisma.viajeGrupo.createMany({ data: l })),
    porLotes(relleno.rutas, (l) => prisma.ruta.createMany({ data: l }), 40).then(() =>
      porLotes(relleno.paradasIntermedias, (l) => prisma.paradaIntermedia.createMany({ data: l }))
    ),
    porLotes(relleno.resumenes, (l) => prisma.resumenViaje.createMany({ data: l })),
    porLotes(relleno.metricas, (l) => prisma.metricaViaje.createMany({ data: l })),
    porLotes(relleno.paradas, (l) => prisma.parada.createMany({ data: l })),
    porLotes(relleno.alertas, (l) => prisma.alerta.createMany({ data: l })),
    porLotes(relleno.solicitudes, (l) => prisma.solicitudParada.createMany({ data: l })),
    porLotes(relleno.gastos, (l) => prisma.gasto.createMany({ data: l })).then(() =>
      porLotes(relleno.gastoParticipantes, (l) => prisma.gastoParticipante.createMany({ data: l }))
    ),
    porLotes(relleno.checklist, (l) => prisma.checklistItem.createMany({ data: l })),
    porLotes(relleno.privacidad, (l) => prisma.privacidadViaje.createMany({ data: l })),
  ])
  log(`${relleno.viajes.length} viajes de relleno para rankings y reportes`)

  // Cierre, paso 1: los viajes con traza pasan por el cierre real del backend, que calcula
  // resumen y métricas con PostGIS a partir de los puntos GPS. No depende del orden.
  const viajes = new ViajesService(prisma)
  await enParalelo(vitrina, 5, (v) => viajes.obtenerResumen(v.creadorId, v.viajeId))

  // Cierre, paso 2: insignias (RN-074) y rachas (RN-075). Estas sí dependen del orden: cuál
  // fue el viaje que ganó la insignia, y si la semana siguiente hubo actividad. El paso 1
  // ya las otorgó, pero en el orden en que terminó cada consulta: se descartan y se
  // vuelven a otorgar recorriendo los viajes de cada persona del más viejo al más nuevo,
  // con los mismos servicios que usa el backend al finalizar un viaje.
  await prisma.usuarioInsignia.deleteMany({ where: { usuario: FILTRO_DEMO } })
  await prisma.rachaActividad.deleteMany({ where: { usuario: FILTRO_DEMO } })
  const metricas = await prisma.metricaViaje.findMany({
    where: { usuario: FILTRO_DEMO },
    select: {
      usuario_id: true,
      viaje_id: true,
      distancia_m: true,
      tiempo_movimiento_seg: true,
      viaje: { select: { tipo_actividad: true, fecha_fin_real: true } },
    },
  })
  const porPersona = new Map<string, typeof metricas>()
  for (const m of metricas) porPersona.set(m.usuario_id, [...(porPersona.get(m.usuario_id) ?? []), m])
  const insignias = new InsigniasService(prisma)
  const rachas = new RachasService(prisma)
  const finDe = (m: (typeof metricas)[number]) => m.viaje.fecha_fin_real ?? ahora
  await enParalelo([...porPersona.values()], 8, async (suyas) => {
    for (const m of suyas.sort((a, b) => finDe(a).getTime() - finDe(b).getTime())) {
      await Promise.all([
        insignias.evaluarYOtorgar(m.usuario_id, m.viaje_id, m.viaje.tipo_actividad, m.distancia_m, m.tiempo_movimiento_seg),
        rachas.registrarActividad(m.usuario_id, finDe(m)),
      ])
    }
  })

  // El cierre real sella todo con la hora actual: se lleva a la fecha de cada viaje.
  await prisma.$executeRaw`
    UPDATE usuario_insignia ui SET obtenida_at = v.fecha_fin_real
    FROM viaje v, usuario u
    WHERE v.id = ui.viaje_id AND u.id = ui.usuario_id AND u.email LIKE ${`%@${DOMINIO_DEMO}`}`
  await prisma.$executeRaw`
    UPDATE metrica_viaje m SET generado_en = v.fecha_fin_real
    FROM viaje v, usuario u
    WHERE v.id = m.viaje_id AND u.id = v.creador_id AND u.email LIKE ${`%@${DOMINIO_DEMO}`}`
  await prisma.$executeRaw`
    UPDATE resumen_viaje r SET generado_en = v.fecha_fin_real
    FROM viaje v, usuario u
    WHERE v.id = r.viaje_id AND u.id = v.creador_id AND u.email LIKE ${`%@${DOMINIO_DEMO}`}`
  log(`${vitrina.length + relleno.viajes.length} viajes cerrados: métricas, insignias y rachas calculadas`)

  // Recorridos publicados y valoraciones (RN-081 a RN-083), con el servicio real.
  const recorridos = new RecorridosPublicadosService(prisma)
  const publicados = new Map<string, string>()
  const votantes = ELENCO.filter((u) => !u.login && !u.nuevo && !u.suspendido).map((u) => u.clave)
  await enParalelo(VIAJES_VITRINA, 4, async (v) => {
    const sembrado = vitrina.find((x) => x.clave === v.clave)
    if (!v.publicar || !sembrado) return
    const pub = await recorridos.publicar(ctx.usuario(v.publicar.por), sembrado.viajeId, {
      comentario: v.publicar.comentario ?? null,
      compartirChecklist: v.publicar.checklist,
    })
    publicados.set(v.clave, pub.id)
    const publicadoAt = new Date(Math.min(sembrado.fin.getTime() + 20 * MS_HORA, ahora.getTime() - 2 * MS_HORA))
    await prisma.recorridoPublicado.update({ where: { id: pub.id }, data: { publicado_at: publicadoAt } })

    const azar = crearAzar(semillaDe(`votos:${v.clave}`))
    const [si, no] = v.publicar.votos
    const quienes = votantes.filter((c) => c !== v.publicar!.por).slice(0, si + no)
    const hastaAhora = ahora.getTime() - publicadoAt.getTime() - 10 * MS_MIN
    const votos: Prisma.ValoracionRecorridoCreateManyInput[] = quienes.map((clave, i) => ({
      recorrido_publicado_id: pub.id,
      usuario_id: ctx.usuario(clave),
      recomiendo: i < si,
      created_at: new Date(publicadoAt.getTime() + azar() * hastaAhora),
    }))
    if (v.publicar.votoProtagonista !== undefined) {
      votos.push({
        recorrido_publicado_id: pub.id,
        usuario_id: ctx.usuario(PROTAGONISTA),
        recomiendo: v.publicar.votoProtagonista,
        created_at: new Date(ahora.getTime() - 3 * MS_HORA),
      })
    }
    if (votos.length > 0) await prisma.valoracionRecorrido.createMany({ data: votos })
  })
  log(`${publicados.size} recorridos publicados con sus valoraciones`)

  // Planificados, links de ruta y rutas guardadas (RN-084 a RN-086).
  const compartidas = new RutasCompartidasService(prisma)
  const protagonistaId = ctx.usuario(PROTAGONISTA)
  const planificados = new Map<string, string>()
  await enParalelo(VIAJES_PLANIFICADOS, 4, async (p) => {
    const viajeId = await sembrarPlanificado(p, ctx)
    planificados.set(p.clave, viajeId)
    if (!p.compartirRuta) return
    const { token } = await compartidas.compartirRuta(ctx.usuario(p.creador), viajeId)
    if (p.protagonistaGuardaRuta) await compartidas.importarPorToken(protagonistaId, token)
  })
  await enParalelo(relleno.compartir, 4, (c) => compartidas.compartirRuta(c.creadorId, c.viajeId))
  for (const g of RUTAS_GUARDADAS) {
    const recorridoId = publicados.get(g.viaje)
    if (!recorridoId) continue
    const { plantilla } = await recorridos.importar(protagonistaId, recorridoId, { guardarChecklist: g.conChecklist })
    await prisma.rutaPlantilla.update({
      where: { id: plantilla.id },
      data: { created_at: momento(hoy, g.haceDias, 21) },
    })
  }
  log(`${VIAJES_PLANIFICADOS.length} viajes planificados y las rutas guardadas de la protagonista`)

  // Circuitos de entrenamiento (RN-066): necesitan las sesiones cerradas y los planificados.
  const circuitos = await sembrarCircuitos(ctx, vitrina, planificados)
  log(`${circuitos} circuitos de entrenamiento`)

  // Bitácora del backoffice (RN-121). `demo: true` la distingue de acciones reales.
  const ficha = (clave: string) => ({ email: email(clave), demo: true })
  const auditoria: [string | null, string, string, string, Prisma.InputJsonObject, number][] = [
    [null, 'usuario.cambiar_rol', 'usuario', protagonistaId, { ...ficha(PROTAGONISTA), de: 'usuario', a: 'superadmin', origen: 'cli' }, 300],
    [PROTAGONISTA, 'usuario.eliminar', 'usuario', randomUUID(), { email: 'spam.promos@correo.test', nombre: 'Promos Ya', grupos_transferidos: 0, grupos_eliminados: 0, viajes_transferidos: 0, viajes_eliminados: 1, demo: true }, 90],
    [PROTAGONISTA, 'usuario.suspender', 'usuario', ctx.usuario('carolina'), { ...ficha('carolina'), motivo: 'Cuenta duplicada, pendiente de verificación' }, 78],
    [PROTAGONISTA, 'usuario.reactivar', 'usuario', ctx.usuario('carolina'), ficha('carolina'), 70],
    [PROTAGONISTA, 'grupo.eliminar', 'grupo', randomUUID(), { nombre: 'Grupo de prueba', lider_id: protagonistaId, demo: true }, 55],
    [PROTAGONISTA, 'viaje.eliminar', 'viaje', randomUUID(), { estado: 'planificado', demo: true }, 41],
    [PROTAGONISTA, 'viaje.finalizar', 'viaje', relleno.viajes[0]?.id ?? randomUUID(), { demo: true }, 33],
    [PROTAGONISTA, 'usuario.editar', 'usuario', ctx.usuario('paula'), { campos: ['nombre', 'apellido'], demo: true }, 20],
    [PROTAGONISTA, 'grupo.quitar_miembro', 'grupo', ctx.grupo('nocturna'), { nombre: 'Rodada Nocturna', usuario_id: ctx.usuario('ramiro'), resultado: 'quitado', lider_nuevo_id: null, demo: true }, DIAS_SUSPENSION],
    [PROTAGONISTA, 'usuario.suspender', 'usuario', ctx.usuario('ramiro'), { ...ficha('ramiro'), motivo: ctx.ficha('ramiro').suspendido ?? '' }, DIAS_SUSPENSION],
  ]
  await prisma.auditoriaAdmin.createMany({
    data: auditoria.map(([actor, accion, entidad, entidad_id, detalle, haceDias], i) => ({
      actor_id: actor ? ctx.usuario(actor) : null,
      accion,
      entidad,
      entidad_id,
      detalle,
      created_at: momento(hoy, haceDias, 16 + (i % 3) * 0.1),
    })),
  })

  await resumenFinal(ctx, password)
}

/** Lo que va a ver la protagonista al entrar, leído con los mismos servicios que la app. */
async function resumenFinal(ctx: Contexto, password: string) {
  const id = ctx.usuario(PROTAGONISTA)
  const ficha = ctx.ficha(PROTAGONISTA)
  const [stats, racha, insignias, catalogo] = await Promise.all([
    new ViajesService(prisma).estadisticasUsuario(id),
    new RachasService(prisma).obtenerRachaVigente(id),
    new InsigniasService(prisma).listarDeUsuario(id),
    prisma.insignia.count({ where: { activa: true } }),
  ])
  const tabla = new TablaPosicionesService(prisma)
  const posiciones = await Promise.all(
    (['bici', 'running', 'trekking'] as const).map(async (actividad) => {
      const t = await tabla.obtener(id, actividad, 'mensual', 'distancia')
      return `${actividad} ${t.mi_posicion ? `${t.mi_posicion.puesto}°` : 's/d'} de ${t.total_participantes}`
    })
  )

  console.log(`
Listo. Cuentas para iniciar sesión (contraseña: ${password})
${ELENCO.filter((u) => u.login)
  .map((u) => `  ${email(u.clave).padEnd(22)} ${u.nombre} ${u.apellido}${u.superadmin ? ' — protagonista y superadmin' : ''}`)
  .join('\n')}

${ficha.nombre} hoy:
  ${stats.viajes_finalizados} viajes finalizados · ${(stats.distancia_total_m / 1000).toFixed(0)} km · actividad favorita: ${stats.actividad_favorita}
  racha de ${racha.semanas_consecutivas} semanas${racha.en_riesgo ? ' (en riesgo: todavía sin actividad esta semana)' : ''}
  ${insignias.length} de ${catalogo} insignias: ${insignias.map((i) => i.nombre).join(', ')}
  ranking mensual: ${posiciones.join(' · ')}
`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    // Firebase y el pool de Postgres dejan conexiones abiertas: se corta acá.
    process.exit()
  })
