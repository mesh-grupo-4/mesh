// Offline: pin en escritorio. En mobile y con reduced motion, la tira de cuatro viñetas cuenta lo mismo.
import { gsap } from 'gsap'
import { OFFLINE } from '../content/copy'
import { crearRuta } from '../lib/ruta'
import { PUNTOS_OFFLINE, RUTA_OFFLINE } from './offline-datos'
import type { Limpieza, Modo } from './tipos'

const ALTO_MINIMO = 620
const ZONA = { desde: 430, hasta: 950 }
const NS = 'http://www.w3.org/2000/svg'

export function iniciarOffline(modo: Modo): Limpieza | void {
  if (!modo.escritorio || innerHeight < ALTO_MINIMO) return
  const raiz = document.documentElement
  const escena = document.querySelector<HTMLElement>('[data-off-pin]')
  if (!escena) return
  raiz.dataset.off = 'pin'
  const vinetas = document.querySelector<HTMLElement>('[data-off-vinetas]')
  vinetas?.removeAttribute('tabindex')

  const ruta = crearRuta(RUTA_OFFLINE)
  const gonza = escena.querySelector<SVGGElement>('[data-off-gonza]')!
  const nombre = escena.querySelector<SVGTextElement>('[data-off-nombre]')!
  const solida = escena.querySelector<SVGPathElement>('[data-off-solida]')!
  const grupoPuntos = escena.querySelector<SVGGElement>('[data-off-puntos-g]')!
  const barras = escena.querySelector<HTMLElement>('[data-off-barras]')!
  const senal = escena.querySelector<HTMLElement>('[data-off-senal]')!
  const contador = escena.querySelector<HTMLElement>('[data-off-contador]')!
  const original = contador.innerHTML

  // Dónde entra y sale de la zona sin señal, medido sobre la ruta.
  let tEntra = 0
  let tSale = 1
  for (let t = 0; t <= 1; t += 0.002) {
    const { x } = ruta.punto(t)
    if (x < ZONA.desde) tEntra = t
    if (x < ZONA.hasta) tSale = t
  }

  // Cada punto guardado es un punto real en la escena: uno cada 5 segundos.
  const puntos = Array.from({ length: PUNTOS_OFFLINE }, (_, i) => {
    const t = tEntra + ((tSale - tEntra) * (i + 0.5)) / PUNTOS_OFFLINE
    const p = ruta.punto(t)
    const c = document.createElementNS(NS, 'circle')
    c.setAttribute('cx', p.x.toFixed(1))
    c.setAttribute('cy', p.y.toFixed(1))
    c.setAttribute('r', '4')
    c.setAttribute('fill', 'var(--hueso)')
    c.setAttribute('opacity', '0')
    grupoPuntos.append(c)
    return c
  })

  let sincronizado = false
  const pintar = (t: number) => {
    const p = ruta.punto(t)
    gonza.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`)
    nombre.setAttribute('x', p.x.toFixed(1))
    nombre.setAttribute('y', (p.y - 42).toFixed(1))

    const enZona = t >= tEntra && t < tSale
    const salio = t >= tSale
    gonza.setAttribute('opacity', enZona ? '.45' : '1')
    nombre.setAttribute('opacity', enZona ? '.45' : '1')
    barras.toggleAttribute('data-vacia', enZona)
    senal.textContent = enZona ? OFFLINE.sinSenal : OFFLINE.conSenal

    const guardados = enZona ? Math.ceil(((t - tEntra) / (tSale - tEntra)) * PUNTOS_OFFLINE) : salio ? PUNTOS_OFFLINE : 0
    puntos.forEach((c, i) => c.setAttribute('opacity', enZona && i < guardados ? '1' : '0'))

    // Al volver la señal, lo punteado se vuelve sólido: no se perdió ni un metro.
    solida.setAttribute('stroke-dashoffset', String(1 - (enZona ? tEntra : t)))
    if (salio !== sincronizado || !salio) {
      sincronizado = salio
      contador.innerHTML = salio
        ? `<strong>${OFFLINE.sincronizado}</strong>`
        : `${OFFLINE.contador}: <strong>${guardados}</strong> ${OFFLINE.puntos}`
    }
    if (salio && t - tSale < 0.05) gsap.set(solida, { attr: { 'stroke-width': 14 + (0.05 - (t - tSale)) * 240 } })
    else gsap.set(solida, { attr: { 'stroke-width': 14 } })
  }

  const avance = { t: 0.08 }
  pintar(avance.t)
  const tween = gsap.to(avance, {
    t: 0.97,
    ease: 'none',
    onUpdate: () => pintar(avance.t),
    scrollTrigger: { trigger: escena, pin: true, start: 'top top', end: '+=240%', scrub: 0.3 },
  })

  return () => {
    tween.scrollTrigger?.kill()
    tween.kill()
    delete raiz.dataset.off
    vinetas?.setAttribute('tabindex', '0')
    puntos.forEach((c) => c.remove())
    contador.innerHTML = original
    barras.removeAttribute('data-vacia')
    senal.textContent = OFFLINE.conSenal
  }
}
