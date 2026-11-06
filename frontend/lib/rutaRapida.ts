import { calcularRutaOsrm, perfilOsrmDesdeActividad } from '@/lib/osrm'
import { reverseGeocode } from '@/lib/nominatim'
import { guardarRutaEnBackend, type TipoActividadApi } from '@/lib/viajesApi'

export type PuntoDestino = { lat: number; lng: number; nombre: string }

/**
 * Ruta del "Viaje YA": de donde está parado el líder hasta el destino elegido,
 * sin paradas. El trazado lo calcula el backend (Google → OSRM → Valhalla), así
 * la key de Google nunca llega al dispositivo.
 */
export async function guardarRutaRapida(
  viajeId: string,
  userId: string,
  tipoActividad: TipoActividadApi,
  origen: { lat: number; lng: number },
  destino: PuntoDestino
): Promise<void> {
  const ruta = await calcularRutaOsrm(perfilOsrmDesdeActividad(tipoActividad), [
    [origen.lng, origen.lat],
    [destino.lng, destino.lat],
  ])
  const origenNombre = await reverseGeocode(origen.lat, origen.lng).catch(() => 'Mi ubicación')

  await guardarRutaEnBackend(viajeId, userId, {
    origen: { type: 'Point', coordinates: [origen.lng, origen.lat] },
    destino: { type: 'Point', coordinates: [destino.lng, destino.lat] },
    origenNombre,
    destinoNombre: destino.nombre,
    linestring: ruta.linestring,
    tiempoEstimadoSeg: Math.round(ruta.durationSec),
    paradas: [],
  })
}
