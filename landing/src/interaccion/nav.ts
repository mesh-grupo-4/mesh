// Barra de navegación: mini ruta, ocultar/mostrar y CTA fijo. Sin GSAP: funciona siempre.
export function iniciarNav() {
  const nav = document.querySelector<HTMLElement>('[data-nav]')
  if (!nav) return
  const rueda = nav.querySelector<HTMLElement>('[data-nav-rueda]')
  const barra = nav.querySelector<HTMLElement>('[data-nav-progreso]')
  const ctaFijo = document.querySelector<HTMLElement>('[data-cta-fijo]')
  const hero = document.querySelector<HTMLElement>('#inicio')
  const llegada = document.querySelector<HTMLElement>('#llegada')
  const hitos = [...nav.querySelectorAll<HTMLAnchorElement>('[data-nav-hito]')]
    .map((a) => document.querySelector<HTMLElement>(a.getAttribute('href') ?? ''))
    .filter((s): s is HTMLElement => Boolean(s))

  let anterior = scrollY
  let pendiente = false

  function fraccion(y: number): number {
    const tops = hitos.map((s) => s.getBoundingClientRect().top + y)
    for (let i = tops.length - 2; i >= 0; i--) {
      if (y >= tops[i]! - 1) {
        const tramo = tops[i + 1]! - tops[i]! || 1
        return (i + Math.min(1, (y - tops[i]!) / tramo)) / (tops.length - 1)
      }
    }
    return 0
  }

  function actualizar() {
    pendiente = false
    const y = scrollY
    const alto = document.documentElement.scrollHeight - innerHeight
    const altoHero = hero?.offsetHeight ?? innerHeight

    if (Math.abs(y - anterior) > 4) {
      nav!.classList.toggle('nav--oculta', y > anterior && y > 120)
      anterior = y
    }
    nav!.classList.toggle('nav--fondo', y > altoHero - 80)
    barra?.style.setProperty('--progreso', String(alto > 0 ? y / alto : 0))

    if (rueda?.parentElement && rueda.offsetParent) {
      const ancho = rueda.parentElement.offsetWidth - 40
      rueda.style.transform = `translateX(${fraccion(y) * ancho + 11}px)`
    }

    if (ctaFijo && llegada) {
      const enLlegada = llegada.getBoundingClientRect().top < innerHeight * 0.85
      ctaFijo.classList.toggle('cta-fijo--on', y > altoHero * 0.8 && !enLlegada)
    }
  }

  const pedir = () => {
    if (!pendiente) {
      pendiente = true
      requestAnimationFrame(actualizar)
    }
  }
  addEventListener('scroll', pedir, { passive: true })
  addEventListener('resize', pedir, { passive: true })
  pedir()
}
