import type { PrismaClient, VisibilidadLogros } from '@prisma/client'
import { HttpError } from '../../lib/httpError'

/**
 * RN-077: punto de control único para leer los logros de otra persona
 * (estadísticas agregadas, racha e insignias). Todo endpoint que los exponga
 * pasa por acá: el perfil público, `GET /insignias/usuario/:id` y
 * `GET /rachas/usuario/:id`. El frontend solo refleja lo que decide el backend (RN-030).
 */
export function puedeVerLogros(
  visibilidad: VisibilidadLogros,
  esYo: boolean,
  esAmigo: boolean
): boolean {
  if (esYo) return true
  if (visibilidad === 'todos') return true
  if (visibilidad === 'amigos') return esAmigo
  return false
}

async function sonAmigos(prisma: PrismaClient, a: string, b: string): Promise<boolean> {
  const amistad = await prisma.amistad.findFirst({
    where: {
      estado: 'aceptada',
      OR: [
        { solicitante_id: a, destinatario_id: b },
        { solicitante_id: b, destinatario_id: a },
      ],
    },
    select: { id: true },
  })
  return amistad != null
}

/**
 * 404 si el usuario no existe; 403 `LOGROS_PRIVADOS` si su configuración no
 * deja que quien consulta vea sus logros.
 */
export async function assertPuedeVerLogros(
  prisma: PrismaClient,
  usuarioObjetivoId: string,
  solicitanteId: string
): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioObjetivoId },
    select: { visibilidad_logros: true },
  })
  if (!usuario) throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')

  const esYo = usuarioObjetivoId === solicitanteId
  // La consulta de amistad solo hace falta en el caso "amigos".
  const esAmigo =
    !esYo && usuario.visibilidad_logros === 'amigos'
      ? await sonAmigos(prisma, solicitanteId, usuarioObjetivoId)
      : false

  if (!puedeVerLogros(usuario.visibilidad_logros, esYo, esAmigo)) {
    throw new HttpError(403, 'Esta persona no comparte sus logros', 'LOGROS_PRIVADOS')
  }
}
