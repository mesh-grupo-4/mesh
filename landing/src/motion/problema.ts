import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PROBLEMA } from '../content/copy'
import { DUR, EASE } from './tokens'
import type { Limpieza, Modo } from './tipos'

export function iniciar(modo: Modo): Limpieza | void {
  const chat = document.querySelector<HTMLElement>('[data-chat]')
  const burbujas = gsap.utils.toArray<HTMLElement>('[data-burbuja]')
  const estado = document.querySelector<HTMLElement>('[data-chat-estado]')
  const remate = document.querySelector<HTMLElement>('[data-remate]')
  if (!chat || !burbujas.length || !estado || !remate) return

  const textoEstado = (i: number) => {
    const siguiente = burbujas[i]
    estado.textContent = siguiente ? `${siguiente.dataset.quien} está escribiendo...` : PROBLEMA.chatSub
  }

  gsap.set(burbujas, { opacity: 0, scale: 0.6, transformOrigin: '0% 0%' })
  textoEstado(0)

  burbujas.forEach((b, i) => {
    ScrollTrigger.create({
      trigger: b,
      start: 'top 90%',
      onEnter: () => {
        gsap.to(b, { opacity: 1, scale: 1, duration: DUR.corta, ease: EASE.rebote, overwrite: true })
        textoEstado(i + 1)
      },
      onLeaveBack: () => {
        gsap.to(b, { opacity: 0, scale: 0.6, duration: DUR.micro, ease: EASE.entrada, overwrite: true })
        textoEstado(i)
      },
    })
  })

  // Remate: el último mensaje queda, el chat se encoge a la izquierda y entra la frase.
  const ultima = burbujas[burbujas.length - 1]!
  gsap.from(remate, {
    opacity: 0,
    y: 28,
    duration: DUR.media,
    ease: EASE.salida,
    scrollTrigger: { trigger: ultima, start: 'top 80%', toggleActions: 'play none none reverse' },
  })
  if (modo.escritorio) {
    gsap.to(chat, {
      scale: 0.9,
      transformOrigin: '0% 100%',
      ease: EASE.scroll,
      scrollTrigger: { trigger: ultima, start: 'top 70%', end: 'top 30%', scrub: true },
    })
    ScrollTrigger.create({ trigger: ultima, start: 'top 70%', endTrigger: '#problema', end: 'bottom top', toggleClass: { targets: chat, className: 'chat--encogido' } })
  }

  return () => {
    gsap.set(burbujas, { clearProps: 'all' })
    gsap.set(chat, { clearProps: 'transform' })
    chat.classList.remove('chat--encogido')
    estado.textContent = PROBLEMA.chatSub
  }
}
