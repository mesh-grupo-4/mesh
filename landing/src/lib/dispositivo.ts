export type Plataforma = 'android' | 'ios' | 'escritorio'

export function detectarPlataforma(ua = navigator.userAgent, puntosTactiles = navigator.maxTouchPoints): Plataforma {
  if (/android/i.test(ua)) return 'android'
  // iPadOS se presenta como Mac; se distingue por tener pantalla táctil.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && puntosTactiles > 1)) return 'ios'
  return 'escritorio'
}

/** Lleva cada CTA a la plataforma del visitante, y pone primero su botón. */
export function adaptarDescarga() {
  const plataforma = detectarPlataforma()
  if (plataforma === 'escritorio') return

  document.querySelectorAll<HTMLAnchorElement>('[data-cta-simple]').forEach((a) => {
    const propia = plataforma === 'android' ? a.dataset.urlAndroid : a.dataset.urlIos
    // Sin versión para su teléfono, lo lleva a la llegada, donde el estado se explica.
    a.href = propia ?? '#llegada'
    a.dataset.plataforma = propia ? plataforma : 'no_disponible'
  })

  document.querySelectorAll<HTMLElement>('[data-descarga-botones]').forEach((caja) => {
    const propio = caja.querySelector(`[data-plataforma="${plataforma}"]`)
    const nodo = propio?.closest('[data-plataforma-caja]') ?? propio
    if (nodo) caja.prepend(nodo)
  })
}
