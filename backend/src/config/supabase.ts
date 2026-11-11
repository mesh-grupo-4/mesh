import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Bucket público de fotos de perfil. Se crea con `npm run storage:setup`. */
export const BUCKET_AVATARES = 'avatares'

let cliente: SupabaseClient | null | undefined

/**
 * Cliente de Supabase con la service role key: solo para Storage, solo en el
 * backend. La key nunca llega al dispositivo; la app sube con URLs firmadas.
 *
 * Es opcional: sin `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` el resto del
 * backend funciona igual y los endpoints de foto responden 503.
 */
export function supabaseStorage(): SupabaseClient | null {
  if (cliente !== undefined) return cliente
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  cliente = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
  return cliente
}

/** URL pública de un archivo del bucket de avatares. */
export function urlPublicaAvatar(path: string): string {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, '') ?? ''
  return `${base}/storage/v1/object/public/${BUCKET_AVATARES}/${path}`
}

/** Inversa de `urlPublicaAvatar`: la ruta dentro del bucket, o null si la URL no es nuestra. */
export function pathDesdeUrlAvatar(url: string): string | null {
  const marca = `/storage/v1/object/public/${BUCKET_AVATARES}/`
  const i = url.indexOf(marca)
  return i === -1 ? null : url.slice(i + marca.length)
}
