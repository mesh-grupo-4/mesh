import type { PrismaClient } from '@prisma/client'

/**
 * Ventana de agregación del registro de accesos (RN-112). Dentro de la ventana,
 * releer la posición de la misma persona no vuelve a escribir: el mapa se refresca
 * cada pocos segundos y un log por lectura sería ruido puro además de inviable
 * con 200 integrantes (RN-033).
 */
export const VENTANA_ACCESO_MIN = 10

export type EstadoCompartir = {
  comparte: boolean
  /** RN-110: sin consentimiento vigente no se comparte, aunque el toggle esté en on. */
  consentimientoOtorgado: boolean
}

/**
 * RN-110/111: si esta persona comparte su ubicación en este viaje.
 *
 * Una sola consulta: la preferencia del viaje y el default del usuario viajan
 * juntos porque esto corre en el camino caliente del GPS (un ping cada 5s por
 * integrante, RN-031). Sin fila de `privacidad_viaje` vale el default del usuario.
 */
export async function estadoCompartirUbicacion(
  prisma: PrismaClient,
  viajeId: string,
  usuarioId: string
): Promise<EstadoCompartir> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      comparte_ubicacion_default: true,
      consentimiento_ubicacion_at: true,
      privacidad_viajes: {
        where: { viaje_id: viajeId },
        select: { comparte_ubicacion: true },
      },
    },
  })
  if (!usuario) return { comparte: false, consentimientoOtorgado: false }

  const consentimientoOtorgado = usuario.consentimiento_ubicacion_at != null
  const preferencia = usuario.privacidad_viajes[0]?.comparte_ubicacion ?? usuario.comparte_ubicacion_default

  return { comparte: consentimientoOtorgado && preferencia, consentimientoOtorgado }
}

/** Versión booleana para los callers que solo necesitan decidir si publicar. */
export async function comparteUbicacion(
  prisma: PrismaClient,
  viajeId: string,
  usuarioId: string
): Promise<boolean> {
  return (await estadoCompartirUbicacion(prisma, viajeId, usuarioId)).comparte
}

/**
 * Subconjunto de `usuarioIds` que sí comparte su ubicación en el viaje. Resuelve
 * el listado completo en dos consultas en vez de una por persona, para no
 * multiplicar roundtrips en cada refresco del mapa grupal.
 */
export async function filtrarQuienesComparten(
  prisma: PrismaClient,
  viajeId: string,
  usuarioIds: string[]
): Promise<Set<string>> {
  if (usuarioIds.length === 0) return new Set()

  const [usuarios, preferencias] = await Promise.all([
    prisma.usuario.findMany({
      where: { id: { in: usuarioIds } },
      select: {
        id: true,
        comparte_ubicacion_default: true,
        consentimiento_ubicacion_at: true,
      },
    }),
    prisma.privacidadViaje.findMany({
      where: { viaje_id: viajeId, usuario_id: { in: usuarioIds } },
      select: { usuario_id: true, comparte_ubicacion: true },
    }),
  ])

  const porViaje = new Map(preferencias.map((p) => [p.usuario_id, p.comparte_ubicacion]))
  const comparten = new Set<string>()
  for (const u of usuarios) {
    if (u.consentimiento_ubicacion_at == null) continue
    if (porViaje.get(u.id) ?? u.comparte_ubicacion_default) comparten.add(u.id)
  }
  return comparten
}

/**
 * RN-112: deja constancia de que `observadorId` vio la posición de cada
 * `observadoIds` en este viaje. Idempotente dentro de `VENTANA_ACCESO_MIN`.
 *
 * Un solo INSERT ... ON CONFLICT para todo el lote: recorrer el array con upserts
 * de Prisma sería una consulta por integrante en cada lectura del mapa.
 * Mirarse a uno mismo no cuenta como acceso y se filtra antes.
 */
export async function registrarAccesosUbicacion(
  prisma: PrismaClient,
  viajeId: string,
  observadorId: string,
  observadoIds: string[]
): Promise<void> {
  // El Set no es defensa de más: `ON CONFLICT DO UPDATE` aborta con "cannot affect
  // row a second time" si el mismo par aparece dos veces en la misma sentencia.
  const objetivos = [...new Set(observadoIds)].filter((id) => id !== observadorId)
  if (objetivos.length === 0) return

  await prisma.$executeRaw`
    INSERT INTO acceso_ubicacion (viaje_id, observado_id, observador_id, primera_vez, ultima_vez, veces)
    SELECT ${viajeId}::uuid, observado, ${observadorId}::uuid, now(), now(), 1
    FROM unnest(${objetivos}::uuid[]) AS observado
    ON CONFLICT (viaje_id, observado_id, observador_id) DO UPDATE
      SET ultima_vez = now(), veces = acceso_ubicacion.veces + 1
      WHERE acceso_ubicacion.ultima_vez < now() - interval '1 minute' * ${VENTANA_ACCESO_MIN}
  `
}
