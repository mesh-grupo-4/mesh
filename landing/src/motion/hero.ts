import { gsap } from 'gsap'
import { crearRuta } from '../lib/ruta'
import { GRUPO_HERO, INDICE_GONZA, RUTA_HERO } from './hero-datos'
import { DUR, EASE } from './tokens'
import type { Limpieza, Modo } from './tipos'

const SEPARACION = 0.05
const RETRASO_GONZA = 0.2
const REPULSION_MAX = 12
const color = gsap.utils.interpolate(['#141210', '#FE3A0F', '#DC2626'])

export function iniciar(_modo: Modo): Limpieza | void {
  const seccion = document.querySelector<HTMLElement>('#inicio')
  const svg = seccion?.querySelector<SVGSVGElement>('[data-hero-svg]')
  if (!seccion || !svg) return
  const ruta = crearRuta(RUTA_HERO)
  const ruedas = [...svg.querySelectorAll<SVGGElement>('[data-hero-rueda]')]
  const giros = ruedas.map((r) => r.querySelector<SVGGElement>('.rueda__giro')!)
  const lineas = [...svg.querySelectorAll<SVGLineElement>('[data-a]')]
  const alerta = seccion.querySelector<HTMLElement>('[data-hero-alerta]')!
  const nombre = svg.querySelector<SVGGElement>('[data-hero-nombre]')!
  const nombreTexto = nombre.querySelector('text')!

  const est = { avance: 0.4, scroll: 0, retraso: RETRASO_GONZA }
  const puntero = { x: -9999, y: -9999, activo: false }
  const pos = GRUPO_HERO.map(() => ({ x: 0, y: 0 }))
  const empuje = GRUPO_HERO.map(() => ({ x: 0, y: 0 }))

  // Cada 6 segundos Gonza se va quedando, salta el aviso y recupera con un rebote elástico.
  gsap.set(alerta, { scale: 1, opacity: 1 })
  const ciclo = gsap.timeline({ repeat: -1 })
    .to(est, { retraso: 0, duration: DUR.epica, ease: EASE.elastico })
    .to(alerta, { opacity: 0, scale: 0.9, duration: DUR.corta, ease: EASE.entrada }, 0)
    .to(est, { retraso: RETRASO_GONZA, duration: 2.4, ease: EASE.suave }, 2)
    .fromTo(alerta, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: DUR.corta, ease: EASE.rebote }, 3.9)
    .to({}, { duration: 1.75 }, 4.25)

  const tick = (_t: number, dt: number) => {
    est.avance = (est.avance + dt * 0.000012) % 1
    GRUPO_HERO.forEach((_g, i) => {
      // Se recorre la cinta en loop: el grupo entra y sale por los extremos, fuera de cuadro.
      const base = est.avance + est.scroll + 0.4 - i * SEPARACION - (i === INDICE_GONZA ? est.retraso : 0)
      const p = ruta.punto(((base % 1) + 1) % 1)
      const e = empuje[i]!
      const dx = p.x - puntero.x
      const dy = p.y - puntero.y
      const d = Math.hypot(dx, dy) || 1
      const fuerza = puntero.activo ? Math.max(0, 1 - d / 150) * REPULSION_MAX : 0
      e.x += ((dx / d) * fuerza - e.x) * 0.12
      e.y += ((dy / d) * fuerza - e.y) * 0.12
      pos[i] = { x: p.x + e.x, y: p.y + e.y }
      ruedas[i]!.setAttribute('transform', `translate(${pos[i]!.x.toFixed(1)} ${pos[i]!.y.toFixed(1)})`)
      giros[i]!.setAttribute('transform', `rotate(${((base * 2400) % 360).toFixed(1)})`)
    })
    for (const l of lineas) {
      const a = pos[Number(l.dataset.a)]!
      const b = pos[Number(l.dataset.b)]!
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      l.setAttribute('x1', a.x.toFixed(1))
      l.setAttribute('y1', a.y.toFixed(1))
      l.setAttribute('x2', b.x.toFixed(1))
      l.setAttribute('y2', b.y.toFixed(1))
      // estirarMalla: la línea se adelgaza y se tiñe según la distancia. Las lejanas (fuera de cuadro) se apagan.
      const f = gsap.utils.clamp(0, 1, (d - 120) / 240)
      l.setAttribute('stroke', color(f))
      l.setAttribute('stroke-width', (3.4 - f * 2).toFixed(2))
      l.setAttribute('opacity', d > 520 ? '0' : '1')
    }
  }

  let activo = false
  const prender = (on: boolean) => {
    if (on === activo) return
    activo = on
    if (on) {
      gsap.ticker.add(tick)
      ciclo.play()
    } else {
      gsap.ticker.remove(tick)
      ciclo.pause()
    }
  }
  const io = new IntersectionObserver(([e]) => prender(Boolean(e?.isIntersecting)))
  io.observe(seccion)

  const mover = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
    puntero.x = p.x
    puntero.y = p.y
    puntero.activo = true
    // Sobre una rueda, su nombre.
    let cerca = -1
    pos.forEach((q, i) => {
      if (Math.hypot(q.x - p.x, q.y - p.y) < 36) cerca = i
    })
    if (cerca >= 0) {
      nombreTexto.textContent = GRUPO_HERO[cerca]!.nombre
      nombre.setAttribute('transform', `translate(${pos[cerca]!.x.toFixed(1)} ${(pos[cerca]!.y - 50).toFixed(1)})`)
      nombre.setAttribute('opacity', '1')
    } else nombre.setAttribute('opacity', '0')
  }
  const salir = () => {
    puntero.activo = false
    nombre.setAttribute('opacity', '0')
  }
  seccion.addEventListener('pointermove', mover)
  seccion.addEventListener('pointerleave', salir)

  // Con el scroll, el grupo avanza más rápido y el título se aleja.
  gsap.to(est, { scroll: 0.22, ease: EASE.scroll, scrollTrigger: { trigger: seccion, start: 'top top', end: 'bottom top', scrub: true } })
  gsap.to('[data-hero-h1]', { yPercent: -16, ease: EASE.scroll, scrollTrigger: { trigger: seccion, start: 'top top', end: 'bottom top', scrub: true } })

  return () => {
    prender(false)
    io.disconnect()
    ciclo.kill()
    seccion.removeEventListener('pointermove', mover)
    seccion.removeEventListener('pointerleave', salir)
    gsap.set(alerta, { clearProps: 'all' })
    giros.forEach((g) => g.removeAttribute('transform'))
  }
}
