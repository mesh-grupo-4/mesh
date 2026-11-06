// Dibuja el estado del simulador sobre el SVG estático. Las ruedas se comportan como resortes.
import { crearRuta } from '../lib/ruta'
import { sinMovimiento } from '../lib/preferencias'
import { SIM } from '../content/copy'
import type { EstadoSim, Integrante } from './estado'
import { RUTA_SIM, posicion } from './geometria'

const COLOR_MALLA = { neutra: '#141210', desvio: '#8B5CF6', atraso: '#EA580C', ayuda: '#DC2626' }
const METROS_ATRASO = 450
const LIMITE_DESVIO = 44

interface Rueda {
  id: string
  el: SVGGElement
  chip: SVGGElement
  x: number
  y: number
  vx: number
  vy: number
}

export function crearEscena(svg: SVGSVGElement, alDesviarArrastrando: (id: string) => void) {
  const ruta = crearRuta(RUTA_SIM)
  const lineas = [...svg.querySelectorAll<SVGLineElement>('[data-linea]')]
  const ruedas: Rueda[] = [...svg.querySelectorAll<SVGGElement>('[data-persona]')].map((el) => {
    const m = el.transform.baseVal.consolidate()?.matrix
    return { id: el.dataset.persona!, el, chip: el.querySelector('.sim-persona__chip') as SVGGElement, x: m?.e ?? 0, y: m?.f ?? 0, vx: 0, vy: 0 }
  })

  let estado: EstadoSim | null = null
  let visible = false
  let cuadro = 0
  let avance = 0
  let arrastre: { id: string; x: number; y: number } | null = null

  const integrante = (id: string) => estado?.integrantes.find((i) => i.id === id)

  function objetivo(i: Integrante) {
    const e = estado!
    const cami = e.integrantes.find((p) => p.estado === 'posible_incidente')
    // "Estoy mal": el grupo va hacia ella.
    if (e.ayudaEnCamino && cami && i.id !== cami.id) {
      const orden = e.integrantes.indexOf(i)
      return posicion(ruta, { progreso: cami.progreso + (orden - 2.5) * 0.04, offset: orden % 2 ? 34 : -34 })
    }
    const quieto = e.activa !== null && (i.estado !== 'en_movimiento' || i.incidencia === 'atraso')
    return posicion(ruta, { progreso: i.progreso + (quieto ? 0 : avance), offset: i.offset })
  }

  function etiqueta(r: Rueda, texto: string) {
    const t = r.chip.querySelector('text')!
    const fondo = r.chip.querySelector('rect')!
    if (t.textContent !== texto) t.textContent = texto
    const ancho = texto.length * 12.4 + 28
    fondo.setAttribute('width', String(ancho))
    fondo.setAttribute('x', String(-ancho / 2))
    r.chip.setAttribute('opacity', texto ? '1' : '0')
  }

  function pintar() {
    for (const r of ruedas) r.el.setAttribute('transform', `translate(${r.x.toFixed(1)} ${r.y.toFixed(1)})`)
    lineas.forEach((l, n) => {
      const a = ruedas[n]!
      const b = ruedas[n + 1]!
      l.setAttribute('x1', a.x.toFixed(1))
      l.setAttribute('y1', a.y.toFixed(1))
      l.setAttribute('x2', b.x.toFixed(1))
      l.setAttribute('y2', b.y.toFixed(1))
      const pa = integrante(a.id)
      const pb = integrante(b.id)
      const incid = pa?.incidencia !== 'ninguna' ? pa?.incidencia : pb?.incidencia
      const distancia = Math.hypot(a.x - b.x, a.y - b.y)
      l.setAttribute('stroke', estado?.ayudaEnCamino ? COLOR_MALLA.ayuda : incid === 'desvio' ? COLOR_MALLA.desvio : incid === 'atraso' ? COLOR_MALLA.atraso : COLOR_MALLA.neutra)
      l.setAttribute('stroke-width', String(Math.max(1.4, 4.4 - distancia / 70)))
    })
    if (!estado) return
    const s = SIM.situaciones
    for (const r of ruedas) {
      const p = integrante(r.id)
      if (!p) continue
      r.el.dataset.estado = p.estado
      if (p.incidencia === 'desvio') etiqueta(r, s.desvio.chip)
      else if (p.incidencia === 'atraso') {
        const f = ruedas[ruedas.indexOf(r) - 1]
        const metros = f ? Math.round(Math.min(1, Math.max(0, (Math.hypot(r.x - f.x, r.y - f.y) - 76) / 150)) * METROS_ATRASO / 10) * 10 : METROS_ATRASO
        etiqueta(r, `${s.atraso.chip} · ${metros} m`)
      } else if (p.estado === 'detenido_voluntario') etiqueta(r, s.parada.chip)
      else if (p.estado === 'posible_incidente') etiqueta(r, s.incidente.chip)
      else etiqueta(r, '')
    }
  }

  function saltar() {
    if (!estado) return
    for (const r of ruedas) {
      const p = integrante(r.id)
      if (!p) continue
      Object.assign(r, objetivo(p), { vx: 0, vy: 0 })
    }
    pintar()
  }

  function bucle() {
    cuadro = 0
    if (!visible || !estado) return
    if (sinMovimiento()) {
      saltar()
      return
    }
    avance = Math.min(0.14, avance + 0.000035)
    for (const r of ruedas) {
      const p = integrante(r.id)
      if (!p) continue
      const t = arrastre?.id === r.id ? arrastre : objetivo(p)
      r.vx = (r.vx + (t.x - r.x) * 0.03) * 0.82
      r.vy = (r.vy + (t.y - r.y) * 0.03) * 0.82
      r.x += r.vx
      r.y += r.vy
    }
    pintar()
    cuadro = requestAnimationFrame(bucle)
  }

  const arrancar = () => {
    if (!cuadro && visible) cuadro = requestAnimationFrame(bucle)
  }

  new IntersectionObserver(([e]) => {
    visible = Boolean(e?.isIntersecting)
    arrancar()
  }).observe(svg)
  addEventListener('mesh:movimiento', () => {
    if (sinMovimiento()) saltar()
    arrancar()
  })

  // Extra de escritorio: arrastrar a Gonza fuera de la cinta. Siempre hay un botón que hace lo mismo.
  const gonza = ruedas.find((r) => r.id === 'gonza')
  const aSvg = (e: PointerEvent) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
  gonza?.el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return
    const p = aSvg(e)
    arrastre = { id: 'gonza', x: p.x, y: p.y }
    gonza.el.setPointerCapture(e.pointerId)
  })
  gonza?.el.addEventListener('pointermove', (e) => {
    if (!arrastre) return
    const p = aSvg(e)
    arrastre = { id: 'gonza', x: p.x, y: p.y }
    const persona = integrante('gonza')
    if (persona && persona.incidencia === 'ninguna') {
      const base = objetivo(persona)
      if (Math.hypot(p.x - base.x, p.y - base.y) > LIMITE_DESVIO) alDesviarArrastrando('gonza')
    }
  })
  const soltar = () => {
    arrastre = null
  }
  gonza?.el.addEventListener('pointerup', soltar)
  gonza?.el.addEventListener('pointercancel', soltar)

  return {
    actualizar(nuevo: EstadoSim) {
      estado = nuevo
      if (sinMovimiento()) saltar()
      else {
        pintar()
        arrancar()
      }
    },
  }
}
