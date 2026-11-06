// La llegada. El CTA nunca espera: la secuencia corre alrededor de él, no antes.
import { gsap } from 'gsap'
import { DUR, EASE, STAGGER } from './tokens'
import type { Limpieza, Modo } from './tipos'

export function iniciar(_modo: Modo): Limpieza | void {
  const seccion = document.querySelector<HTMLElement>('[data-llegada]')
  const contador = seccion?.querySelector<HTMLElement>('[data-lleg-contador]')
  const falta = seccion?.querySelector<HTMLElement>('[data-lleg-falta]')
  const final = seccion?.querySelector<HTMLElement>('[data-lleg-final]')
  if (!seccion || !contador || !falta || !final) return
  const ruedas = gsap.utils.toArray<HTMLElement>('[data-lleg-ruedas] .rueda', seccion)
  const gonza = ruedas[ruedas.length - 1]!
  const anillos = gsap.utils.toArray<HTMLElement>('[data-lleg-anillos] span', seccion)

  // La cinta se abre en un círculo desde el destino hasta llenar la pantalla.
  gsap.fromTo(seccion, { clipPath: 'circle(4% at 50% 0%)' }, {
    clipPath: 'circle(150% at 50% 0%)',
    ease: EASE.scroll,
    scrollTrigger: { trigger: seccion, start: 'top 92%', end: 'top 24%', scrub: true },
  })

  const estadoInicial = () => {
    contador.textContent = '5/6'
    falta.hidden = false
    final.classList.add('solo-lector')
  }
  const estadoFinal = () => {
    contador.textContent = '6/6'
    falta.hidden = true
    final.classList.remove('solo-lector')
  }
  estadoInicial()
  gsap.set(gonza, { opacity: 0 })

  const tl = gsap.timeline({ scrollTrigger: { trigger: seccion, start: 'top 45%', once: true } })
    .from(ruedas.slice(0, -1), { x: () => -innerWidth * 0.5, duration: DUR.larga, ease: EASE.salida, stagger: STAGGER.ruedas * 2 })
    .to({}, { duration: 1.2 })
    // Gonza entra corriendo por el costado con un rebote, y frena de golpe.
    .fromTo(gonza, { opacity: 1, x: () => innerWidth * 0.8 }, { x: 0, duration: DUR.media, ease: EASE.rebote })
    .call(estadoFinal)
    .fromTo(contador, { scale: 0.86 }, { scale: 1, duration: DUR.corta, ease: EASE.rebote, transformOrigin: '0% 100%' })
    .fromTo(anillos, { opacity: 0.9, scale: 0.05 }, { opacity: 0, scale: 1.5, duration: DUR.epica, ease: EASE.salida, stagger: 0.14, immediateRender: false }, '<')

  return () => {
    tl.scrollTrigger?.kill()
    tl.kill()
    estadoFinal()
    gsap.set([seccion, contador, ...ruedas, ...anillos], { clearProps: 'all' })
  }
}
