// Frase palabra por palabra (8.5) y la transición crema a noche (6.4).
import { gsap } from 'gsap'
import { EASE } from './tokens'
import type { Limpieza, Modo } from './tipos'

export function iniciar(_modo: Modo): Limpieza | void {
  const palabras = gsap.utils.toArray<HTMLElement>('.transicion__palabra')
  gsap.fromTo(palabras, { opacity: 0.14 }, {
    opacity: 1,
    ease: EASE.scroll,
    stagger: 0.1,
    scrollTrigger: { trigger: '[data-frase]', start: 'top 78%', end: 'bottom 45%', scrub: true },
  })

  const banda = document.querySelector<HTMLElement>('.tr-noche__banda')
  if (banda) {
    // Solo es naranja mientras es finita: el naranja a pantalla completa queda para la llegada (plan, 4.3).
    gsap.timeline({ defaults: { ease: EASE.scroll }, scrollTrigger: { trigger: '[data-tr-noche]', start: 'top 80%', end: 'bottom bottom', scrub: true } })
      .fromTo(banda, { scaleX: 0.03 }, { scaleX: 1, duration: 1 }, 0)
      .fromTo(banda, { backgroundColor: '#FE3A0F' }, { backgroundColor: '#0F0F0F', duration: 0.22 }, 0.04)
  }
  return () => {
    gsap.set(palabras, { clearProps: 'opacity' })
    if (banda) gsap.set(banda, { clearProps: 'all' })
  }
}
