import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** La URL del proyecto es https://<ref>.supabase.co — sin /rest/v1 */
function normalizeSupabaseUrl(raw: string): string {
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
}

const supabaseUrl = normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')

let client: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return client
}
