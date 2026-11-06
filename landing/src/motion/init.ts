// Punto de entrada. Lo imprescindible corre ya y sin GSAP; las animaciones llegan por import dinámico.
import { FOOTER } from '../content/copy'
import { iniciarActividades } from '../interaccion/actividades'
import { iniciarCompartir } from '../interaccion/compartir'
import { iniciarNav } from '../interaccion/nav'
import { iniciarPrivacidad } from '../interaccion/privacidad'
import { escucharAnalitica } from '../lib/analitica'
import { adaptarDescarga } from '../lib/dispositivo'
import { animacionesPausadas, pausarAnimaciones } from '../lib/preferencias'

iniciarNav()
iniciarActividades()
iniciarPrivacidad()
iniciarCompartir()
adaptarDescarga()
escucharAnalitica()

/** Pausa los loops de CSS de lo que no está en pantalla. */
const fueraDeVista = new IntersectionObserver((entradas) => {
  for (const e of entradas) e.target.classList.toggle('fuera', !e.isIntersecting)
})
document.querySelectorAll('[data-seccion]').forEach((s) => fueraDeVista.observe(s))

const botonPausa = document.querySelector<HTMLButtonElement>('[data-pausar]')
if (botonPausa) {
  const pintar = () => {
    const pausadas = animacionesPausadas()
    botonPausa.textContent = pausadas ? FOOTER.reanudar : FOOTER.pausar
    botonPausa.setAttribute('aria-pressed', String(pausadas))
  }
  botonPausa.addEventListener('click', () => {
    pausarAnimaciones(!animacionesPausadas())
    pintar()
  })
  pintar()
}

// El simulador funciona sin GSAP: con reduced motion también se puede jugar.
const sim = document.querySelector('[data-sim]')
if (sim) {
  const observador = new IntersectionObserver(([e]) => {
    if (e?.isIntersecting) {
      observador.disconnect()
      void import('../sim/controlador').then((m) => m.iniciar())
    }
  }, { rootMargin: '100% 0px' })
  observador.observe(sim)
}

const cargarNucleo = () => void import('./nucleo').then((m) => m.iniciarNucleo())
if ('requestIdleCallback' in window) requestIdleCallback(cargarNucleo, { timeout: 1200 })
else setTimeout(cargarNucleo, 300)
