// Movimientos de la biblioteca (plan, 6.3) que se repiten en toda la página.
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DUR, EASE, STAGGER } from './tokens'
import type { Limpieza, Modo } from './tipos'

/** Parte un título en palabras enmascaradas. Devuelve cómo restaurarlo. */
export function partirPalabras(el: HTMLElement): { palabras: HTMLElement[]; restaurar: Limpieza } {
  const original = el.innerHTML
  const texto = el.textContent?.trim() ?? ''
  el.setAttribute('aria-label', texto)
  el.innerHTML = texto
    .split(/\s+/)
    .map((p) => `<span aria-hidden="true" style="display:inline-block;overflow:hidden;vertical-align:bottom;padding:.08em .04em .12em 0;margin:-.08em -.04em -.12em 0"><span data-palabra style="display:inline-block">${p}</span></span>`)
    .join(' ')
  return {
    palabras: [...el.querySelectorAll<HTMLElement>('[data-palabra]')],
    restaurar: () => {
      el.innerHTML = original
      el.removeAttribute('aria-label')
    },
  }
}

export function iniciarComunes(modo: Modo): Limpieza {
  const limpiezas: Limpieza[] = []

  // revelarTitulo
  document.querySelectorAll<HTMLElement>('[data-titulo]').forEach((titulo) => {
    const { palabras, restaurar } = partirPalabras(titulo)
    gsap.from(palabras, {
      yPercent: 110,
      duration: DUR.media,
      ease: EASE.salida,
      stagger: STAGGER.palabras,
      scrollTrigger: { trigger: titulo, start: 'top 88%', once: true },
    })
    limpiezas.push(restaurar)
  })

  // girarRuedas: giran según la velocidad del scroll, con inercia
  const giros = [...document.querySelectorAll<SVGGElement>('.rueda__giro')].filter((g) => g.querySelector('rect') && !g.closest('[data-hero-rueda]'))
  let angulo = 0
  let velocidad = 0
  const tick = () => {
    velocidad *= 0.94
    if (Math.abs(velocidad) < 0.02) return
    angulo += velocidad
    giros.forEach((g) => g.setAttribute('transform', `rotate(${angulo.toFixed(1)})`))
  }
  gsap.ticker.add(tick)
  const rotor = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      velocidad = gsap.utils.clamp(-14, 14, self.getVelocity() / 140)
    },
  })
  limpiezas.push(() => {
    gsap.ticker.remove(tick)
    rotor.kill()
    giros.forEach((g) => g.removeAttribute('transform'))
  })

  // magnetico: solo con mouse, hasta 8 px
  if (modo.escritorio && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll<HTMLElement>('.btn-primario, .btn-tinta').forEach((b) => {
      const x = gsap.quickTo(b, 'x', { duration: DUR.corta, ease: EASE.salida })
      const y = gsap.quickTo(b, 'y', { duration: DUR.corta, ease: EASE.salida })
      const mover = (e: PointerEvent) => {
        const r = b.getBoundingClientRect()
        x(gsap.utils.clamp(-8, 8, (e.clientX - r.left - r.width / 2) * 0.16))
        y(gsap.utils.clamp(-8, 8, (e.clientY - r.top - r.height / 2) * 0.28))
      }
      const salir = () => {
        x(0)
        y(0)
      }
      b.addEventListener('pointermove', mover)
      b.addEventListener('pointerleave', salir)
      limpiezas.push(() => {
        b.removeEventListener('pointermove', mover)
        b.removeEventListener('pointerleave', salir)
        gsap.set(b, { clearProps: 'transform' })
      })
    })
  }

  return () => limpiezas.forEach((l) => l())
}
