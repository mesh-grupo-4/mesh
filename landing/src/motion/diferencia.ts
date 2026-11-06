import { gsap } from 'gsap'
import { DUR, EASE } from './tokens'
import type { Limpieza, Modo } from './tipos'

export function iniciar(_modo: Modo): Limpieza | void {
  const filas = gsap.utils.toArray<HTMLElement>('[data-dif-fila]')
  filas.forEach((fila) => {
    const mesh = fila.querySelector<HTMLElement>('[data-dif-mesh]')
    gsap.timeline({ scrollTrigger: { trigger: fila, start: 'top 88%', once: true } })
      .from(fila, { opacity: 0, duration: DUR.corta, ease: EASE.salida })
      .from(mesh, { scale: 0.6, opacity: 0, display: 'inline-block', duration: DUR.corta, ease: EASE.rebote }, '-=.15')
  })
  return () => gsap.set([...filas, ...gsap.utils.toArray('[data-dif-mesh]')], { clearProps: 'all' })
}
