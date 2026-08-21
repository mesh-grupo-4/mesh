import { useCallback, useEffect, useRef, useState } from 'react'

import { connectMeshSocket } from '@/lib/meshSocket'
import {
  cancelarSolicitudParada,
  finalizarParada,
  iniciarParada,
  listarSolicitudesParada,
  obtenerParadaActiva,
  responderSolicitudParada,
  solicitarParada,
  type CategoriaParadaApi,
  type ParadaApi,
  type SolicitudParadaApi,
} from '@/lib/paradasApi'

type Options = {
  viajeId: string
  userId: string
  esLider: boolean
  /** El viaje tiene más integrantes: sin eso no hay a quién pedirle la parada. */
  habilitado: boolean
}

type SolicitudEntrante = {
  solicitudId: string
  solicitanteId: string
  nombre: string
  motivo: string | null
  createdAt: string
}

export function useParadas({ viajeId, userId, esLider, habilitado }: Options) {
  const [paradaActiva, setParadaActiva] = useState<ParadaApi | null>(null)
  const [miSolicitud, setMiSolicitud] = useState<SolicitudParadaApi | null>(null)
  const [pendientes, setPendientes] = useState<SolicitudEntrante[]>([])
  const [enviando, setEnviando] = useState(false)
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  // ------------------------------------------------------------ carga inicial

  const refrescar = useCallback(async () => {
    if (!viajeId || !habilitado) return
    try {
      const [parada, solicitudes] = await Promise.all([
        obtenerParadaActiva(viajeId),
        listarSolicitudesParada(viajeId),
      ])
      setParadaActiva(parada)
      if (esLider) {
        setPendientes(
          solicitudes
            .filter((s) => s.estado === 'pendiente')
            .map((s) => ({
              solicitudId: s.id,
              solicitanteId: s.solicitante_id,
              nombre: s.solicitante_nombre ?? 'Un integrante',
              motivo: s.motivo,
              createdAt: s.created_at,
            }))
        )
      } else {
        setMiSolicitud(solicitudes.find((s) => s.estado === 'pendiente') ?? null)
      }
    } catch {
      /* red intermitente: lo reintenta el próximo refresco */
    }
  }, [viajeId, habilitado, esLider])

  useEffect(() => {
    void refrescar()
  }, [refrescar])

  // ------------------------------------------------------------- tiempo real

  useEffect(() => {
    if (!viajeId || !habilitado) return
    let cleanup: (() => void) | undefined

    void (async () => {
      try {
        const sock = await connectMeshSocket()

        const onSolicitud = (p: {
          viajeId: string
          solicitudId: string
          solicitanteId: string
          nombre: string
          motivo: string | null
          createdAt: string
        }) => {
          if (p.viajeId !== viajeId || !esLider) return
          setPendientes((prev) =>
            prev.some((s) => s.solicitudId === p.solicitudId)
              ? prev
              : [
                  {
                    solicitudId: p.solicitudId,
                    solicitanteId: p.solicitanteId,
                    nombre: p.nombre,
                    motivo: p.motivo,
                    createdAt: p.createdAt,
                  },
                  ...prev,
                ]
          )
        }

        const onResuelta = (p: {
          viajeId: string
          solicitudId: string
          solicitanteId: string
          estado: SolicitudParadaApi['estado']
          resolvedAt: string | null
        }) => {
          if (p.viajeId !== viajeId) return
          setPendientes((prev) => prev.filter((s) => s.solicitudId !== p.solicitudId))
          if (p.solicitanteId === userIdRef.current) {
            setMiSolicitud((prev) =>
              prev && prev.id === p.solicitudId
                ? { ...prev, estado: p.estado, resolved_at: p.resolvedAt }
                : prev
            )
          }
        }

        sock.on('viaje:solicitud_parada', onSolicitud)
        sock.on('viaje:solicitud_parada_resuelta', onResuelta)
        cleanup = () => {
          sock.off('viaje:solicitud_parada', onSolicitud)
          sock.off('viaje:solicitud_parada_resuelta', onResuelta)
        }
      } catch {
        /* sin socket queda el refresco manual */
      }
    })()

    return () => cleanup?.()
  }, [viajeId, habilitado, esLider])

  // --------------------------------------------------------------- acciones

  /** US1 */
  const registrarParada = useCallback(
    async (categoria: CategoriaParadaApi, pos: { lat: number; lng: number }) => {
      setEnviando(true)
      try {
        const parada = await iniciarParada(viajeId, { ...pos, categoria })
        setParadaActiva(parada)
        return parada
      } finally {
        setEnviando(false)
      }
    },
    [viajeId]
  )

  /** US3: devuelve la parada cerrada, con su duración total. */
  const retomarViaje = useCallback(async () => {
    setEnviando(true)
    try {
      const parada = await finalizarParada(viajeId)
      setParadaActiva(null)
      return parada
    } finally {
      setEnviando(false)
    }
  }, [viajeId])

  /** US2 */
  const pedirParada = useCallback(
    async (input: { lat?: number; lng?: number; motivo?: string }) => {
      setEnviando(true)
      try {
        const solicitud = await solicitarParada(viajeId, input)
        setMiSolicitud(solicitud)
        return solicitud
      } finally {
        setEnviando(false)
      }
    },
    [viajeId]
  )

  const responderSolicitud = useCallback(
    async (solicitudId: string, decision: 'aprobada' | 'rechazada') => {
      setPendientes((prev) => prev.filter((s) => s.solicitudId !== solicitudId))
      try {
        await responderSolicitudParada(viajeId, solicitudId, decision)
      } catch (e) {
        void refrescar()
        throw e
      }
    },
    [viajeId, refrescar]
  )

  const cancelarMiSolicitud = useCallback(async () => {
    if (!miSolicitud) return
    await cancelarSolicitudParada(viajeId, miSolicitud.id)
    setMiSolicitud(null)
  }, [viajeId, miSolicitud])

  /** El solicitante ya vio el resultado: deja de mostrarse el cartel. */
  const descartarResultado = useCallback(() => setMiSolicitud(null), [])

  return {
    paradaActiva,
    miSolicitud,
    pendientes,
    enviando,
    registrarParada,
    retomarViaje,
    pedirParada,
    responderSolicitud,
    cancelarMiSolicitud,
    descartarResultado,
    refrescar,
  }
}
