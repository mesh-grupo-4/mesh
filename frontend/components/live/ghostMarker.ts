/** RN-073: marcador del fantasma en el mapa en vivo (violeta, semitransparente). */
export const GHOST_MARKER_BOX = 34

export function ghostMarkerHtml(nombre: string, pausado: boolean): string {
  const inicial = (nombre.trim()[0] ?? 'F').toUpperCase()
  return `<div style="width:${GHOST_MARKER_BOX}px;height:${GHOST_MARKER_BOX}px;display:flex;align-items:center;justify-content:center;opacity:${pausado ? 0.45 : 0.85};">
    <div style="width:28px;height:28px;border-radius:50%;background:#7c3aed;border:2px dashed #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.35);">
      <span style="color:#fff;font-weight:800;font-size:11px;font-family:sans-serif;">👻</span>
    </div>
  </div>`
}

export const GHOST_TRAIL_COLOR = '#7c3aed'
