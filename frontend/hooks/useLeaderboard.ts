import { useEffect, useState } from 'react'

import { connectMeshSocket, onMeshSocketConnect } from '@/lib/meshSocket'
import { obtenerLeaderboard, type FilaLeaderboardApi } from '@/lib/viajesApi'

/** RN-071 (SCRUM-51): tabla en vivo. Foto por REST + actualizaciones por socket. */
export function useLeaderboard({ viajeId, habilitado }: { viajeId: string; habilitado: boolean }) {
  const [filas, setFilas] = useState<FilaLeaderboardApi[]>([])
  const [generadoEn, setGeneradoEn] = useState<string | null>(null)

  useEffect(() => {
    if (!viajeId || !habilitado) return
    let cleanup: (() => void) | undefined
    const cargar = () =>
      obtenerLeaderboard(viajeId)
        .then((lb) => {
          setFilas(lb.filas)
          setGeneradoEn(lb.generado_en)
        })
        .catch(() => {
          /* el socket la trae con el próximo ping */
        })
    void cargar()

    void (async () => {
      try {
        const sock = await connectMeshSocket()
        const onLb = (p: { viajeId: string; filas: FilaLeaderboardApi[]; generadoEn: string }) => {
          if (p.viajeId !== viajeId) return
          setFilas(p.filas)
          setGeneradoEn(p.generadoEn)
        }
        const offReconnect = onMeshSocketConnect(() => void cargar())
        sock.on('viaje:leaderboard', onLb)
        cleanup = () => {
          offReconnect()
          sock.off('viaje:leaderboard', onLb)
        }
      } catch {
        /* queda la foto REST */
      }
    })()
    return () => cleanup?.()
  }, [viajeId, habilitado])

  return { filas, generadoEn }
}
