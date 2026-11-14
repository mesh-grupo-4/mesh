/**
 * Viajes de relleno del seed de demo: finalizados, entre usuarios sin login y sin traza
 * GPS. Dan volumen a rankings, rachas, insignias y a la reportería del backoffice.
 *
 * Solo arma las filas en memoria; `seed.ts` las inserta. Es determinístico: la misma
 * semilla genera siempre los mismos viajes (las fechas se corren con el día del seed).
 */
import { randomUUID } from 'node:crypto'
import type { EstadoViajeIntegrante, ModoViaje, Prisma, TipoActividad } from '@prisma/client'
import { esMotorizado } from '../../lib/actividad'
import { nombreVisible } from '../../lib/nombres'
import { itemsSugeridos } from '../../modules/checklist/checklistDefaults'
import { prefijoAlertaAfectado } from '../../modules/motor-eventos/motorEventos.config'
import { inicioBalde, inicioDiaArg } from '../../modules/reportes/reportes.periodo'
import { parametrosPorActividad } from '../../modules/viajes/activityDefaults'
import { filasRuta, momento, MS_DIA, MS_HORA, MS_MIN, rutaDemo, type Contexto } from './comun'
import {
  AMISTADES,
  ELENCO,
  GASTOS_RELLENO,
  GRUPOS,
  MENSAJES_ALERTA,
  MOTIVOS_SOLICITUD,
  RELLENO,
  RUTAS_POR_ACTIVIDAD,
  type UsuarioDemo,
} from './guion'
import { crearAzar, velocidadCruceroKmh } from './trazas'

export type Relleno = {
  viajes: Prisma.ViajeCreateManyInput[]
  integrantes: Prisma.ViajeIntegranteCreateManyInput[]
  viajeGrupos: Prisma.ViajeGrupoCreateManyInput[]
  rutas: Prisma.RutaCreateManyInput[]
  paradasIntermedias: Prisma.ParadaIntermediaCreateManyInput[]
  resumenes: Prisma.ResumenViajeCreateManyInput[]
  metricas: Prisma.MetricaViajeCreateManyInput[]
  paradas: Prisma.ParadaCreateManyInput[]
  alertas: Prisma.AlertaCreateManyInput[]
  solicitudes: Prisma.SolicitudParadaCreateManyInput[]
  gastos: Prisma.GastoCreateManyInput[]
  gastoParticipantes: Prisma.GastoParticipanteCreateManyInput[]
  checklist: Prisma.ChecklistItemCreateManyInput[]
  privacidad: Prisma.PrivacidadViajeCreateManyInput[]
  /** Viajes cuya ruta se compartió por link (RN-085). */
  compartir: { viajeId: string; creadorId: string }[]
}

/** Días que lleva suspendido el usuario suspendido del guion: antes de eso sí viajaba. */
export const DIAS_SUSPENSION = 12

type Plan = { creador: UsuarioDemo; inicio: Date; solo: boolean; actividad: TipoActividad }

export function generarRelleno(ctx: Contexto): Relleno {
  const azar = crearAzar(RELLENO.semilla)
  const entre = (min: number, max: number) => min + azar() * (max - min)
  const entero = (min: number, max: number) => Math.floor(entre(min, max + 1))
  const elegir = <T>(lista: T[]): T => lista[Math.floor(azar() * lista.length)]!
  const mezclar = <T>(lista: T[]): T[] => {
    const copia = [...lista]
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1))
      ;[copia[i], copia[j]] = [copia[j]!, copia[i]!]
    }
    return copia
  }

  const r: Relleno = {
    viajes: [],
    integrantes: [],
    viajeGrupos: [],
    rutas: [],
    paradasIntermedias: [],
    resumenes: [],
    metricas: [],
    paradas: [],
    alertas: [],
    solicitudes: [],
    gastos: [],
    gastoParticipantes: [],
    checklist: [],
    privacidad: [],
    compartir: [],
  }

  const candidatos = ELENCO.filter((u) => !u.login && !u.nuevo && !u.soloVitrina)
  const hoyInicio = inicioDiaArg(ctx.hoy).getTime()

  /** ¿Esa persona ya tenía cuenta (y no estaba suspendida) ese día? */
  const disponible = (u: UsuarioDemo, cuando: Date) => {
    const diasAtras = (ctx.ahora.getTime() - cuando.getTime()) / MS_DIA
    if (diasAtras >= u.altaHaceDias - 1) return false
    if (u.suspendido && diasAtras <= DIAS_SUSPENSION + 1) return false
    return true
  }

  const horaTipica = (actividad: TipoActividad): number => {
    if (actividad === 'running') return azar() < 0.6 ? entre(6.5, 8.5) : entre(18, 20)
    if (actividad === 'bici') return azar() < 0.7 ? entre(7, 9) : entre(16.5, 18)
    if (actividad === 'trekking') return entre(7, 9.5)
    if (actividad === 'otro') return entre(16, 19)
    return entre(8.5, 11)
  }

  // ── A quién le toca viajar y cuándo ────────────────────────────────────────
  const planes: Plan[] = []

  // Rachas (RN-075): una salida por semana calendario, de la actual hacia atrás.
  const lunesActual = inicioDiaArg(inicioBalde(ctx.hoy, 'semana')).getTime()
  for (const u of candidatos) {
    for (let semana = 0; semana < (u.rachaSemanas ?? 0); semana++) {
      const lunes = lunesActual - semana * 7 * MS_DIA
      // Solo días ya terminados: si hoy es lunes, esta semana todavía no tiene ninguno.
      const dias = [0, 1, 2, 3, 4, 5, 6].filter((d) => lunes + d * MS_DIA < hoyInicio)
      if (dias.length === 0) continue
      const finde = dias.filter((d) => d >= 5)
      const dia = finde.length > 0 && azar() < 0.6 ? elegir(finde) : elegir(dias)
      const inicio = new Date(lunes + dia * MS_DIA + horaTipica(u.actividad) * MS_HORA)
      if (disponible(u, inicio)) planes.push({ creador: u, inicio, solo: azar() < 0.55, actividad: u.actividad })
    }
  }

  // El resto: algo más de viajes cuanto más reciente, y más los fines de semana.
  const ACTIVIDADES: TipoActividad[] = ['moto', 'auto', 'bici', 'running', 'trekking']
  let intentos = 0
  while (planes.length < RELLENO.cantidad && intentos++ < 5000) {
    const haceDias = 1 + Math.floor(azar() ** 1.3 * (RELLENO.dias - 1))
    const dia = momento(ctx.hoy, haceDias, 0)
    const diaSemana = new Date(dia.getTime() - 3 * MS_HORA).getUTCDay()
    const esFinde = diaSemana === 0 || diaSemana === 6
    if (!esFinde && azar() > 0.42) continue
    const creador = elegir(candidatos)
    const actividad = azar() < 0.78 ? creador.actividad : azar() < 0.04 ? 'otro' : elegir(ACTIVIDADES)
    const inicio = new Date(dia.getTime() + horaTipica(actividad) * MS_HORA)
    if (!disponible(creador, inicio)) continue
    planes.push({ creador, inicio, solo: azar() < 0.38, actividad })
  }

  // ── Un viaje por plan ──────────────────────────────────────────────────────
  for (const plan of planes) {
    const { creador, inicio, actividad } = plan
    const motorizado = esMotorizado(actividad)
    const opciones = RUTAS_POR_ACTIVIDAD[actividad]
    const pesoTotal = opciones.reduce((s, o) => s + o.peso, 0)
    let tirada = azar() * pesoTotal
    const opcion = opciones.find((o) => (tirada -= o.peso) < 0) ?? opciones[0]!
    const ruta = rutaDemo(opcion.ruta)
    const vuelta = Boolean(opcion.vuelta)

    // Compañeros: primero un grupo en común, si no, amigos.
    let grupoClave: string | undefined
    let companeros: UsuarioDemo[] = []
    if (!plan.solo) {
      const grupos = GRUPOS.filter(
        (g) =>
          [g.lider, ...g.miembros].includes(creador.clave) &&
          (ctx.ahora.getTime() - inicio.getTime()) / MS_DIA < g.creadoHaceDias - 1
      )
      const amigos = AMISTADES.filter(
        (a) => a.estado === 'aceptada' && (a.de === creador.clave || a.a === creador.clave)
      ).map((a) => (a.de === creador.clave ? a.a : a.de))
      const deClaves = (claves: string[]) =>
        mezclar(
          claves
            .filter((c) => c !== creador.clave)
            .map((c) => ELENCO.find((u) => u.clave === c)!)
            .filter((u) => !u.login && !u.nuevo && disponible(u, inicio))
        )
      if (grupos.length > 0 && azar() < 0.7) {
        const g = elegir(grupos)
        grupoClave = g.clave
        companeros = deClaves([g.lider, ...g.miembros]).slice(0, entero(2, 5))
      } else {
        companeros = deClaves(amigos).slice(0, entero(1, 3))
      }
      if (companeros.length === 0) grupoClave = undefined
    }
    const esGrupal = companeros.length > 0

    let modo: ModoViaje = 'recreativo'
    if (!motorizado) {
      const t = azar()
      if (esGrupal) modo = t < 0.2 ? 'competitivo' : t < 0.4 ? 'entrenamiento' : 'recreativo'
      else modo = t < 0.55 ? 'entrenamiento' : 'recreativo'
    }

    // Cada compañero confirmó y fue, salvo algún ausente, uno que rechazó o uno que se bajó.
    const estados = new Map<string, EstadoViajeIntegrante>()
    for (const c of companeros) {
      const t = azar()
      estados.set(c.clave, t < 0.07 ? 'ausente' : t < 0.16 ? 'rechazado' : t < 0.21 ? 'salido' : 'confirmado')
    }
    const fueron = [creador, ...companeros.filter((c) => ['confirmado', 'salido'].includes(estados.get(c.clave)!))]

    // Tiempos: sin traza, se derivan del largo de la ruta y la velocidad de la actividad.
    const distanciaRutaM = ruta.distanciaM * (vuelta ? 2 : 1)
    const ritmoGrupo = entre(0.9, 1.1)
    const movimientoSeg = distanciaRutaM / ((velocidadCruceroKmh(actividad) * ritmoGrupo) / 3.6)
    const paradasPlan = esGrupal ? ruta.def.paradas.filter(() => azar() < 0.6) : []
    const minutosPorParada = paradasPlan.map((p) =>
      p.categoria === 'gastronomia' ? entero(20, 50) : entero(5, 15)
    )
    const detenidoSeg = minutosPorParada.reduce((s, m) => s + m * 60, 0)
    const duracionSeg = Math.round(movimientoSeg + detenidoSeg + entre(60, 300))
    const fin = new Date(inicio.getTime() + duracionSeg * 1000)
    if (fin.getTime() > ctx.ahora.getTime() - 30 * MS_MIN) continue

    const viajeId = randomUUID()
    const creadorId = ctx.usuario(creador.clave)
    const params = parametrosPorActividad(actividad)
    const creado = new Date(inicio.getTime() - (esGrupal ? entre(1, 6) * MS_DIA : entre(5, 40) * MS_MIN))
    const nombres: Record<TipoActividad, string[]> = {
      moto: ['Rodada', 'Salida en moto', 'Vuelta'],
      auto: ['Escapada', 'Paseo', 'Salida'],
      bici: ['Pedaleada', 'Salida en bici', 'Vuelta'],
      running: ['Trote', 'Fondo', 'Entrenamiento'],
      trekking: ['Trekking', 'Caminata', 'Ascenso'],
      otro: ['Salida', 'Paseo'],
    }
    const destino = ruta.def.destino.nombre.split(',')[0]!

    r.viajes.push({
      id: viajeId,
      creador_id: creadorId,
      nombre: `${elegir(nombres[actividad])} a ${destino}`,
      es_grupal: esGrupal,
      tipo_actividad: actividad,
      modo,
      velocidad_esperada: params.velocidadEsperada,
      distancia_max_separacion: params.distanciaMaxSeparacion,
      alerta_incidente_habilitada: esGrupal,
      estado: 'finalizado',
      fecha_programada: new Date(inicio.getTime() - entero(0, 12) * MS_MIN),
      fecha_inicio_real: inicio,
      fecha_fin_real: fin,
      created_at: creado,
    })

    r.integrantes.push({
      viaje_id: viajeId,
      usuario_id: creadorId,
      estado: 'confirmado',
      origen: 'creador',
      check_in_at: inicio,
      created_at: creado,
    })
    for (const c of companeros) {
      const estado = estados.get(c.clave)!
      const fue = estado === 'confirmado' || estado === 'salido'
      r.integrantes.push({
        viaje_id: viajeId,
        usuario_id: ctx.usuario(c.clave),
        estado,
        origen: grupoClave ? 'grupo' : 'amigo',
        grupo_origen_id: grupoClave ? ctx.grupo(grupoClave) : null,
        check_in_at: fue ? new Date(inicio.getTime() + entero(0, 4) * MS_MIN) : null,
        fecha_salida: estado === 'salido' ? new Date(inicio.getTime() + duracionSeg * 600) : null,
        created_at: new Date(creado.getTime() + entero(1, 30) * MS_MIN),
      })
    }
    if (grupoClave) r.viajeGrupos.push({ viaje_id: viajeId, grupo_id: ctx.grupo(grupoClave), created_at: creado })

    const conRuta = azar() < 0.88
    if (conRuta) {
      const filas = filasRuta(viajeId, opcion.ruta, actividad)
      r.rutas.push(filas.ruta)
      r.paradasIntermedias.push(...filas.paradas)
      if (azar() < 0.1) r.compartir.push({ viajeId, creadorId })
    }

    // Métricas por persona (RN-061). En competitivo cada uno tiene su propio ritmo.
    const rango = ruta.def.altura.pico - ruta.def.altura.base
    const lomas = ruta.def.altura.forma === 'llano' ? 3 : 1
    const sube = rango * lomas * (vuelta && ruta.def.altura.forma === 'paso' ? 2 : 1)
    const baja = ruta.def.altura.forma === 'subida' && !vuelta ? rango * 0.05 : sube
    // La distancia del viaje es la del creador, igual que en el cierre real.
    let distanciaCreadorM = 0
    for (const persona of fueron) {
      const tramo = estados.get(persona.clave) === 'salido' ? 0.6 : 1
      const ritmoPropio = modo === 'competitivo' ? entre(0.88, 1.12) : entre(0.98, 1.02)
      const distanciaM = distanciaRutaM * tramo * entre(0.985, 1.0)
      const tiempoSeg = Math.round((movimientoSeg * tramo) / ritmoPropio)
      const promedio = distanciaM / 1000 / (tiempoSeg / 3600)
      r.metricas.push({
        viaje_id: viajeId,
        usuario_id: ctx.usuario(persona.clave),
        distancia_m: distanciaM,
        tiempo_movimiento_seg: tiempoSeg,
        velocidad_promedio_kmh: promedio,
        velocidad_maxima_kmh: promedio * entre(1.25, 1.5),
        desnivel_positivo_m: Math.round(sube * tramo * entre(0.95, 1.05)),
        desnivel_negativo_m: Math.round(baja * tramo * entre(0.95, 1.05)),
        altitud_max_m: ruta.def.altura.pico,
        altitud_min_m: ruta.def.altura.base,
        generado_en: fin,
      })
      if (persona === creador) distanciaCreadorM = distanciaM
    }

    /** Punto del trazado al `f` (0–1) del recorrido, desandando si es ida y vuelta. */
    const posicion = (f: number) => {
      const enRuta = vuelta ? (f <= 0.5 ? f * 2 : 2 - f * 2) : f
      return ruta.camino.posicion(enRuta * ruta.camino.largoM)
    }
    const instante = (f: number) => new Date(inicio.getTime() + f * duracionSeg * 1000)

    // Paradas (RN-045): una grupal guarda una fila por integrante con el mismo inicio.
    let cantidadParadas = 0
    paradasPlan.forEach((p, i) => {
      const f = vuelta ? p.fraccion / 2 : p.fraccion
      const [lat, lng] = posicion(f)
      const desde = instante(Math.min(0.92, f))
      const hasta = new Date(desde.getTime() + minutosPorParada[i]! * MS_MIN)
      cantidadParadas++
      for (const persona of fueron) {
        r.paradas.push({
          viaje_id: viajeId,
          usuario_id: ctx.usuario(persona.clave),
          lat,
          lng,
          tipo: 'voluntaria',
          categoria: p.categoria,
          inicio: desde,
          fin: hasta,
          grupal: true,
        })
      }
    })
    if (azar() < (esGrupal ? 0.18 : 0.3)) {
      const quien = elegir(fueron)
      const f = entre(0.2, 0.8)
      const [lat, lng] = posicion(f)
      const incidente = esGrupal && azar() < 0.15
      const desde = instante(f)
      const hasta = new Date(desde.getTime() + entero(3, 9) * MS_MIN)
      if (!incidente) cantidadParadas++
      r.paradas.push({
        viaje_id: viajeId,
        usuario_id: ctx.usuario(quien.clave),
        lat,
        lng,
        tipo: incidente ? 'incidente_detectado' : 'voluntaria',
        categoria: incidente ? null : elegir(['descanso', 'sanitario', 'otro'] as const),
        inicio: desde,
        fin: hasta,
        confirmado_bien: incidente ? true : null,
        grupal: false,
      })
      if (incidente) {
        const afectadoId = ctx.usuario(quien.clave)
        r.alertas.push({
          viaje_id: viajeId,
          creada_por_id: null,
          tipo: 'peligro',
          origen: 'sistema',
          mensaje: `${prefijoAlertaAfectado(afectadoId)}Posible incidente — ${nombreVisible(quien.nombre, quien.apellido)} lleva 5 min detenido sin registrar parada`,
          lat,
          lng,
          estado: 'resuelta',
          created_at: new Date(desde.getTime() + 5 * MS_MIN),
          resolved_at: hasta,
        })
      }
    }

    r.resumenes.push({
      viaje_id: viajeId,
      duracion_segundos: duracionSeg,
      distancia_planeada_m: conRuta ? ruta.distanciaM : null,
      distancia_real_m: distanciaCreadorM,
      cantidad_paradas: cantidadParadas,
      generado_en: fin,
    })

    if (esGrupal) {
      // Alertas manuales del líder (RN-041) y automáticas del motor de eventos.
      if (azar() < 0.45) {
        for (const a of mezclar(MENSAJES_ALERTA).slice(0, entero(1, 2))) {
          const f = entre(0.1, 0.85)
          const [lat, lng] = posicion(f)
          const cancelada = azar() < 0.2
          r.alertas.push({
            viaje_id: viajeId,
            creada_por_id: creadorId,
            tipo: a.tipo,
            origen: 'lider',
            mensaje: a.mensaje,
            lat,
            lng,
            estado: cancelada ? 'cancelada' : 'resuelta',
            created_at: instante(f),
            resolved_at: new Date(instante(f).getTime() + entero(3, 15) * MS_MIN),
          })
        }
      }
      if (fueron.length > 1 && azar() < 0.3) {
        const quien = elegir(fueron.slice(1))
        const f = entre(0.2, 0.9)
        const [lat, lng] = posicion(f)
        const esAtraso = azar() < 0.65
        const nombre = nombreVisible(quien.nombre, quien.apellido)
        const metros = esAtraso ? entero(2, 12) * params.distanciaMaxSeparacion * 0.2 : entero(80, 600)
        r.alertas.push({
          viaje_id: viajeId,
          creada_por_id: null,
          tipo: esAtraso ? 'atraso' : 'desvio',
          origen: 'sistema',
          mensaje: esAtraso
            ? `${prefijoAlertaAfectado(ctx.usuario(quien.clave))}${nombre} va ~${Math.round(metros)} m atrás del grupo`
            : `${prefijoAlertaAfectado(ctx.usuario(quien.clave))}${nombre} se desvió ~${Math.round(metros)} m de la ruta`,
          lat,
          lng,
          estado: 'resuelta',
          created_at: instante(f),
          resolved_at: new Date(instante(f).getTime() + entero(2, 10) * MS_MIN),
        })
      }

      // Solicitudes de parada al líder (RN-044).
      if (fueron.length > 1 && azar() < 0.22) {
        const quien = elegir(fueron.slice(1))
        const f = entre(0.2, 0.85)
        const [lat, lng] = posicion(f)
        const t = azar()
        const estado = t < 0.65 ? 'aprobada' : t < 0.9 ? 'rechazada' : 'cancelada'
        r.solicitudes.push({
          viaje_id: viajeId,
          solicitante_id: ctx.usuario(quien.clave),
          lat,
          lng,
          motivo: elegir(MOTIVOS_SOLICITUD),
          estado,
          resuelta_por_id: estado === 'cancelada' ? null : creadorId,
          created_at: instante(f),
          resolved_at: new Date(instante(f).getTime() + entero(20, 240) * 1000),
        })
      }

      // Gastos compartidos.
      if (fueron.length > 1 && azar() < (motorizado ? 0.55 : 0.25)) {
        const descripciones = mezclar(GASTOS_RELLENO[motorizado ? 'motor' : 'resto']).slice(0, entero(1, 3))
        descripciones.forEach((descripcion, i) => {
          const gastoId = randomUUID()
          const paga = elegir(fueron)
          const todos = azar() < 0.75
          const repartidos = todos ? fueron : [paga, ...mezclar(fueron.filter((p) => p !== paga)).slice(0, 1)]
          r.gastos.push({
            id: gastoId,
            viaje_id: viajeId,
            usuario_id: ctx.usuario(paga.clave),
            monto: entero(motorizado ? 12 : 4, motorizado ? 95 : 40) * 1000,
            descripcion,
            created_at: instante(0.3 + i * 0.2),
          })
          for (const p of repartidos) {
            r.gastoParticipantes.push({ gasto_id: gastoId, usuario_id: ctx.usuario(p.clave) })
          }
        })
      }
    }

    // Checklist de preparativos (RN-026) de quien armó el viaje.
    if (azar() < 0.55) {
      itemsSugeridos(actividad).forEach((texto, orden) => {
        r.checklist.push({
          viaje_id: viajeId,
          usuario_id: creadorId,
          texto,
          origen: 'sugerido',
          completado: azar() < 0.85,
          orden,
          created_at: creado,
        })
      })
    }

    // Alguno prefiere no compartir su ubicación en ese viaje (RN-111).
    for (const persona of fueron.slice(1)) {
      if (azar() < 0.06) {
        r.privacidad.push({ viaje_id: viajeId, usuario_id: ctx.usuario(persona.clave), comparte_ubicacion: false })
      }
    }
  }

  return r
}
