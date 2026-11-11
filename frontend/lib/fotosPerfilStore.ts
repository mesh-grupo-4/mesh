import { useEffect, useSyncExternalStore } from 'react'
import { consultarFotos } from '@/lib/usuariosApi'

/**
 * Caché de fotos de perfil por usuario.
 *
 * Cada avatar pide la foto de su `usuarioId`; los pedidos de una misma pantalla
 * se juntan en una sola llamada a `POST /api/usuarios/fotos` (hasta 200 ids).
 * Sin conexión, el pedido falla en silencio y el avatar queda con iniciales: se
 * reintenta la próxima vez que se monte.
 */
type Entrada = { url: string | null; at: number }

/** Pasado este tiempo se vuelve a consultar, por si la persona cambió la foto. */
const VIGENCIA_MS = 10 * 60_000
const MAX_POR_PEDIDO = 200
const ESPERA_LOTE_MS = 30

const cache = new Map<string, Entrada>()
const enVuelo = new Set<string>()
const pendientes = new Set<string>()
const listeners = new Set<() => void>()
let temporizador: ReturnType<typeof setTimeout> | null = null

function emitir() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function vaciarPendientes() {
  temporizador = null
  const ids = [...pendientes]
  pendientes.clear()
  for (let i = 0; i < ids.length; i += MAX_POR_PEDIDO) {
    const lote = ids.slice(i, i + MAX_POR_PEDIDO)
    lote.forEach((id) => enVuelo.add(id))
    try {
      const fotos = await consultarFotos(lote)
      const ahora = Date.now()
      lote.forEach((id) => cache.set(id, { url: fotos[id] ?? null, at: ahora }))
      emitir()
    } catch {
      // Sin red o backend caído: se queda con iniciales y se reintenta en el próximo montaje.
    } finally {
      lote.forEach((id) => enVuelo.delete(id))
    }
  }
}

function pedir(usuarioId: string) {
  const entrada = cache.get(usuarioId)
  if (entrada && Date.now() - entrada.at < VIGENCIA_MS) return
  if (enVuelo.has(usuarioId)) return
  pendientes.add(usuarioId)
  if (!temporizador) temporizador = setTimeout(() => void vaciarPendientes(), ESPERA_LOTE_MS)
}

/** Actualiza la foto de un usuario sin consultar (al subir o quitar la propia). */
export function setFotoPerfil(usuarioId: string, url: string | null) {
  cache.set(usuarioId, { url, at: Date.now() })
  emitir()
}

/** Precarga fotos ya conocidas (por ejemplo, la que viene en el perfil público). */
export function precargarFotoPerfil(usuarioId: string, url: string | null) {
  if (cache.get(usuarioId)?.url === url) return
  setFotoPerfil(usuarioId, url)
}

/** URL de la foto de un usuario, o null si no tiene (o todavía no se sabe). Sin id, siempre null. */
export function useFotoPerfil(usuarioId: string | null | undefined): string | null {
  const url = useSyncExternalStore(subscribe, () =>
    usuarioId ? cache.get(usuarioId)?.url ?? null : null
  )

  useEffect(() => {
    if (usuarioId) pedir(usuarioId)
  }, [usuarioId])

  return url
}
