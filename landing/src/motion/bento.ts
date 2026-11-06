import { gsap } from 'gsap'
import { contarEn } from '../lib/contar'
import { DUR, EASE, STAGGER } from './tokens'
import type { Limpieza, Modo } from './tipos'

const INCLINACION_MAX = 4

export function iniciar(modo: Modo): Limpieza | void {
  const celdas = gsap.utils.toArray<HTMLElement>('[data-celda]')
  if (!celdas.length) return
  const limpiezas: Limpieza[] = []

  const animar = (c: HTMLElement) => {
    c.classList.remove('animar')
    void c.offsetWidth
    c.classList.add('animar')
    contarEn(c)
  }

  gsap.from(celdas, {
    opacity: 0,
    y: modo.escritorio ? 36 : 16,
    duration: DUR.media,
    ease: EASE.salida,
    stagger: modo.escritorio ? STAGGER.tarjetas : 0,
    scrollTrigger: { trigger: celdas[0], start: 'top 86%', once: true },
  })

  const io = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) {
        animar(e.target as HTMLElement)
        io.unobserve(e.target)
      }
    }
  }, { threshold: 0.4 })
  celdas.forEach((c) => io.observe(c))
  limpiezas.push(() => io.disconnect())

  if (modo.escritorio && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    celdas.forEach((c) => {
      const rx = gsap.quickTo(c, 'rotationX', { duration: DUR.corta, ease: EASE.salida })
      const ry = gsap.quickTo(c, 'rotationY', { duration: DUR.corta, ease: EASE.salida })
      gsap.set(c, { transformPerspective: 900 })
      const mover = (e: PointerEvent) => {
        const r = c.getBoundingClientRect()
        ry(((e.clientX - r.left) / r.width - 0.5) * INCLINACION_MAX * 2)
        rx(-((e.clientY - r.top) / r.height - 0.5) * INCLINACION_MAX * 2)
      }
      const entrar = () => animar(c)
      const salir = () => {
        rx(0)
        ry(0)
      }
      c.addEventListener('pointerenter', entrar)
      c.addEventListener('pointermove', mover)
      c.addEventListener('pointerleave', salir)
      limpiezas.push(() => {
        c.removeEventListener('pointerenter', entrar)
        c.removeEventListener('pointermove', mover)
        c.removeEventListener('pointerleave', salir)
      })
    })
  }

  return () => {
    limpiezas.forEach((l) => l())
    celdas.forEach((c) => c.classList.remove('animar'))
    gsap.set(celdas, { clearProps: 'all' })
  }
}
