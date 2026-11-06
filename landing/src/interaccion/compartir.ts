import { CTA, SEO } from '../content/copy'
import { registrar } from '../lib/analitica'

export function iniciarCompartir() {
  document.querySelectorAll<HTMLButtonElement>('[data-compartir]').forEach((boton) => {
    const texto = boton.querySelector<HTMLElement>('[data-compartir-texto]')
    boton.addEventListener('click', async () => {
      const url = location.origin + location.pathname
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: SEO.titulo, text: 'Para la próxima salida:', url })
          registrar({ nombre: 'share_click', props: { metodo: 'nativo' } })
        } catch {
          // La persona canceló: no hay nada que avisar.
        }
        return
      }
      await navigator.clipboard?.writeText(url)
      registrar({ nombre: 'share_click', props: { metodo: 'copiar' } })
      if (texto) {
        texto.textContent = CTA.compartido
        setTimeout(() => (texto.textContent = CTA.compartir), 2200)
      }
    })
  })
}
