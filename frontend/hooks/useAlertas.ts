import { useCallback, useEffect, useRef, useState } from 'react'
import { DeviceEventEmitter } from 'react-native'

import { connectMeshSocket } from '@/lib/meshSocket'
import { meshWarning } from '@/lib/meshAlert'
import { calcularGuiaHastaDestino } from '@/lib/osrmGuia'
import {
  crearAlerta,
  listarAlertas,
  usuarioAfectadoDesdeMensaje,
  type AlertaApi,
  type TipoAlertaApi,
} from '@/lib/alertasApi'
import type { TipoActividadApi } from '@/lib/viajesApi'

type Options = {
  viajeId: string
  /** Para no mostrarle al autor el banner de su propia alerta. */
  userId?: string
  /** Solo se suscribe y carga cuando hay viaje. */
  habilitado: boolean
  tipoActividad?: TipoActividadApi
  myPosition?: { lat: number; lng: number } | null
}

export type SeguirAlertaActiva = {
  alertaId: string
  lat: number
  lng: number
  label: string
  polyline: [number, number][]
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

function esAlertaParaBanner(alerta: AlertaApi, userId: string | undefined, vistas: Set<string>): boolean {
  const esMia = userId != null && alerta.creada_por_id === userId
  const afectadoYo =
    userId != null &&
    alerta.origen === 'sistema' &&
    alerta.tipo === 'peligro' &&
    usuarioAfectadoDesdeMensaje(alerta.mensaje) === userId
  return !esMia && !afectadoYo && !vistas.has(alerta.id) && alerta.origen !== 'sistema'
}

export function useAlertas({
  viajeId,
  userId,
  habilitado,
  tipoActividad = 'otro',
  myPosition = null,
}: Options) {
  const [alertas, setAlertas] = useState<AlertaApi[]>([])
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [alertasEntrantes, setAlertasEntrantes] = useState<AlertaApi[]>([])
  const [seguirAlerta, setSeguirAlerta] = useState<SeguirAlertaActiva | null>(null)
  const [calculandoSeguir, setCalculandoSeguir] = useState(false)
  const vistasRef = useRef<Set<string>>(new Set())
  const userIdRef = useRef(userId)
  const myPositionRef = useRef(myPosition)
  userIdRef.current = userId
  myPositionRef.current = myPosition

  const alertaEntrante = alertasEntrantes[0] ?? null

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
          if (esAlertaParaBanner(p.alerta, userIdRef.current, vistasRef.current)) {
            vistasRef.current.add(p.alerta.id)
            setAlertasEntrantes((prev) => {
              if (prev.some((a) => a.id === p.alerta.id)) return prev
              return [...prev, p.alerta]
            })
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

  useEffect(() => {
    if (!viajeId || !habilitado) return
    const sub = DeviceEventEmitter.addListener(
      'mesh:alertas_resueltas',
      (p: { viajeId: string; usuarioId: string }) => {
        if (p.viajeId !== viajeId) return
        setAlertas((prev) =>
          prev.map((a) => {
            if (a.origen !== 'sistema' || a.estado !== 'activa') return a
            if (usuarioAfectadoDesdeMensaje(a.mensaje) !== p.usuarioId) return a
            return { ...a, estado: 'resuelta' }
          })
        )
        setAlertasEntrantes((prev) =>
          prev.filter(
            (a) =>
              !(
                a.origen === 'sistema' &&
                usuarioAfectadoDesdeMensaje(a.mensaje) === p.usuarioId
              )
          )
        )
      }
    )
    return () => sub.remove()
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

  const ignorarAlertaEntrante = useCallback(() => {
    setAlertasEntrantes((prev) => prev.slice(1))
  }, [])

  const activarSeguirAlerta = useCallback(async () => {
    const entrante = alertasEntrantes[0]
    if (!entrante || entrante.lat == null || entrante.lng == null) return null

    const pos = myPositionRef.current
    if (!pos) {
      meshWarning('Sin ubicación', 'No tenemos tu posición para calcular la ruta hasta el punto.')
      return null
    }

    setCalculandoSeguir(true)
    try {
      const destino = { lat: entrante.lat, lng: entrante.lng }
      const polyline = await calcularGuiaHastaDestino(pos, destino, tipoActividad)
      const activa: SeguirAlertaActiva = {
        alertaId: entrante.id,
        lat: destino.lat,
        lng: destino.lng,
        label: entrante.creada_por_nombre ?? 'Punto de parada',
        polyline,
      }
      setSeguirAlerta(activa)
      setAlertasEntrantes((prev) => prev.filter((a) => a.id !== entrante.id))
      return activa
    } finally {
      setCalculandoSeguir(false)
    }
  }, [alertasEntrantes, tipoActividad])

  const dejarDeSeguirAlerta = useCallback(() => {
    setSeguirAlerta(null)
  }, [])

  return {
    alertas,
    alertaEntrante,
    alertasEntrantes,
    seguirAlerta,
    cargando,
    enviando,
    calculandoSeguir,
    publicar,
    refrescar,
    ignorarAlertaEntrante,
    activarSeguirAlerta,
    dejarDeSeguirAlerta,
  }
}
