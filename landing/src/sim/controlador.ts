import { SIM } from '../content/copy'
import { registrar } from '../lib/analitica'
import { LIDER } from './datos-ejemplo'
import { crearEscena } from './escena'
import { estadoInicial, reducir, TOTAL_SITUACIONES, type Aviso, type EstadoSim, type Evento, type Situacion, type TipoAviso } from './estado'

const ICONOS: Record<TipoAviso, string> = {
  desvio: '<path d="M3 11l19-9-9 19-2-8-8-2z"/>',
  atraso: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  parada: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  posible_incidente: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  peligro: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<path d="M20 6L9 17l-5-5"/>',
}
const COLORES: Record<TipoAviso, string> = {
  desvio: '#B79CFF', atraso: '#FF9A5C', parada: '#F59E0B', posible_incidente: '#FF8A80', peligro: '#FF8A80', info: '#4FB477',
}
const EVENTOS: Record<Situacion, Evento> = {
  desvio: { tipo: 'DESVIAR', id: 'gonza' },
  atraso: { tipo: 'ATRASAR', id: 'flor' },
  parada: { tipo: 'INICIAR_PARADA', id: 'nico' },
  incidente: { tipo: 'DETENCION_SIN_AVISO', id: 'cami' },
}

function nodoAviso(a: Aviso): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'app-aviso pop'
  li.style.setProperty('--color', COLORES[a.tipo])
  li.innerHTML = `<svg class="icono" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[a.tipo]}</svg>`
  const cuerpo = document.createElement('span')
  const titulo = document.createElement('strong')
  titulo.textContent = a.texto
  const detalle = document.createElement('span')
  detalle.className = 'app-sub'
  detalle.textContent = a.detalle
  cuerpo.append(titulo, detalle)
  li.append(cuerpo)
  return li
}

export function iniciar() {
  const raiz = document.querySelector<HTMLElement>('[data-sim]')
  const svg = raiz?.querySelector<SVGSVGElement>('[data-sim-mapa]')
  if (!raiz || !svg) return
  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!
  const botones = [...raiz.querySelectorAll<HTMLButtonElement>('[data-sim-situacion]')]
  const contador = q('[data-sim-contador]')
  const avisos = q('[data-sim-avisos]')
  const vacio = q('[data-sim-vacio]')
  const toast = q('[data-sim-toast]')
  const salida = q('[data-sim-salida]')
  const nota = q('[data-sim-nota]')
  const salir = q<HTMLButtonElement>('[data-sim-salir]')
  const banner = q('[data-sim-banner]')
  const categorias = q('[data-sim-categorias]')
  const cartel = q('[data-sim-cartel]')
  const vivo = q('[data-sim-vivo]')
  const secundario = q('[data-sim-secundario]')
  const meta = q('[data-sim-meta]')

  let estado = estadoInicial()
  let interactuo = false
  let completoAvisado = false
  const s = SIM.situaciones

  const escena = crearEscena(svg, (id) => despachar({ tipo: 'DESVIAR', id }))

  function renderAvisos(e: EstadoSim, previo: EstadoSim) {
    if (e.avisos === previo.avisos) return
    avisos.querySelectorAll('.app-aviso').forEach((n) => n.remove())
    e.avisos.slice(0, 3).forEach((a) => avisos.append(nodoAviso(a)))
    vacio.hidden = e.avisos.length > 0
    const ultimo = e.avisos[0]
    toast.hidden = !ultimo
    toast.replaceChildren(...(ultimo ? [nodoAviso(ultimo)] : []))
    if (ultimo) vivo.textContent = `${ultimo.texto}. ${ultimo.detalle}.`
  }

  function salidaDe(e: EstadoSim): { texto: string; nota: string } | null {
    switch (e.activa) {
      case 'desvio': return { texto: s.desvio.salida, nota: '' }
      case 'atraso': return { texto: s.atraso.salida, nota: '' }
      case 'parada': return { texto: s.parada.salida, nota: s.parada.nota }
      case 'incidente': return e.ayudaEnCamino ? { texto: s.incidente.cerrar, nota: s.incidente.notaMal } : null
      default: return null
    }
  }

  function render(e: EstadoSim, previo: EstadoSim) {
    contador.textContent = `${e.completadas.length}/${TOTAL_SITUACIONES}`
    botones.forEach((b) => {
      const id = b.dataset.simSituacion as Situacion
      b.setAttribute('aria-pressed', String(e.activa === id))
      b.toggleAttribute('data-vista', e.completadas.includes(id))
    })
    renderAvisos(e, previo)

    const incidente = e.activa === 'incidente'
    raiz!.toggleAttribute('data-serio', incidente)
    svg!.toggleAttribute('data-ayuda', e.ayudaEnCamino)
    cartel.hidden = !incidente
    banner.hidden = !incidente || e.ayudaEnCamino
    categorias.hidden = e.activa !== 'parada'

    const out = salidaDe(e)
    salida.hidden = !out
    if (out) {
      salir.textContent = out.texto
      nota.textContent = out.nota
      if (out.nota && e.ayudaEnCamino) vivo.textContent = out.nota
    }

    secundario.hidden = !interactuo || e.completadas.length >= TOTAL_SITUACIONES
    meta.hidden = e.completadas.length < TOTAL_SITUACIONES
    if (e.completadas.length >= TOTAL_SITUACIONES && !completoAvisado) {
      completoAvisado = true
      registrar({ nombre: 'sim_completed' })
    }
    escena.actualizar(e)
  }

  function despachar(ev: Evento) {
    const previo = estado
    estado = reducir(estado, ev)
    render(estado, previo)
  }

  botones.forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.simSituacion as Situacion
      if (estado.activa === id) return
      interactuo = true
      registrar({ nombre: 'sim_interaction', props: { situacion: id } })
      despachar(EVENTOS[id])
    })
  })

  salir.addEventListener('click', () => {
    const activa = estado.activa
    if (activa) despachar({ tipo: activa === 'parada' ? 'FIN_PARADA' : 'VOLVER', id: EVENTOS[activa].tipo === 'REINICIAR' ? '' : (EVENTOS[activa] as { id: string }).id })
    botones[0]?.closest('.sim__controles')?.querySelector<HTMLElement>('[aria-pressed="false"]:not([data-vista])')?.focus({ preventScroll: true })
  })

  raiz.querySelectorAll<HTMLButtonElement>('[data-sim-accion]').forEach((b) => {
    b.addEventListener('click', () => despachar({ tipo: b.dataset.simAccion as 'ESTOY_BIEN' | 'ESTOY_MAL', id: 'cami' }))
  })

  // En mobile el mapa es cuadrado: se encuadra para que entre Flor cuando queda atrás, con su etiqueta.
  const angosto = matchMedia('(max-width: 899px)')
  const encuadrar = () => svg!.setAttribute('viewBox', angosto.matches ? '60 0 620 620' : '0 0 900 620')
  angosto.addEventListener('change', encuadrar)
  encuadrar()

  // Quién manda en el teléfono del ejemplo: el rótulo lo aclara para quien lee sin ver el mapa.
  svg.setAttribute('aria-label', `${SIM.mapaDescripcion} Lidera ${LIDER}.`)
  render(estado, estado)
}
