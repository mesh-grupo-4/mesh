// Plan, 10.4: si alguna de estas reglas se rompe, el build falla. Corre sobre el HTML generado.
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACTIVIDADES } from '../src/config/actividades'
import * as copy from '../src/content/copy'

const leer = (ruta: string) => readFileSync(new URL(`../dist/${ruta}`, import.meta.url), 'utf8')
const PAGINAS = ['index.html', 'privacidad/index.html', 'terminos/index.html', '404.html']
const html = leer('index.html')

/** Texto visible y atributos de contenido, sin bloques de código ni estilos. */
const sinCodigo = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/g, '')

function bloque(id: string): string {
  const inicio = html.search(new RegExp(`<(article|section)[^>]*\\bid="${id}"`))
  expect(inicio, `no existe el bloque #${id}`).toBeGreaterThan(-1)
  const etiqueta = html.slice(inicio + 1, inicio + 8).startsWith('article') ? 'article' : 'section'
  return html.slice(inicio, html.indexOf(`</${etiqueta}>`, inicio))
}

describe('RN-070: moto queda fuera de toda competencia', () => {
  it('moto.competencia es false', () => {
    expect(ACTIVIDADES.moto.competencia).toBe(false)
  })

  it('ninguna actividad expone campos de velocidad', () => {
    for (const a of Object.values(ACTIVIDADES)) {
      for (const campo of Object.keys(a)) expect(campo).not.toMatch(/velocidad|speed|ritmo|kmh/i)
    }
  })

  it('#moto y Competir no usan lenguaje de competencia', () => {
    const prohibido = /ranking activo|podio|más rápido|récord/i
    expect(bloque('moto')).not.toMatch(prohibido)
    expect(bloque('competir')).not.toMatch(prohibido)
  })

  it('la tabla de Competir no incluye motos', () => {
    const tabla = bloque('competir').match(/data-comp-tabla[\s\S]*?<\/figure>/)?.[0] ?? ''
    expect(tabla).toContain('Salida en bici')
    expect(tabla).not.toMatch(/moto/i)
  })

  it('el manifiesto de moto está publicado tal cual', () => {
    for (const linea of copy.COMPETIR.manifiesto) expect(html).toContain(linea)
  })
})

describe('veracidad y seguridad', () => {
  const PROHIBIDAS = [
    /km\/h/i, /velocímetro/i, /wrapped/i, /inteligencia artificial/i, /\bIA\b/, /wearable/i, /radares?/i,
    /se cae/i, /100\s*%\s*segur/i, /rastre[aá]/i, /aggregateRating/, /testimonios?/i,
    /nadie se pierde nunca/i, /hasta 200/i, /la única app/i, /ninguna app/i, /vigil[aá]/i, /controlá/i, /\bgratis\b/i,
    /giro a giro/i, /estrellas/i,
  ]

  for (const pagina of PAGINAS) {
    it(`${pagina} no contiene expresiones prohibidas`, () => {
      const contenido = sinCodigo(leer(pagina))
      for (const regla of PROHIBIDAS) expect(contenido, String(regla)).not.toMatch(regla)
    })
  }

  it('el aviso de seguridad con 911 está en el footer, la FAQ y el simulador', () => {
    const footer = html.slice(html.indexOf('<footer'))
    expect(footer).toContain(copy.AVISO_SEGURIDAD)
    expect(footer).toContain('911')
    expect(bloque('faq')).toContain(copy.AVISO_SEGURIDAD)
    expect(bloque('simulador')).toContain(copy.AVISO_SEGURIDAD)
  })

  it('los mockups llevan el rótulo de datos de ejemplo', () => {
    for (const id of ['inicio', 'problema', 'como-funciona', 'simulador', 'offline', 'privacidad', 'competir']) {
      expect(bloque(id), id).toContain(copy.ROTULO_EJEMPLO)
    }
  })

  it('privacidad: dice la consecuencia de apagar el compartir', () => {
    expect(bloque('privacidad')).toContain(copy.PRIV.consecuencia)
    expect(bloque('offline')).toContain(copy.OFFLINE.pie)
  })

  it('JSON-LD: sin calificaciones ni precios', () => {
    const datos = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!))
    expect(datos.map((d) => d['@type']).sort()).toEqual(['FAQPage', 'MobileApplication'])
    const app = datos.find((d) => d['@type'] === 'MobileApplication')
    expect(app).not.toHaveProperty('aggregateRating')
    expect(app).not.toHaveProperty('offers')
  })
})

describe('descarga sin configurar', () => {
  const configurada = process.env.PUBLIC_ANDROID_URL || process.env.PUBLIC_APK_URL || process.env.PUBLIC_IOS_URL

  it.skipIf(configurada)('no aparecen insignias de tiendas ni QR de descarga', () => {
    expect(html).not.toContain('data-insignia-tienda')
    expect(html).not.toMatch(/google play|app store/i)
    expect(html).not.toContain('data-cta-qr')
    expect(html).toContain(copy.CTA.proxIos)
  })
})

describe('dominio', () => {
  const SITIO = 'https://mesh-app.com.ar'

  it('la landing se puede indexar y declara su URL canónica', () => {
    expect(html).not.toContain('noindex')
    expect(html).toContain(`<link rel="canonical" href="${SITIO}/">`)
    expect(leer('privacidad/index.html')).toContain(`<link rel="canonical" href="${SITIO}/privacidad/">`)
    expect(html).toContain(`content="${SITIO}/og-mesh.png"`)
  })

  it('robots y sitemap apuntan al dominio, con las mismas URL que las canónicas', () => {
    expect(leer('robots.txt')).toContain(`Sitemap: ${SITIO}/sitemap.xml`)
    const sitemap = leer('sitemap.xml')
    for (const url of ['/', '/privacidad/', '/terminos/']) expect(sitemap).toContain(`<loc>${SITIO}${url}</loc>`)
    expect(sitemap).not.toContain('404')
  })

  it('existe /404.html, y no se indexa', () => {
    const error = leer('404.html')
    expect(error).toContain('noindex')
    expect(error).not.toContain('rel="canonical"')
    expect(error).toContain('href="/"')
  })
})

describe('estructura', () => {
  it('hay un solo H1, y es el del hero', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(sinCodigo(html).match(/<h1[\s\S]*?<\/h1>/)?.[0]).toContain('Gonza')
  })

  it('/estilos no se publica', () => {
    expect(existsSync(new URL('../dist/estilos/index.html', import.meta.url))).toBe(false)
  })

  it('los legales muestran el banner de borrador', () => {
    expect(leer('privacidad/index.html')).toContain(copy.LEGAL.banner)
    expect(leer('terminos/index.html')).toContain(copy.LEGAL.banner)
  })

  it('el logo conserva sus grupos', () => {
    const logo = readFileSync(new URL('../src/assets/logo.svg', import.meta.url), 'utf8')
    for (const id of ['cinta', 'rueda-izq', 'rueda-der']) expect(logo).toContain(`id="${id}"`)
    expect(html).toContain('logo-cinta')
  })
})
