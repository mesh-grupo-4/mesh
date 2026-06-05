import { Redirect, useLocalSearchParams } from 'expo-router'

/** Compatibilidad: redirige al QR del viaje sin depender del grupo. */
export default function GrupoViajeQrRedirect() {
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>()
  if (!viajeId) return null
  return <Redirect href={`/viaje/${viajeId}/qr`} />
}
