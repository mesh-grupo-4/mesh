/**
 * API key de Google Maps Platform (Routes, Places, Geocoding, Roads). Vive
 * solo en el backend: el dispositivo nunca la ve para estos servicios.
 *
 * Es opcional: sin key, routing y geocoding siguen funcionando con los
 * proveedores basados en OpenStreetMap (OSRM/Valhalla/Nominatim), igual que
 * antes de integrar Google.
 */
export function googleMapsApiKey(): string | undefined {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim()
  return key ? key : undefined
}
