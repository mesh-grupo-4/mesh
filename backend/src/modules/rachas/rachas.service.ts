import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { diaArg, inicioBalde } from '../reportes/reportes.periodo'

/** RN-075: hitos que disparan una notificación de logro. */
export const HITOS_RACHA = [3, 5, 10] as const

const MS_SEMANA = 7 * 86_400_000

/** Lunes (ART) de la semana que contiene `instante`, como clave comparable. */
function semanaDe(instante: Date): string {
  return inicioBalde(diaArg(instante), 'semana')
}

/** Diferencia en semanas completas entre dos claves de `semanaDe` (b - a). */
function diffSemanas(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / MS_SEMANA)
}

export class RachasService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * RN-075: se llama al finalizar un viaje, una vez por integrante con métrica
   * generada. Extiende la racha si la actividad cae en la semana siguiente a la
   * última contada, la reinicia si hubo un hueco (notificando la rotura), o la
   * arranca si todavía no existía o venía en 0 (rota por el job diario).
   */
  async registrarActividad(usuarioId: string, fechaActividad: Date): Promise<void> {
    const actual = await this.prisma.rachaActividad.findUnique({ where: { usuario_id: usuarioId } })

    if (!actual || actual.semanas_consecutivas === 0) {
      await this.prisma.rachaActividad.upsert({
        where: { usuario_id: usuarioId },
        create: {
          usuario_id: usuarioId,
          semanas_consecutivas: 1,
          inicio_racha: fechaActividad,
          ultima_actividad: fechaActividad,
        },
        update: {
          semanas_consecutivas: 1,
          inicio_racha: fechaActividad,
          ultima_actividad: fechaActividad,
        },
      })
      return
    }

    const semanaNueva = semanaDe(fechaActividad)
    const semanaUltima = semanaDe(actual.ultima_actividad)
    const diff = diffSemanas(semanaUltima, semanaNueva)

    if (diff === 0) return // misma semana: ya cuenta, no hay nada que actualizar
    if (diff < 0) return // actividad más vieja que la última registrada: se ignora

    if (diff === 1) {
      const nuevas = actual.semanas_consecutivas + 1
      await this.prisma.rachaActividad.update({
        where: { usuario_id: usuarioId },
        data: { semanas_consecutivas: nuevas, ultima_actividad: fechaActividad },
      })
      if ((HITOS_RACHA as readonly number[]).includes(nuevas)) {
        void this.notificarHito(usuarioId, nuevas)
      }
      return
    }

    // diff >= 2: pasó al menos una semana completa sin actividad antes de esta.
    void this.notificarRotura(usuarioId, actual.semanas_consecutivas)
    await this.prisma.rachaActividad.update({
      where: { usuario_id: usuarioId },
      data: { semanas_consecutivas: 1, inicio_racha: fechaActividad, ultima_actividad: fechaActividad },
    })
  }

  /**
   * Racha "vigente" al momento de leer, sin mutar nada: si ya pasó una semana
   * completa sin actividad desde la última registrada, se muestra en 0 aunque la
   * fila en base todavía no se haya reiniciado (eso lo hace el job diario). Así
   * el perfil nunca miente, corra o no el job ese día.
   */
  async obtenerRachaVigente(usuarioId: string, ahora: Date = new Date()) {
    const fila = await this.prisma.rachaActividad.findUnique({ where: { usuario_id: usuarioId } })
    if (!fila || fila.semanas_consecutivas === 0) {
      return { semanas_consecutivas: 0, en_riesgo: false }
    }

    const diff = diffSemanas(semanaDe(fila.ultima_actividad), semanaDe(ahora))
    if (diff >= 2) {
      return { semanas_consecutivas: 0, en_riesgo: false }
    }
    return {
      semanas_consecutivas: fila.semanas_consecutivas,
      // diff === 1: la semana pasada tuvo actividad, esta todavía no — si termina sin salir, se corta.
      en_riesgo: diff === 1,
    }
  }

  async obtenerRachaDeUsuario(usuarioObjetivoId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioObjetivoId },
      select: { id: true },
    })
    if (!usuario) {
      throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')
    }
    return this.obtenerRachaVigente(usuarioObjetivoId)
  }

  /**
   * Job diario (`src/jobs/rachasJob.ts`): detecta rachas que se cortaron por
   * pura inactividad —sin que nadie haya finalizado un viaje para notarlo— y
   * manda el push el mismo día en vez de esperar a la próxima actividad.
   */
  async verificarRachasRotas(ahora: Date = new Date()): Promise<number> {
    const activas = await this.prisma.rachaActividad.findMany({
      where: { semanas_consecutivas: { gt: 0 } },
      select: { usuario_id: true, semanas_consecutivas: true, ultima_actividad: true },
    })

    const semanaActual = semanaDe(ahora)
    let rotas = 0
    for (const r of activas) {
      const diff = diffSemanas(semanaDe(r.ultima_actividad), semanaActual)
      if (diff < 2) continue

      await this.prisma.rachaActividad.update({
        where: { usuario_id: r.usuario_id },
        data: { semanas_consecutivas: 0 },
      })
      void this.notificarRotura(r.usuario_id, r.semanas_consecutivas)
      rotas++
    }
    return rotas
  }

  private async notificarHito(usuarioId: string, semanas: number): Promise<void> {
    try {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { push_token: true },
      })
      if (!usuario?.push_token) return

      const { sendExpoPush } = await import('../../lib/expoPush')
      await sendExpoPush([
        {
          to: usuario.push_token,
          title: `¡Racha de ${semanas} semanas!`,
          body: `Hiciste actividad ${semanas} semanas seguidas. ¡Seguí así!`,
          data: { tipo: 'racha_hito', semanas },
          sound: 'default' as const,
        },
      ])
    } catch (e) {
      console.warn('[rachas] notificarHito falló:', e)
    }
  }

  private async notificarRotura(usuarioId: string, semanasPerdidas: number): Promise<void> {
    try {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { push_token: true },
      })
      if (!usuario?.push_token) return

      const { sendExpoPush } = await import('../../lib/expoPush')
      await sendExpoPush([
        {
          to: usuario.push_token,
          title: 'Se cortó tu racha',
          body:
            semanasPerdidas > 1
              ? `Tu racha de ${semanasPerdidas} semanas se cortó. Salí esta semana para arrancar una nueva.`
              : 'Pasó una semana sin actividad. Salí esta semana para arrancar una racha.',
          data: { tipo: 'racha_rota', semanas_perdidas: semanasPerdidas },
          sound: 'default' as const,
        },
      ])
    } catch (e) {
      console.warn('[rachas] notificarRotura falló:', e)
    }
  }
}
