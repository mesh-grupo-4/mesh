const CLAVE = 'mesh-animaciones'
const raiz = document.documentElement
const consulta = matchMedia('(prefers-reduced-motion: reduce)')

export function animacionesPausadas(): boolean {
  try {
    return localStorage.getItem(CLAVE) === 'pausadas'
  } catch {
    return false
  }
}

export const sinMovimiento = () => raiz.dataset.motion === 'off'

function aplicar() {
  raiz.dataset.motion = animacionesPausadas() || consulta.matches ? 'off' : 'on'
  dispatchEvent(new CustomEvent('mesh:movimiento'))
}

export function pausarAnimaciones(pausar: boolean) {
  try {
    if (pausar) localStorage.setItem(CLAVE, 'pausadas')
    else localStorage.removeItem(CLAVE)
  } catch {
    // Sin localStorage, la pausa dura hasta recargar: el plan pide persistir, no bloquear.
  }
  aplicar()
}

consulta.addEventListener('change', aplicar)
