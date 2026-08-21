import { useCallback, useEffect, useRef, useState } from 'react'

import { connectMeshSocket } from '@/lib/meshSocket'
import { crearAlerta, listarAlertas, type AlertaApi, type TipoAlertaApi } from '@/lib/alertasApi'

type Options = {
  viajeId: string
  /** Solo se suscribe y carga cuando hay viaje. */
  habilitado: boolean
}

export function useAlertas({ viajeId, habilitado }: Options) {
  const [alertas, setAlertas] = useState<AlertaApi[]>([])
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  /** Última alerta recibida por socket, para el banner del mapa. */
  const [ultima, setUltima] = useState<AlertaApi | null>(null)
  const vistasRef = useRef<Set<string>>(new Set())

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
          setAlertas((prev) => (prev.some((a) => a.id === p.alerta.id) ? prev : [p.alerta, ...prev]))
          // El banner solo aparece para alertas que no estaban en el historial cargado.
          if (!vistasRef.current.has(p.alerta.id)) {
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
    async (input: { tipo: TipoAlertaApi; mensaje: string; lat?: number; lng?: number }) => {
      setEnviando(true)
      try {
        const alerta = await crearAlerta(viajeId, input)
        setAlertas((prev) => [alerta, ...prev])
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
