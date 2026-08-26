import { mensajeAlertaVisible, metaTipoAlerta, type AlertaApi } from '@/lib/alertasApi'

const MARKER_SIZE = 36

/** Marcador de alerta activa en el mapa en vivo (RN-034: ubicación del desvío). */
export function alertMarkerHtml(alerta: AlertaApi): string {
  const meta = metaTipoAlerta(alerta.tipo)
  const msg = mensajeAlertaVisible(alerta.mensaje)

  return `<div style="width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;display:flex;align-items:center;justify-content:center;">
    <div style="width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;border-radius:50%;background:${meta.color};display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">
      <span style="font-size:18px;line-height:1;">${meta.emoji}</span>
    </div>
  </div>${msg ? '' : ''}`
}

export function alertMarkerPopup(alerta: AlertaApi): string {
  const meta = metaTipoAlerta(alerta.tipo)
  const msg = mensajeAlertaVisible(alerta.mensaje)
  const lineas = [meta.label, msg, alerta.creada_por_nombre, alerta.origen === 'sistema' ? 'Alerta automática' : null]
    .filter(Boolean)
    .map((t) => `<div style="font-family:sans-serif;font-size:13px;margin:2px 0;">${t}</div>`)
    .join('')
  return lineas
}
