const MARKER_SIZE = 36

/** Marcador del punto donde un integrante registró su parada voluntaria. */
export function paradaMarkerHtml(): string {
  return `<div style="width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;display:flex;align-items:center;justify-content:center;">
    <div style="width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">
      <span style="color:#fff;font-size:14px;font-weight:900;line-height:1;font-family:sans-serif;">II</span>
    </div>
  </div>`
}

export function paradaMarkerPopup(nombre: string, motivo: string | null): string {
  const lineas = [nombre, motivo ? `Para ${motivo}` : 'Parada voluntaria']
    .map((t) => `<div style="font-family:sans-serif;font-size:13px;margin:2px 0;">${t}</div>`)
    .join('')
  return lineas
}
