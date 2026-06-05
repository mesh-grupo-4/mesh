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

export function enqueueGpsSample(p: {
  viajeId: string
  userId: string
  lat: number
  lng: number
  accuracy: number | null
  ts: number
}): void {
  const d = openDb()
  d.runSync(
    'INSERT INTO pending_gps (viaje_id, user_id, lat, lng, accuracy, ts) VALUES (?, ?, ?, ?, ?, ?)',
    p.viajeId,
    p.userId,
    p.lat,
    p.lng,
    p.accuracy,
    p.ts
  )
}

/** Envía lotes `offline_sync` al backend y borra filas confirmadas (RN-038). */
export async function flushGpsQueue(baseUrl: string = API_BASE_URL): Promise<void> {
  const d = openDb()
  const rows = d.getAllSync<PendingGpsRow>('SELECT * FROM pending_gps ORDER BY id ASC LIMIT 500')
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
      const auth = await bearerAuthHeaders()
      const res = await fetch(`${root}/api/viajes/${viajeId}/posiciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...auth,
        },
        body: JSON.stringify({ source: 'offline_sync', posiciones }),
      })
      if (!res.ok) continue
      const ids = batch.map((b) => b.id)
      const ph = ids.map(() => '?').join(',')
      d.runSync(`DELETE FROM pending_gps WHERE id IN (${ph})`, ...ids)
    } catch {
      /* sin red: reintentar después */
    }
  }
}
