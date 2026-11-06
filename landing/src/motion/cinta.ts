// La cinta global: se traza midiendo la página y se dibuja hasta la altura de lectura.
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { crearRuta, type Ruta } from '../lib/ruta'

const NS = 'http://www.w3.org/2000/svg'
const SEPARACION_RUEDAS = 44
const TOTAL_RUEDAS = 6

function crearRueda(): SVGGElement {
  const g = document.createElementNS(NS, 'g')
  const partes: [number, string][] = [[15, 'var(--tinta)'], [6.8, 'var(--crema)'], [3.7, 'var(--tinta)']]
  for (const [r, fill] of partes) {
    const c = document.createElementNS(NS, 'circle')
    c.setAttribute('r', String(r))
    c.setAttribute('fill', fill)
    g.append(c)
  }
  return g
}

/** Baja por un costado de cada sección y cruza al otro en el espacio entre secciones. */
function trazar(ancho: number): string {
  const secciones = [...document.querySelectorAll<HTMLElement>('[data-cinta-seccion]')]
  const movil = ancho < 900
  const borde = movil ? 7 : Math.max(26, (ancho - 1320) / 2 + 22)
  const cruce = movil ? 70 : 120
  const lado = (i: number) => (i % 2 ? ancho - borde : borde)
  const rect = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return { top: r.top + scrollY, bottom: r.bottom + scrollY }
  }

  const primera = rect(secciones[0]!)
  let x = lado(0)
  let y = primera.bottom - cruce * 1.6
  let d = `M ${x} ${y}`
  const recto = (hasta: number) => {
    if (hasta <= y) return
    d += ` C ${x} ${y + (hasta - y) / 3} ${x} ${y + (2 * (hasta - y)) / 3} ${x} ${hasta}`
    y = hasta
  }

  for (let i = 1; i < secciones.length; i++) {
    const { top, bottom } = rect(secciones[i]!)
    const esUltima = i === secciones.length - 1
    const nuevoX = esUltima ? ancho / 2 : lado(i)
    const desde = top - cruce
    recto(desde)
    const hasta = esUltima ? top + 4 : top + cruce
    d += ` C ${x} ${desde + cruce * 1.1} ${nuevoX} ${hasta - cruce * 1.1} ${nuevoX} ${hasta}`
    x = nuevoX
    y = hasta
    if (!esUltima) recto(bottom - cruce)
  }
  return d
}

export function crearCinta() {
  const svg = document.querySelector<SVGSVGElement>('[data-cinta-global]')
  const trazo = svg?.querySelector<SVGPathElement>('[data-cinta-trazo]')
  const grupo = svg?.querySelector<SVGGElement>('[data-cinta-ruedas]')
  let ruta: Ruta | null = null
  let disparador: ScrollTrigger | null = null
  let completa = false
  let escala = 1
  const ruedas: SVGGElement[] = []

  function medir() {
    if (!svg || !trazo) return
    const pagina = document.querySelector<HTMLElement>('[data-pagina]')
    if (!pagina) return
    const ancho = document.documentElement.clientWidth
    const alto = pagina.offsetHeight
    svg.setAttribute('width', String(ancho))
    svg.setAttribute('height', String(alto))
    svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`)
    trazo.setAttribute('stroke-width', ancho < 900 ? '7' : '18')
    escala = ancho < 900 ? 0.55 : 1
    const d = trazar(ancho)
    trazo.setAttribute('d', d)
    ruta = crearRuta(d)
    if (completa) trazo.setAttribute('stroke-dashoffset', '0')
    else actualizar()
  }

  function actualizar() {
    if (!ruta || !trazo) return
    const t = ruta.tEnY(scrollY + innerHeight * 0.72)
    trazo.setAttribute('stroke-dashoffset', String(1 - t))
    const paso = (SEPARACION_RUEDAS * escala) / ruta.largo
    ruedas.forEach((r, i) => {
      const ti = Math.max(0, t - i * paso)
      const p = ruta!.punto(ti)
      r.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${escala})`)
      r.setAttribute('opacity', t > i * paso ? '1' : '0')
    })
  }

  let alRedimensionar = () => {}

  return {
    medir,
    dibujarCompleta() {
      completa = true
      medir()
      alRedimensionar = medir
      addEventListener('resize', alRedimensionar, { passive: true })
    },
    animar() {
      for (let i = 0; i < TOTAL_RUEDAS; i++) {
        const r = crearRueda()
        grupo?.append(r)
        ruedas.push(r)
      }
      medir()
      disparador = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: actualizar, onRefresh: medir })
    },
    destruir() {
      disparador?.kill()
      removeEventListener('resize', alRedimensionar)
      ruedas.splice(0).forEach((r) => r.remove())
      completa = false
    },
  }
}
