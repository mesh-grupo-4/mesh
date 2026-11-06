// Cómo funciona: pin en escritorio. En mobile y con poca altura quedan las tarjetas apiladas con sticky.
import { gsap } from 'gsap'
import { DUR, EASE } from './tokens'
import type { Limpieza, Modo } from './tipos'

const ALTO_MINIMO = 700

export function iniciarComo(modo: Modo): Limpieza | void {
  if (!modo.escritorio || innerHeight < ALTO_MINIMO) return
  const raiz = document.documentElement
  const escena = document.querySelector<HTMLElement>('[data-como-pin]')
  if (!escena) return

  raiz.dataset.como = 'pin'
  const telefonos = gsap.utils.toArray<HTMLElement>('[data-paso-tel]', escena)
  const pantallas = telefonos.map((t) => t.querySelector<HTMLElement>('.tel__pantalla')!)
  const textos = gsap.utils.toArray<HTMLElement>('[data-paso-texto]', escena)
  const ruedas = gsap.utils.toArray<HTMLElement>('[data-como-ruedas] .rueda', escena)
  const contador = escena.querySelector<HTMLElement>('[data-qr-contador]')
  const rutaMapa = escena.querySelector<SVGPathElement>('.mapa-app__ruta')
  const alertaMapa = escena.querySelector<HTMLElement>('[data-mapa-alerta]')
  const cinta = escena.querySelector<SVGPathElement>('[data-como-cinta] path')
  const datos = gsap.utils.toArray<HTMLElement>('[data-contar]', pantallas[3])

  telefonos[0]!.dataset.pasoTel = 'primero'
  // El marco común es el primero: las demás pantallas entran encima, recortadas al mismo radio.
  gsap.set(pantallas.slice(1), { opacity: 0 })
  gsap.set(rutaMapa, { attr: { 'stroke-dasharray': 1, 'stroke-dashoffset': 1 } })
  gsap.set(alertaMapa, { opacity: 0, scale: 0.6 })

  const marcar = (i: number) => textos.forEach((t, n) => t.classList.toggle('paso__texto--activo', n === i))
  marcar(0)

  const cruzar = (tl: gsap.core.Timeline, a: number, en: number) =>
    tl
      .to(pantallas[a]!, { xPercent: -14, opacity: 0, duration: 0.3, ease: EASE.suave }, en)
      .fromTo(pantallas[a + 1]!, { xPercent: 14, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.3, ease: EASE.suave }, en)

  const tl = gsap.timeline({
    defaults: { ease: EASE.scroll },
    scrollTrigger: {
      trigger: escena,
      pin: true,
      start: 'top top',
      end: '+=300%',
      scrub: 0.4,
      onUpdate: (self) => marcar(Math.min(3, Math.floor(self.progress * 4))),
    },
  })

  // Paso 2: el QR. Las ruedas vuelan al teléfono mientras sube el contador.
  cruzar(tl, 0, 0.72)
  const cuenta = { n: 1 }
  tl.to(cuenta, {
    n: 6,
    duration: 0.7,
    onUpdate: () => {
      if (contador) contador.textContent = `${Math.round(cuenta.n)}/6`
    },
  }, 1.05)
  ruedas.forEach((r, i) => {
    const angulo = (i / ruedas.length) * Math.PI * 2 + 0.5
    tl.set(r, { opacity: 1 }, 1.05 + i * 0.05)
      .fromTo(r, { x: Math.cos(angulo) * innerWidth * 0.46, y: Math.sin(angulo) * innerHeight * 0.46 }, { x: 0, y: 0, duration: 0.5 }, 1.05 + i * 0.05)
      .set(r, { opacity: 0 }, 1.55 + i * 0.05)
  })

  // Paso 3: la cinta entra al teléfono y se vuelve la ruta del mapa.
  cruzar(tl, 1, 1.72)
  if (cinta) tl.fromTo(cinta, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.4 }, 1.82)
  if (rutaMapa) tl.to(rutaMapa, { attr: { 'stroke-dashoffset': 0 }, duration: 0.5 }, 2.08)
  if (alertaMapa) tl.to(alertaMapa, { opacity: 1, scale: 1, duration: 0.14, ease: EASE.rebote }, 2.5)

  // Paso 4: el resumen, con sus contadores.
  cruzar(tl, 2, 2.72)
  if (cinta) tl.to(cinta, { attr: { 'stroke-dashoffset': -1 }, duration: 0.3 }, 2.72)
  datos.forEach((d) => {
    const hasta = Number(d.dataset.contar)
    const o = { n: 0 }
    tl.to(o, { n: hasta, duration: 0.24, onUpdate: () => (d.textContent = String(Math.round(o.n))) }, 3)
  })
  tl.to({}, { duration: 0.06 }, 3.24)

  gsap.from(telefonos[0]!, { y: 40, opacity: 0, duration: DUR.media, ease: EASE.salida, scrollTrigger: { trigger: escena, start: 'top 80%', once: true } })

  return () => {
    delete raiz.dataset.como
    telefonos[0]!.dataset.pasoTel = ''
    textos.forEach((t) => t.classList.remove('paso__texto--activo'))
    if (contador) contador.textContent = '6/6'
    datos.forEach((d) => (d.textContent = d.dataset.contar ?? ''))
    gsap.set([...pantallas, ...telefonos, rutaMapa, alertaMapa, ...ruedas], { clearProps: 'all' })
    rutaMapa?.removeAttribute('stroke-dasharray')
    rutaMapa?.removeAttribute('stroke-dashoffset')
  }
}
