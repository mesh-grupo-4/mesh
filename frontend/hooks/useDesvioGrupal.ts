import { useCallback, useEffect, useRef, useState } from 'react'

import { connectMeshSocket, onMeshSocketConnect } from '@/lib/meshSocket'
import {
  confirmarDesvioGrupal,
  obtenerDesvioGrupal,
  rechazarDesvioGrupal,
  type DesvioGrupalApi,
  type RutaActualizadaEvento,
} from '@/lib/desvioApi'

const SIN_DESVIO: DesvioGrupalApi = { estado: 'ninguno', desde: null, recalculo_automatico_en: null }

type Options = {
  viajeId: string
  /** Solo con el viaje en curso. */
  habilitado: boolean
  /** La ruta cambió (recalculada o editada): la pantalla la vuelve a cargar. */
  onRutaActualizada: (evento: RutaActualizadaEvento) => void
}

/**
 * RN-034b: desvío del grupo. Foto por REST al entrar y al reconectar, cambios por
 * `viaje:desvio_grupal`, y aviso de ruta nueva por `viaje:ruta_actualizada`.
 */
export function useDesvioGrupal({ viajeId, habilitado, onRutaActualizada }: Options) {
  const [desvio, setDesvio] = useState<DesvioGrupalApi>(SIN_DESVIO)
  const [ocupado, setOcupado] = useState(false)
  const onRutaRef = useRef(onRutaActualizada)
  onRutaRef.current = onRutaActualizada

  useEffect(() => {
    if (!viajeId || !habilitado) {
      setDesvio(SIN_DESVIO)
      return
    }
    let cleanup: (() => void) | undefined
    let cancelado = false
    const cargar = () =>
      obtenerDesvioGrupal(viajeId)
        .then((d) => {
          if (!cancelado) setDesvio(d)
        })
        .catch(() => {
          /* el socket trae el próximo cambio */
        })
    void cargar()

    void (async () => {
      try {
        const sock = await connectMeshSocket()
        if (cancelado) return
        const onDesvio = (p: DesvioGrupalApi & { viajeId: string }) => {
          if (p.viajeId !== viajeId) return
          setDesvio({ estado: p.estado, desde: p.desde, recalculo_automatico_en: p.recalculo_automatico_en })
        }
        const onRuta = (p: RutaActualizadaEvento) => {
          if (p.viajeId !== viajeId) return
          onRutaRef.current(p)
        }
        const offReconnect = onMeshSocketConnect(() => void cargar())
        sock.on('viaje:desvio_grupal', onDesvio)
        sock.on('viaje:ruta_actualizada', onRuta)
        cleanup = () => {
          offReconnect()
          sock.off('viaje:desvio_grupal', onDesvio)
          sock.off('viaje:ruta_actualizada', onRuta)
        }
      } catch {
        /* queda la foto REST */
      }
    })()

    return () => {
      cancelado = true
      cleanup?.()
    }
  }, [viajeId, habilitado])

  const confirmar = useCallback(async () => {
    setOcupado(true)
    try {
      const ruta = await confirmarDesvioGrupal(viajeId)
      // El estado y la ruta nueva llegan también por socket; esto cubre el caso sin socket.
      setDesvio(SIN_DESVIO)
      onRutaRef.current({
        viajeId,
        motivo: 'lider',
        linestring: ruta.linestring,
        distanciaPlaneadaM: ruta.distancia_planeada_m,
        tiempoEstimadoSeg: ruta.tiempo_estimado_seg,
        recalculadaEn: new Date().toISOString(),
      })
    } finally {
      setOcupado(false)
    }
  }, [viajeId])

  const rechazar = useCallback(async () => {
    setOcupado(true)
    try {
      setDesvio(await rechazarDesvioGrupal(viajeId))
    } finally {
      setOcupado(false)
    }
  }, [viajeId])

  return { desvio, ocupado, confirmar, rechazar }
}
