/**
 * Regenera `components/maps/vendor/leafletSource.ts` a partir de los archivos
 * `dist/` del paquete npm `leaflet` (mismo build que antes se cargaba desde
 * unpkg.com). Correr después de cambiar la versión de `leaflet` en package.json.
 *
 * Uso: node scripts/generate-leaflet-vendor.js
 */
const fs = require('fs')
const path = require('path')

const pkgJson = require('leaflet/package.json')
const jsPath = require.resolve('leaflet/dist/leaflet.js')
const cssPath = path.join(path.dirname(jsPath), 'leaflet.css')

const js = fs.readFileSync(jsPath, 'utf8')
const css = fs.readFileSync(cssPath, 'utf8')

const outPath = path.join(__dirname, '..', 'components', 'maps', 'vendor', 'leafletSource.ts')

const banner = `/**
 * AUTO-GENERADO por \`scripts/generate-leaflet-vendor.js\` a partir de
 * \`node_modules/leaflet/dist\` (leaflet@${pkgJson.version}) — no editar a mano.
 *
 * Leaflet se empaqueta localmente en vez de cargarse desde unpkg.com en cada
 * apertura del mapa: la app se usa justo en zonas de mala señal (rutas,
 * trekking), donde depender de un CDN externo para poder ver el mapa es frágil.
 */
`

const content =
  banner +
  `export const LEAFLET_VERSION = ${JSON.stringify(pkgJson.version)}\n\n` +
  `export const LEAFLET_CSS = ${JSON.stringify(css)}\n\n` +
  `export const LEAFLET_JS = ${JSON.stringify(js)}\n`

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, content)
console.log(`Escrito ${outPath} (leaflet@${pkgJson.version}, JS ${js.length}B, CSS ${css.length}B)`)
