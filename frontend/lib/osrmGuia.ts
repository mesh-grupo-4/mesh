import { meshWarning } from '@/lib/meshAlert'
import { calcularRutaOsrm, perfilOsrmDesdeActividad } from '@/lib/osrm'
import type { TipoActividadApi } from '@/lib/viajesApi'

export function lineaDirectaGuia(
  desde: { lat: number; lng: number },
  hasta: { lat: number; lng: number }
): [number, number][] {
  return [
    [desde.lat, desde.lng],
    [hasta.lat, hasta.lng],
  ]
}

/** Calcula polyline OSRM hacia un destino; cae a línea directa si falla. */
export async function calcularGuiaHastaDestino(
  desde: { lat: number; lng: number },
  destino: { lat: number; lng: number },
  tipoActividad: TipoActividadApi
): Promise<[number, number][]> {
  try {
    const perfil = perfilOsrmDesdeActividad(tipoActividad)
    const ruta = await calcularRutaOsrm(perfil, [
      [desde.lng, desde.lat],
      [destino.lng, destino.lat],
    ])
    return ruta.polylineLatLng
  } catch {
    meshWarning(
      'Ruta aproximada',
      'No pudimos calcular la ruta por calles; mostramos una línea directa hasta el punto.'
    )
    return lineaDirectaGuia(desde, destino)
  }
}
