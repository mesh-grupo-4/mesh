import type { APIRoute } from 'astro'

// Con barra final: nginx sirve /privacidad/index.html y redirige lo que llega sin ella.
const RUTAS = ['/', '/privacidad/', '/terminos/']

export const GET: APIRoute = ({ site }) => {
  const urls = RUTAS.map((r) => `<url><loc>${new URL(r, site).href}</loc></url>`).join('')
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
