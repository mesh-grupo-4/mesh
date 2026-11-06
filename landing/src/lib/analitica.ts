// Eventos sin cookies ni identificadores persistentes. Sin variables de entorno, no hace nada.
const ENDPOINT = import.meta.env.PUBLIC_ANALITICA_ENDPOINT
const DOMINIO = import.meta.env.PUBLIC_ANALITICA_DOMINIO

export type EventoAnalitica =
  | { nombre: 'cta_click'; props: { seccion: string; plataforma: string; estado: string } }
  | { nombre: 'sim_interaction'; props: { situacion: string } }
  | { nombre: 'sim_completed'; props?: undefined }
  | { nombre: 'actividad_elegida'; props: { actividad: string } }
  | { nombre: 'share_click'; props: { metodo: string } }
  | { nombre: 'scroll_hito'; props: { seccion: string } }
  | { nombre: 'faq_open'; props: { pregunta: string } }

export function registrar({ nombre, props }: EventoAnalitica) {
  if (!ENDPOINT || !DOMINIO) return
  const cuerpo = JSON.stringify({ name: nombre, url: location.href, domain: DOMINIO, props })
  navigator.sendBeacon?.(ENDPOINT, new Blob([cuerpo], { type: 'text/plain' }))
}

export function escucharAnalitica() {
  document.addEventListener('click', (e) => {
    const cta = (e.target as Element).closest<HTMLElement>('[data-cta]')
    if (!cta?.dataset.cta) return
    registrar({
      nombre: 'cta_click',
      props: { seccion: cta.dataset.cta, plataforma: cta.dataset.plataforma ?? 'ninguna', estado: cta.dataset.estado ?? 'desconocido' },
    })
  })

  document.querySelectorAll<HTMLDetailsElement>('[data-faq]').forEach((d) => {
    d.addEventListener('toggle', () => {
      if (d.open) registrar({ nombre: 'faq_open', props: { pregunta: d.dataset.faq ?? '' } })
    })
  })

  const vistos = new Set<string>()
  const observador = new IntersectionObserver((entradas) => {
    for (const { isIntersecting, target } of entradas) {
      const seccion = (target as HTMLElement).dataset.seccion
      if (isIntersecting && seccion && !vistos.has(seccion)) {
        vistos.add(seccion)
        registrar({ nombre: 'scroll_hito', props: { seccion } })
        observador.unobserve(target)
      }
    }
  }, { threshold: 0.25 })
  document.querySelectorAll('[data-seccion]').forEach((s) => observador.observe(s))
}
