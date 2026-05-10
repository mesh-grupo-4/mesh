export type NominatimHit = {
  display_name: string
  lat: string
  lon: string
}

const UA = 'MeshTesis/1.0 (tesis UTN; contacto académico)'

export async function buscarLugares(query: string): Promise<NominatimHit[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6`
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error('Error de geocodificación')
  }
  const data = (await res.json()) as NominatimHit[]
  return Array.isArray(data) ? data : []
}
