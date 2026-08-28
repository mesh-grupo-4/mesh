import { useCallback, useEffect, useRef, useState } from 'react'
import { DeviceEventEmitter } from 'react-native'

import { connectMeshSocket } from '@/lib/meshSocket'
import { meshWarning } from '@/lib/meshAlert'
import { calcularRutaOsrm, perfilOsrmDesdeActividad } from '@/lib/osrm'
import type { TipoActividadApi } from '@/lib/viajesApi'
import {
  cancelarSolicitudParada,
  confirmarEstoyBien,
  finalizarParada,
  iniciarParada,
  listarSolicitudesParada,
  obtenerParadaActiva,
  responderSolicitudParada,
  solicitarParada,
  type CategoriaParadaApi,
  type ParadaApi,
  type SolicitudParadaApi,
  type EstadoIntegranteApi,
} from '@/lib/paradasApi'

type Options = {
  viajeId: string
  userId: string
  esLider: boolean
  /** El viaje tiene más integrantes: sin eso no hay a quién pedirle la parada. */
  habilitado: boolean
  tipoActividad: TipoActividadApi
  myPosition: { lat: number; lng: number } | null
}

type SolicitudEntrante = {
  solicitudId: string
  solicitanteId: string
  nombre: string
  motivo: string | null
  createdAt: string
}

export type ParadaEntrante = {
  paradaId: string
  usuarioId: string
  nombre: string
  lat: number
  lng: number
  categoria: CategoriaParadaApi | null
  inicio: string
}

export type SeguirParadaActiva = {
  paradaId: string
  usuarioId: string
  nombre: string
  lat: number
  lng: number
  categoria: CategoriaParadaApi | null
  polyline: [number, number][]
}

function lineaDirecta(
  desde: { lat: number; lng: number },
  hasta: { lat: number; lng: number }
): [number, number][] {
  return [
    [desde.lat, desde.lng],
    [hasta.lat, hasta.lng],
  ]
}

export function useParadas({
  viajeId,
  userId,
  esLider,
  habilitado,
  tipoActividad,
  myPosition,
}: Options) {
  const [paradaActiva, setParadaActiva] = useState<ParadaApi | null>(null)
  const [miSolicitud, setMiSolicitud] = useState<SolicitudParadaApi | null>(null)
  const [pendientes, setPendientes] = useState<SolicitudEntrante[]>([])
  const [paradasEntrantes, setParadasEntrantes] = useState<ParadaEntrante[]>([])
  const [seguirParada, setSeguirParada] = useState<SeguirParadaActiva | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [calculandoSeguir, setCalculandoSeguir] = useState(false)
  const userIdRef = useRef(userId)
  const myPositionRef = useRef(myPosition)
  userIdRef.current = userId
  myPositionRef.current = myPosition

  const paradaEntrante = paradasEntrantes[0] ?? null

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

        const onParadaIniciada = (p: {
          viajeId: string
          usuarioId: string
          nombre?: string
          paradaId: string
          lat: number
          lng: number
          categoria: CategoriaParadaApi | null
          inicio: string
          estado?: EstadoIntegranteApi
        }) => {
          if (p.viajeId !== viajeId) return

          if (p.usuarioId === userIdRef.current) {
            setParadaActiva({
              id: p.paradaId,
              viaje_id: viajeId,
              usuario_id: p.usuarioId,
              lat: p.lat,
              lng: p.lng,
              categoria: p.categoria,
              tipo: p.estado === 'posible_incidente' ? 'incidente_detectado' : 'voluntaria',
              inicio: p.inicio,
              fin: null,
              duracion_segundos: null,
            })
            return
          }

          const estado = p.estado ?? 'detenido_voluntario'
          if (estado !== 'detenido_voluntario') return

          const entrante: ParadaEntrante = {
            paradaId: p.paradaId,
            usuarioId: p.usuarioId,
            nombre: p.nombre ?? 'Un integrante',
            lat: p.lat,
            lng: p.lng,
            categoria: p.categoria,
            inicio: p.inicio,
          }
          setParadasEntrantes((prev) =>
            prev.some((x) => x.paradaId === entrante.paradaId) ? prev : [...prev, entrante]
          )
        }

        const onParadaFinalizada = (p: {
          viajeId: string
          usuarioId: string
          paradaId?: string
        }) => {
          if (p.viajeId !== viajeId) return

          if (p.usuarioId === userIdRef.current) {
            setParadaActiva(null)
          }

          setParadasEntrantes((prev) =>
            prev.filter((x) => x.usuarioId !== p.usuarioId && x.paradaId !== p.paradaId)
          )
          setSeguirParada((prev) =>
            prev &&
            (prev.usuarioId === p.usuarioId || (p.paradaId && prev.paradaId === p.paradaId))
              ? null
              : prev
          )
        }

        sock.on('viaje:solicitud_parada', onSolicitud)
        sock.on('viaje:solicitud_parada_resuelta', onResuelta)
        sock.on('viaje:parada_iniciada', onParadaIniciada)
        sock.on('viaje:parada_finalizada', onParadaFinalizada)
        cleanup = () => {
          sock.off('viaje:solicitud_parada', onSolicitud)
          sock.off('viaje:solicitud_parada_resuelta', onResuelta)
          sock.off('viaje:parada_iniciada', onParadaIniciada)
          sock.off('viaje:parada_finalizada', onParadaFinalizada)
        }
      } catch {
        /* sin socket queda el refresco manual */
      }
    })()

    return () => cleanup?.()
  }, [viajeId, habilitado, esLider])

  // --------------------------------------------------------------- acciones

  const ignorarParadaEntrante = useCallback(() => {
    setParadasEntrantes((prev) => prev.slice(1))
  }, [])

  const dejarDeSeguirParada = useCallback(() => {
    setSeguirParada(null)
  }, [])

  const activarSeguirParada = useCallback(async () => {
    const entrante = paradasEntrantes[0]
    if (!entrante) return null

    const pos = myPositionRef.current
    if (!pos) {
      meshWarning('Sin ubicación', 'No tenemos tu posición para calcular la ruta hasta la parada.')
      return null
    }

    setCalculandoSeguir(true)
    try {
      const destino = { lat: entrante.lat, lng: entrante.lng }
      let polyline: [number, number][]

      try {
        const perfil = perfilOsrmDesdeActividad(tipoActividad)
        const ruta = await calcularRutaOsrm(perfil, [
          [pos.lng, pos.lat],
          [destino.lng, destino.lat],
        ])
        polyline = ruta.polylineLatLng
      } catch {
        polyline = lineaDirecta(pos, destino)
        meshWarning(
          'Ruta aproximada',
          'No pudimos calcular la ruta por calles; mostramos una línea directa hasta la parada.'
        )
      }

      const activa: SeguirParadaActiva = {
        paradaId: entrante.paradaId,
        usuarioId: entrante.usuarioId,
        nombre: entrante.nombre,
        lat: entrante.lat,
        lng: entrante.lng,
        categoria: entrante.categoria,
        polyline,
      }
      setSeguirParada(activa)
      setParadasEntrantes((prev) => prev.filter((x) => x.paradaId !== entrante.paradaId))
      return activa
    } finally {
      setCalculandoSeguir(false)
    }
  }, [paradasEntrantes, tipoActividad])

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

  const confirmarBien = useCallback(async () => {
    setEnviando(true)
    try {
      const parada = await confirmarEstoyBien(viajeId)
      setParadaActiva(null)
      DeviceEventEmitter.emit('mesh:integrante_estado', {
        viajeId,
        usuarioId: userId,
        estado: 'en_movimiento',
        paradaDesde: null,
      })
      DeviceEventEmitter.emit('mesh:alertas_resueltas', { viajeId, usuarioId: userId })
      return parada
    } finally {
      setEnviando(false)
    }
  }, [viajeId, userId])

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
    paradaEntrante,
    paradasEntrantes,
    seguirParada,
    enviando,
    calculandoSeguir,
    registrarParada,
    retomarViaje,
    confirmarBien,
    pedirParada,
    responderSolicitud,
    cancelarMiSolicitud,
    descartarResultado,
    ignorarParadaEntrante,
    activarSeguirParada,
    dejarDeSeguirParada,
    refrescar,
  }
}
