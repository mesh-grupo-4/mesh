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
      CREATE TABLE IF NOT EXISTS pending_checkin (
        viaje_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        ts INTEGER NOT NULL,
        PRIMARY KEY (viaje_id, user_id)
      );
    `)
  }
  return db
}

/**
 * RN-029b: "Me sumo" se encola igual que el GPS. Si se toca sin señal (p. ej. en el
 * punto de encuentro, en la montaña), el check-in se manda al reconectar y SIEMPRE
 * antes que las posiciones: sin él el backend las rechazaría con NOT_CHECKED_IN.
 */
export function enqueueCheckIn(viajeId: string, userId: string, ts: number = Date.now()): void {
  openDb().runSync(
    'INSERT OR IGNORE INTO pending_checkin (viaje_id, user_id, ts) VALUES (?, ?, ?)',
    viajeId,
    userId,
    ts
  )
}

/** Hay un "Me sumo" tocado que todavía no llegó al backend (cuenta como sumado en la app). */
export function tieneCheckInPendiente(viajeId: string, userId: string): boolean {
  const row = openDb().getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM pending_checkin WHERE viaje_id = ? AND user_id = ?',
    viajeId,
    userId
  )
  return (row?.n ?? 0) > 0
}

/**
 * Envía los check-ins pendientes. Devuelve las claves `viaje\nusuario` que siguen sin
 * confirmar, para que `flushGpsQueue` no mande todavía las posiciones de esos viajes.
 * Un 4xx definitivo (el viaje terminó, la persona ya no está confirmada) descarta el
 * check-in: reintentarlo no lo va a arreglar.
 */
async function flushCheckIns(root: string): Promise<Set<string>> {
  const d = openDb()
  const rows = d.getAllSync<{ viaje_id: string; user_id: string; ts: number }>(
    'SELECT * FROM pending_checkin'
  )
  const pendientes = new Set<string>()
  for (const r of rows) {
    const key = `${r.viaje_id}\n${r.user_id}`
    try {
      const post = async (forceRefresh: boolean) => {
        const auth = await bearerAuthHeaders(forceRefresh)
        return fetch(`${root}/api/viajes/${r.viaje_id}/check-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...auth },
          body: JSON.stringify({ check_in_at: new Date(r.ts).toISOString() }),
        })
      }
      let res = await post(false)
      if (res.status === 401) res = await post(true)
      const definitivo = res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401)
      if (definitivo) {
        d.runSync(
          'DELETE FROM pending_checkin WHERE viaje_id = ? AND user_id = ?',
          r.viaje_id,
          r.user_id
        )
      } else {
        pendientes.add(key)
      }
    } catch {
      pendientes.add(key) // sin red: reintentar después
    }
  }
  return pendientes
}

/** "Me sumo": encola el check-in e intenta mandarlo ya. Nunca falla por falta de red. */
export async function sumarseAlViaje(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<void> {
  enqueueCheckIn(viajeId, userId)
  await flushCheckIns(baseUrl.replace(/\/$/, ''))
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
  // RN-029b: primero los check-ins; las posiciones de un viaje cuyo check-in sigue
  // pendiente esperan en la cola (RN-038: no se pierden, solo se demoran).
  const checkInsPendientes = await flushCheckIns(baseUrl.replace(/\/$/, ''))
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
    if (checkInsPendientes.has(key)) continue
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
