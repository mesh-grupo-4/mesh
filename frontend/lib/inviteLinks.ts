const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const MESH_INVITE_SCHEME = 'mesh'

/**
 * Dominio de la landing. Con él los links son https: abren la app si está instalada y la
 * landing si no. Sin él (dev, o mientras no haya dominio) quedan con el esquema `mesh://`.
 */
const LINKS_BASE_URL = process.env.EXPO_PUBLIC_LINKS_BASE_URL?.trim().replace(/\/$/, '') || null

function buildLink(ruta: string, query: string): string {
  return LINKS_BASE_URL
    ? `${LINKS_BASE_URL}/${ruta}?${query}`
    : `${MESH_INVITE_SCHEME}://${ruta}?${query}`
}

/** Si la URL con la que se abrió la app es un link de Mesh (esquema propio o dominio). */
export function esLinkDeMesh(url: string): boolean {
  if (url.includes('expo-development-client')) return false
  return (
    url.startsWith(`${MESH_INVITE_SCHEME}://`) ||
    (LINKS_BASE_URL !== null && url.startsWith(`${LINKS_BASE_URL}/`))
  )
}

/** Mensaje exacto del AC / RN-015. */
export const QR_EXPIRED_MESSAGE =
  'Este viaje ya ha comenzado. El código QR ha expirado.'

export const CODIGO_EXPIRED_MESSAGE =
  'Este viaje ya comenzó o finalizó, así que el código dejó de funcionar.'

/** RN-015: largo del código de invitación, sin contar el guion. */
export const LARGO_CODIGO_VIAJE = 8

/** RN-015: deep link único por viaje. */
export function buildInviteUrl(viajeId: string): string {
  return buildLink('unirse', `viajeId=${encodeURIComponent(viajeId)}`)
}

/** RN-015: deja el código como `ABCD-2345`, descartando lo que no puede formar parte de él. */
export function formatearCodigoViaje(raw: string): string {
  const limpio = raw
    .toUpperCase()
    .replace(/[^2-9A-HJ-NP-Z]/g, '')
    .slice(0, LARGO_CODIGO_VIAJE)
  return limpio.length > 4 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio
}

/** Texto para compartir la invitación por fuera de la app. */
export function buildInviteMessage(viajeId: string, codigo?: string | null): string {
  const link = `Unite al viaje en Mesh:\n${buildInviteUrl(viajeId)}`
  return codigo ? `${link}\n\nO ingresá el código ${formatearCodigoViaje(codigo)}` : link
}

/** RN-088: deep link de ruta compartida (distinto del QR de unirse). */
export function buildRouteShareUrl(token: string): string {
  return buildLink('ruta', `token=${encodeURIComponent(token)}`)
}

/** Extrae token de `mesh://ruta?token=...` o URL equivalente. */
export function parseRouteShareToken(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const withScheme = trimmed.includes('://') ? trimmed : `${MESH_INVITE_SCHEME}://${trimmed}`
    const url = new URL(withScheme)
    const hostOrPath = `${url.host}${url.pathname}`.replace(/^\//, '')
    if (hostOrPath === 'ruta' || url.pathname.replace(/^\//, '') === 'ruta') {
      const token = url.searchParams.get('token')?.trim()
      if (token && /^[A-Za-z0-9_-]{16,64}$/.test(token)) return token
    }
  } catch {
    /* no es URL válida */
  }

  return null
}

/** Extrae viajeId de un QR escaneado o link pegado. */
export function parseViajeIdFromInviteData(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // No confundir con link de ruta compartida
  if (parseRouteShareToken(trimmed)) return null

  try {
    const withScheme = trimmed.includes('://') ? trimmed : `${MESH_INVITE_SCHEME}://${trimmed}`
    const url = new URL(withScheme)
    const fromQuery = url.searchParams.get('viajeId')
    if (fromQuery && UUID_RE.test(fromQuery)) return fromQuery
  } catch {
    /* no es URL válida */
  }

  if (UUID_RE.test(trimmed)) return trimmed

  const inline = trimmed.match(UUID_RE)
  return inline?.[0] ?? null
}
