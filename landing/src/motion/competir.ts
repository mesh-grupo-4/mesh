// La animación del bloque de moto es, a propósito, la más lenta de toda la página (plan, 8.10).
import { gsap } from 'gsap'
import { DUR, EASE, STAGGER } from './tokens'
import type { Limpieza, Modo } from './tipos'

export function iniciar(_modo: Modo): Limpieza | void {
  const filas = gsap.utils.toArray<HTMLElement>('[data-comp-fila]')
  const moto = document.querySelector<HTMLElement>('[data-comp-moto]')
  const rueda = document.querySelector<HTMLElement>('[data-comp-rueda]')
  const lineas = gsap.utils.toArray<HTMLElement>('[data-comp-linea]')
  const apagada = document.querySelector<HTMLElement>('[data-comp-apagada]')

  gsap.from(filas, {
    opacity: 0,
    x: -18,
    duration: DUR.corta,
    ease: EASE.salida,
    stagger: STAGGER.tarjetas,
    scrollTrigger: { trigger: filas[0], start: 'top 85%', once: true },
  })

  if (moto && rueda) {
    gsap.timeline({ scrollTrigger: { trigger: moto, start: 'top 62%', once: true } })
      .fromTo(apagada, { opacity: 0.7 }, { opacity: 0.1, duration: 2.2, ease: 'sine.inOut' }, 0)
      .from(rueda, { x: () => -innerWidth * 0.3, rotation: -120, duration: 3.6, ease: 'sine.out' }, 0)
      .from(lineas, { opacity: 0, duration: 1.4, ease: 'sine.inOut', stagger: 0.9 }, 1.2)
  }

  return () => gsap.set([...filas, ...lineas, rueda, apagada], { clearProps: 'all' })
}
