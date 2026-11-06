import { IDS_ACTIVIDAD, type ActividadId } from '../config/actividades'
import { registrar } from '../lib/analitica'
import { contarEn } from '../lib/contar'
import { sinMovimiento } from '../lib/preferencias'

const esActividad = (v: string): v is ActividadId => (IDS_ACTIVIDAD as string[]).includes(v)

export function iniciarActividades() {
  const seccion = document.querySelector<HTMLElement>('[data-actividades]')
  if (!seccion) return
  const opciones = [...seccion.querySelectorAll<HTMLButtonElement>('[data-act-opcion]')]
  const paneles = [...seccion.querySelectorAll<HTMLElement>('[data-act-panel]')]
  const cortina = seccion.querySelector<HTMLElement>('[data-act-cortina]')
  let temporizador = 0

  function cambiarTema(id: ActividadId) {
    clearTimeout(temporizador)
    cortina?.classList.remove('act__cortina--corre')
    // Moto es un corte seco, como cuando la app pasa a alto contraste.
    if (!cortina || sinMovimiento() || id === 'moto') {
      seccion!.dataset.tema = id
      return
    }
    cortina.dataset.panelTema = id
    void cortina.offsetWidth
    cortina.classList.add('act__cortina--corre')
    temporizador = window.setTimeout(() => {
      seccion!.dataset.tema = id
      cortina.classList.remove('act__cortina--corre')
    }, 500)
  }

  function elegir(id: ActividadId, gesto: boolean) {
    opciones.forEach((o) => {
      const activa = o.dataset.actOpcion === id
      o.setAttribute('aria-checked', String(activa))
      o.tabIndex = activa ? 0 : -1
    })
    paneles.forEach((p) => {
      const activo = p.dataset.actPanel === id
      p.toggleAttribute('data-activo', activo)
      p.toggleAttribute('data-entrando', activo && gesto)
      if (activo && gesto) contarEn(p)
    })
    if (!gesto) {
      seccion!.dataset.tema = id
      return
    }
    cambiarTema(id)
    registrar({ nombre: 'actividad_elegida', props: { actividad: id } })
    // Vibración corta, solo tras un gesto y donde exista (plan, 8.6).
    if ((id === 'running' || id === 'trekking') && !sinMovimiento()) navigator.vibrate?.([40, 60, 40])
  }

  opciones.forEach((o, i) => {
    o.addEventListener('click', () => elegir(o.dataset.actOpcion as ActividadId, true))
    o.addEventListener('keydown', (e) => {
      const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
      if (!delta) return
      e.preventDefault()
      const siguiente = opciones[(i + delta + opciones.length) % opciones.length]!
      elegir(siguiente.dataset.actOpcion as ActividadId, true)
      siguiente.focus()
    })
  })

  const hash = location.hash.slice(1)
  if (esActividad(hash)) {
    elegir(hash, false)
    seccion.scrollIntoView()
  }
}
