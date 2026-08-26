import { colorFromName, inicialesDe } from '@/components/AvatarFallback'
import type { MemberLocation } from '@/hooks/useLiveLocations'

/**
 * HTML de un `divIcon` de Leaflet que replica el marcador nativo que dibujaba
 * `AvatarFallback` sobre react-native-maps: caja 48px, avatar 36px con
 * iniciales, anillo de 3px (verde si soy yo, ámbar si está detenido — este
 * último tiene prioridad, igual que el `style` array original) y badge "II"
 * cuando corresponde. Opacidad reducida si la posición quedó vieja.
 */
const AVATAR_SIZE = 36
const RING_WIDTH = 3
const MARKER_BOX = 48

export function memberMarkerHtml(member: MemberLocation, isMe: boolean): string {
  const detenido = member.estado === 'detenido_voluntario'
  const incidente = member.estado === 'posible_incidente'
  const ringColor = incidente ? '#dc2626' : detenido ? '#f59e0b' : isMe ? '#15803d' : 'transparent'
  const bg = colorFromName(member.nombre)
  const iniciales = inicialesDe(member.nombre)
  const boxOpacity = member.isStale ? 0.45 : 1

  return `<div style="width:${MARKER_BOX}px;height:${MARKER_BOX}px;display:flex;align-items:center;justify-content:center;position:relative;opacity:${boxOpacity};">
    <div style="width:${AVATAR_SIZE + RING_WIDTH * 2}px;height:${AVATAR_SIZE + RING_WIDTH * 2}px;border-radius:50%;border:${RING_WIDTH}px solid ${ringColor};display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
      <div style="width:${AVATAR_SIZE}px;height:${AVATAR_SIZE}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-weight:700;font-size:${Math.round(AVATAR_SIZE * 0.38)}px;font-family:sans-serif;">${iniciales}</span>
      </div>
    </div>
    ${
      detenido || incidente
        ? `<div style="position:absolute;right:2px;bottom:2px;width:16px;height:16px;border-radius:50%;background:${incidente ? '#dc2626' : '#f59e0b'};display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">
      <span style="color:#fff;font-size:8px;font-weight:900;letter-spacing:-0.5px;font-family:sans-serif;">${incidente ? '!' : 'II'}</span>
    </div>`
        : ''
    }
  </div>`
}
