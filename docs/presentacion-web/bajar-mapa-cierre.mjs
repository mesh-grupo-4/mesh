// Baja los mosaicos satelitales (con nombres de calles, como la capa "Satélite" de la app)
// que usa la pantalla del Viaje YA de index.html para la zona UTN FRC → Paseo del Buen Pastor.
//
// Usa la misma key con la que la app muestra el mapa (GOOGLE_MAPS_ANDROID_API_KEY de
// frontend/.env), que es la que tiene habilitada la Map Tiles API. Solo la lee: no queda en
// ningún archivo de la presentación.
//
// Uso (desde la raíz del repo):
//   node docs/presentacion-web/bajar-mapa-cierre.mjs
// Opcional: otra ruta al .env como primer argumento y otro nombre de variable como segundo.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const envPath = process.argv[2] || join(aqui, '..', '..', 'frontend', '.env')
const variable = process.argv[3] || 'GOOGLE_MAPS_ANDROID_API_KEY'
const linea = readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => new RegExp(`^\\s*${variable}\\s*=`).test(l))
if (!linea) throw new Error(`No hay ${variable} en ${envPath}`)
const KEY = linea.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')

// Misma zona y zoom que el script del cierre en index.html (constantes ZONA y Z).
const Z = 16
const ZONA = { n: -31.4080, s: -31.4585, o: -64.2030, e: -64.1770 }
function mosaico(lat, lng) {
  const n = 2 ** Z
  const sin = Math.sin((lat * Math.PI) / 180)
  return [Math.floor(((lng + 180) / 360) * n), Math.floor((0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n)]
}
const [x0, y0] = mosaico(ZONA.n, ZONA.o)
const [x1, y1] = mosaico(ZONA.s, ZONA.e)

const sesion = await fetch(`https://tile.googleapis.com/v1/createSession?key=${KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mapType: 'satellite',
    language: 'es-AR',
    region: 'AR',
    layerTypes: ['layerRoadmap'],
    scale: 'scaleFactor2x',
    highDpi: true,
  }),
})
if (!sesion.ok) throw new Error(`createSession ${sesion.status}: ${await sesion.text()}`)
const { session } = await sesion.json()

const salida = join(aqui, 'cierre', 'mapa')
mkdirSync(salida, { recursive: true })
let bajados = 0
for (let x = x0; x <= x1; x++) {
  for (let y = y0; y <= y1; y++) {
    const archivo = join(salida, `${Z}_${x}_${y}.jpg`)
    if (existsSync(archivo)) continue
    const r = await fetch(`https://tile.googleapis.com/v1/2dtiles/${Z}/${x}/${y}?session=${session}&key=${KEY}`)
    if (!r.ok) throw new Error(`Mosaico ${x},${y}: ${r.status} ${await r.text()}`)
    writeFileSync(archivo, Buffer.from(await r.arrayBuffer()))
    bajados++
  }
}

// Atribución que pide Google para esta zona (va en la esquina del mapa).
const vista = await fetch(
  `https://tile.googleapis.com/tile/v1/viewport?session=${session}&key=${KEY}` +
    `&zoom=${Z}&north=${ZONA.n}&south=${ZONA.s}&west=${ZONA.o}&east=${ZONA.e}`
)
const atribucion = vista.ok ? (await vista.json()).copyright : '(no se pudo leer)'
console.log(`Listo: ${bajados} mosaicos nuevos (${(x1 - x0 + 1) * (y1 - y0 + 1)} en total) en ${salida}`)
console.log(`Atribución: ${atribucion}`)
