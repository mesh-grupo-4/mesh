import { useCallback, useEffect, useRef, useState } from 'react'

import { connectMeshSocket } from '@/lib/meshSocket'
import { crearAlerta, listarAlertas, type AlertaApi, type TipoAlertaApi } from '@/lib/alertasApi'

type Options = {
  viajeId: string
  /** Para no mostrarle al autor el banner de su propia alerta. */
  userId?: string
  /** Solo se suscribe y carga cuando hay viaje. */
  habilitado: boolean
}

/**
 * El backend emite `viaje:alerta` antes de responder el POST, así que el autor
 * recibe su propia alerta por socket y otra vez por la respuesta HTTP: sin este
 * dedupe la lista queda con dos entradas del mismo id y React rompe por keys.
 */
function agregarSinDuplicar(prev: AlertaApi[], alerta: AlertaApi): AlertaApi[] {
  if (prev.some((a) => a.id === alerta.id)) return prev
  return [alerta, ...prev]
}

export function useAlertas({ viajeId, userId, habilitado }: Options) {
  const [alertas, setAlertas] = useState<AlertaApi[]>([])
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  /** Última alerta recibida por socket, para el banner del mapa. */
  const [ultima, setUltima] = useState<AlertaApi | null>(null)
  const vistasRef = useRef<Set<string>>(new Set())
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  const refrescar = useCallback(async () => {
    if (!viajeId || !habilitado) return
    setCargando(true)
    try {
      const filas = await listarAlertas(viajeId)
      setAlertas(filas)
      for (const a of filas) vistasRef.current.add(a.id)
    } catch {
      /* red intermitente: se reintenta al volver a abrir */
    } finally {
      setCargando(false)
    }
  }, [viajeId, habilitado])

  useEffect(() => {
    void refrescar()
  }, [refrescar])

  useEffect(() => {
    if (!viajeId || !habilitado) return
    let cleanup: (() => void) | undefined

    void (async () => {
      try {
        const sock = await connectMeshSocket()
        const onAlerta = (p: { viajeId: string; alerta: AlertaApi }) => {
          if (p.viajeId !== viajeId) return
          setAlertas((prev) => agregarSinDuplicar(prev, p.alerta))
          // El banner es para lo que no viste: ni lo ya cargado en el historial,
          // ni la alerta que acabás de escribir vos.
          const esMia = userIdRef.current != null && p.alerta.creada_por_id === userIdRef.current
          if (!esMia && !vistasRef.current.has(p.alerta.id)) {
            vistasRef.current.add(p.alerta.id)
            setUltima(p.alerta)
          }
        }
        sock.on('viaje:alerta', onAlerta)
        cleanup = () => sock.off('viaje:alerta', onAlerta)
      } catch {
        /* sin socket queda el refresco manual */
      }
    })()

    return () => cleanup?.()
  }, [viajeId, habilitado])

  const publicar = useCallback(
    async (input: { tipo: TipoAlertaApi; mensaje?: string; lat?: number; lng?: number }) => {
      setEnviando(true)
      try {
        const alerta = await crearAlerta(viajeId, input)
        setAlertas((prev) => agregarSinDuplicar(prev, alerta))
        vistasRef.current.add(alerta.id)
        return alerta
      } finally {
        setEnviando(false)
      }
    },
    [viajeId]
  )

  const descartarUltima = useCallback(() => setUltima(null), [])

  return { alertas, ultima, cargando, enviando, publicar, refrescar, descartarUltima }
}
