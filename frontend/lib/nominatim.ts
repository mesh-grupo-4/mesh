export type NominatimHit = {
  display_name: string
  lat: string
  lon: string
}

export type NominatimReverseResult = {
  display_name: string
}

const UA = 'MeshTesis/1.0 (tesis UTN; contacto académico)'

export async function buscarLugares(query: string): Promise<NominatimHit[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'ar',
  })

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error('NOMINATIM_NETWORK_ERROR')
  }
  const data = (await res.json()) as NominatimHit[]
  return Array.isArray(data) ? data : []
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'json',
  })

  const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error('NOMINATIM_NETWORK_ERROR')
  }
  const data = (await res.json()) as NominatimReverseResult
  return data.display_name?.trim() || 'Punto en mapa'
}
