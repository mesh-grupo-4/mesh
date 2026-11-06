import { PRIV } from '../content/copy'

export function iniciarPrivacidad() {
  const seccion = document.querySelector<HTMLElement>('[data-privacidad]')
  const boton = seccion?.querySelector<HTMLButtonElement>('[data-priv-interruptor]')
  if (!seccion || !boton) return
  const estado = seccion.querySelector<HTMLElement>('[data-priv-estado]')
  const puntos = seccion.querySelector<HTMLElement>('[data-priv-puntos]')
  let cuenta = 0
  let reloj = 0

  boton.addEventListener('click', () => {
    const comparte = boton.getAttribute('aria-checked') !== 'true'
    boton.setAttribute('aria-checked', String(comparte))
    seccion.dataset.comparte = comparte ? 'si' : 'no'
    if (estado) estado.textContent = comparte ? PRIV.encendido : PRIV.apagado
    clearInterval(reloj)
    // Con el compartir apagado, el recorrido se sigue guardando (RN-111).
    if (!comparte) {
      reloj = window.setInterval(() => {
        if (document.hidden) return
        cuenta += 1
        if (puntos) puntos.textContent = String(cuenta)
      }, 1000)
    }
  })
}
