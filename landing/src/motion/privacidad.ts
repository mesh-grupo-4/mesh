// Sobria a propósito: un fundido simple, sin rebote. El interruptor es la única estrella.
import { gsap } from 'gsap'
import { DUR, EASE, STAGGER } from './tokens'
import type { Limpieza, Modo } from './tipos'

export function iniciar(_modo: Modo): Limpieza | void {
  const puntos = gsap.utils.toArray<HTMLElement>('[data-priv-punto]')
  gsap.from(puntos, {
    opacity: 0,
    duration: DUR.media,
    ease: EASE.suave,
    stagger: STAGGER.tarjetas,
    scrollTrigger: { trigger: puntos[0], start: 'top 88%', once: true },
  })
  return () => gsap.set(puntos, { clearProps: 'all' })
}
