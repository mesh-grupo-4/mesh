// GSAP, ScrollTrigger, Lenis y la orquestación de las secciones.
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { animacionesPausadas } from '../lib/preferencias'
import { crearCinta } from './cinta'
import { iniciarComunes } from './comun'
import { iniciarComo } from './como'
import { iniciarOffline } from './offline'
import type { Limpieza, Modo } from './tipos'

gsap.registerPlugin(ScrollTrigger)
ScrollTrigger.config({ ignoreMobileResize: true })

const PEREZOSAS: [string, () => Promise<{ iniciar: (m: Modo) => Limpieza | void }>][] = [
  ['#inicio', () => import('./hero')],
  ['#problema', () => import('./problema')],
  ['[data-tr-noche]', () => import('./transiciones')],
  ['#privacidad', () => import('./privacidad')],
  ['#mas', () => import('./bento')],
  ['#competir', () => import('./competir')],
  ['#diferencia', () => import('./diferencia')],
  ['#llegada', () => import('./llegada')],
]

let mm: gsap.MatchMedia | null = null

function arrancar() {
  mm = gsap.matchMedia()
  mm.add(
    {
      escritorio: '(min-width: 900px) and (prefers-reduced-motion: no-preference)',
      movil: '(max-width: 899px) and (prefers-reduced-motion: no-preference)',
      reducido: '(prefers-reduced-motion: reduce)',
    },
    (ctx) => {
      const { escritorio, reducido } = ctx.conditions as Record<string, boolean>
      const limpiezas: Limpieza[] = []
      const cinta = crearCinta()
      limpiezas.push(cinta.destruir)

      // Con reduced motion o pausa: sin pin, sin parallax, sin Lenis, sin loops. Cinta ya dibujada.
      if (reducido || animacionesPausadas()) {
        cinta.dibujarCompleta()
        return () => limpiezas.forEach((l) => l())
      }

      const modo: Modo = { escritorio: Boolean(escritorio) }
      let vivo = true

      // Lenis solo en escritorio con mouse: nunca secuestra el touch.
      if (escritorio && !matchMedia('(pointer: coarse)').matches) {
        const lenis = new Lenis({ anchors: { offset: -88 }, lerp: 0.12, autoRaf: false })
        lenis.on('scroll', ScrollTrigger.update)
        const tick = (t: number) => lenis.raf(t * 1000)
        gsap.ticker.add(tick)
        gsap.ticker.lagSmoothing(0)
        limpiezas.push(() => {
          gsap.ticker.remove(tick)
          gsap.ticker.lagSmoothing(500, 33)
          lenis.destroy()
        })
      }

      // Los pines cambian la altura de la página: se crean primero y en orden.
      const conPin = [iniciarComo(modo), iniciarOffline(modo), iniciarComunes(modo)]
      conPin.forEach((l) => l && limpiezas.push(l))

      ScrollTrigger.refresh()
      cinta.animar()

      const observadores = PEREZOSAS.map(([selector, cargar]) => {
        const el = document.querySelector(selector)
        if (!el) return null
        const io = new IntersectionObserver(async ([e]) => {
          if (!e?.isIntersecting) return
          io.disconnect()
          const m = await cargar()
          if (!vivo) return
          ctx.add(() => {
            const l = m.iniciar(modo)
            if (l) limpiezas.push(l)
          })
          ScrollTrigger.refresh()
        }, { rootMargin: '120% 0px' })
        io.observe(el)
        return io
      })

      // Cambios de altura (actividad elegida, FAQ abierta): remedir los triggers y la cinta.
      let alto = document.body.scrollHeight
      let espera = 0
      const ro = new ResizeObserver(() => {
        clearTimeout(espera)
        espera = window.setTimeout(() => {
          if (Math.abs(document.body.scrollHeight - alto) < 2) return
          alto = document.body.scrollHeight
          ScrollTrigger.refresh()
          cinta.medir()
        }, 200)
      })
      ro.observe(document.body)

      return () => {
        vivo = false
        ro.disconnect()
        clearTimeout(espera)
        observadores.forEach((o) => o?.disconnect())
        limpiezas.forEach((l) => l())
      }
    },
  )
}

export function iniciarNucleo() {
  arrancar()
  addEventListener('mesh:movimiento', () => {
    mm?.revert()
    arrancar()
    ScrollTrigger.refresh()
  })
}
