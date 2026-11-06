import { sinMovimiento } from './preferencias'

const miles = new Intl.NumberFormat('es-AR')

/** `contar`: sube desde cero. Con movimiento apagado, muestra el valor final. */
export function contar(el: HTMLElement, hasta: number, duracion = 900) {
  if (sinMovimiento()) {
    el.textContent = miles.format(hasta)
    return
  }
  const inicio = performance.now()
  const paso = (ahora: number) => {
    const f = Math.min(1, (ahora - inicio) / duracion)
    el.textContent = miles.format(Math.round(hasta * (1 - (1 - f) ** 3)))
    if (f < 1) requestAnimationFrame(paso)
  }
  requestAnimationFrame(paso)
}

export function contarEn(caja: Element) {
  caja.querySelectorAll<HTMLElement>('[data-contar]').forEach((el) => contar(el, Number(el.dataset.contar)))
}
