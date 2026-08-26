/** HTML de un `divIcon` de Leaflet: pin clásico en forma de gota, proporciones del ícono por defecto de Leaflet (25x41, ancla en la punta inferior). */
export function pinMarkerHtml(color: string): string {
  return `<div style="width:25px;height:41px;position:relative;">
    <div style="position:absolute;left:50%;top:50%;width:25px;height:25px;margin-left:-12.5px;margin-top:-12.5px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);"></div>
  </div>`
}

export const PIN_SIZE: [number, number] = [25, 41]
export const PIN_ANCHOR: [number, number] = [12, 41]
