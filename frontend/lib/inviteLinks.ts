const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const MESH_INVITE_SCHEME = 'mesh'

/** Mensaje exacto del AC / RN-015. */
export const QR_EXPIRED_MESSAGE =
  'Este viaje ya ha comenzado. El código QR ha expirado.'

/** RN-015: deep link único por viaje. */
export function buildInviteUrl(viajeId: string): string {
  return `${MESH_INVITE_SCHEME}://unirse?viajeId=${encodeURIComponent(viajeId)}`
}

/** Extrae viajeId de un QR escaneado o link pegado. */
export function parseViajeIdFromInviteData(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

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
