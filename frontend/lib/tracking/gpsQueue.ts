import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite'

import { API_BASE_URL } from '@/constants/Config'
import { bearerAuthHeaders } from '@/lib/apiClient'

export type PendingGpsRow = {
  id: number
  viaje_id: string
  user_id: string
  lat: number
  lng: number
  accuracy: number | null
  ts: number
}

let db: SQLiteDatabase | null = null

function openDb(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('mesh_gps_queue.db')
    db.execSync(`
      CREATE TABLE IF NOT EXISTS pending_gps (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        viaje_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        accuracy REAL,
        ts INTEGER NOT NULL
      );
    `)
  }
  return db
}

/** Devuelve el id de la fila insertada, para poder borrarla puntualmente si el envío en vivo confirma. */
export function enqueueGpsSample(p: {
  viajeId: string
  userId: string
  lat: number
  lng: number
  accuracy: number | null
  ts: number
}): number {
  const d = openDb()
  const res = d.runSync(
    'INSERT INTO pending_gps (viaje_id, user_id, lat, lng, accuracy, ts) VALUES (?, ?, ?, ?, ?, ?)',
    p.viajeId,
    p.userId,
    p.lat,
    p.lng,
    p.accuracy,
    p.ts
  )
  return res.lastInsertRowId
}

/**
 * Borra una muestra puntual ya confirmada por el canal en vivo (PUT/socket), para
 * que `flushGpsQueue` no la reenvíe de nuevo como `offline_sync` y duplique el
 * punto GPS en el backend. Si el envío en vivo falla, la fila queda intacta y se
 * sincroniza igual en el próximo flush (RN-038: cero pérdida de registros).
 */
export function dequeueGpsSample(id: number): void {
  const d = openDb()
  d.runSync('DELETE FROM pending_gps WHERE id = ?', id)
}

/**
 * Margen para que el envío en vivo (PUT/socket) termine y borre su fila antes de
 * que el flush la considere "pendiente". Sin esto, cada flush reenviaba como
 * `offline_sync` los últimos pings que todavía estaban en vuelo.
 */
const EDAD_MINIMA_PARA_FLUSH_MS = 20_000

/** Envía lotes `offline_sync` al backend y borra filas confirmadas (RN-038). */
export async function flushGpsQueue(baseUrl: string = API_BASE_URL): Promise<void> {
  const d = openDb()
  const rows = d.getAllSync<PendingGpsRow>(
    'SELECT * FROM pending_gps WHERE ts <= ? ORDER BY ts ASC, id ASC LIMIT 500',
    Date.now() - EDAD_MINIMA_PARA_FLUSH_MS
  )
  if (!rows.length) return

  const groups = new Map<string, PendingGpsRow[]>()
  for (const r of rows) {
    const key = `${r.viaje_id}\n${r.user_id}`
    const g = groups.get(key) ?? []
    g.push(r)
    groups.set(key, g)
  }

  const root = baseUrl.replace(/\/$/, '')

  for (const [key, batch] of groups) {
    const nl = key.indexOf('\n')
    const viajeId = key.slice(0, nl)
    const userId = key.slice(nl + 1)
    const posiciones = batch.map((b) => ({
      lat: b.lat,
      lng: b.lng,
      precision: b.accuracy,
      timestamp: new Date(b.ts).toISOString(),
    }))

    try {
      const postBatch = async (forceRefresh: boolean) => {
        const auth = await bearerAuthHeaders(forceRefresh)
        return fetch(`${root}/api/viajes/${viajeId}/posiciones`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...auth,
          },
          body: JSON.stringify({ source: 'offline_sync', posiciones }),
        })
      }

      let res = await postBatch(false)
      if (res.status === 401) res = await postBatch(true)
      if (!res.ok) continue
      const ids = batch.map((b) => b.id)
      const ph = ids.map(() => '?').join(',')
      d.runSync(`DELETE FROM pending_gps WHERE id IN (${ph})`, ...ids)
    } catch {
      /* sin red: reintentar después */
    }
  }
}
