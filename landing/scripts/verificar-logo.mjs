// Fase 1: superpone logo.svg al PNG original y mide la coincidencia (IoU) píxel a píxel.
// Uso: node scripts/verificar-logo.mjs <ruta a mesh-logo.png>
import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'node:fs'
const pngPath = process.argv[2]
const svg = readFileSync(new URL('../src/assets/logo.svg', import.meta.url), 'utf8')
const orig = PNG.sync.read(readFileSync(pngPath))
const { width: W, height: H } = orig
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H } })
const lleno = svg.replace('viewBox="265 228 594 549"', `viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"`)
await page.setContent(`<!doctype html><body style="margin:0;background:#fff">${lleno}</body>`)
const shot = PNG.sync.read(await page.screenshot())
await browser.close()
const on = (img, i) => { const a = img.data[i + 3] / 255; return img.data[i + 1] * a + 255 * (1 - a) < 150 }
let inter = 0, union = 0
const diff = new PNG({ width: W, height: H })
for (let i = 0; i < W * H * 4; i += 4) {
  const a = on(orig, i), b = on(shot, i)
  if (a && b) inter++
  if (a || b) union++
  diff.data[i] = a && !b ? 255 : a && b ? 200 : !a && b ? 0 : 255
  diff.data[i + 1] = a && b ? 200 : !a && b ? 0 : a ? 0 : 255
  diff.data[i + 2] = !a && b ? 255 : a && b ? 200 : a ? 0 : 255
  diff.data[i + 3] = 255
}
if (process.argv[3]) writeFileSync(process.argv[3], PNG.sync.write(diff))
console.log(`IoU logo.svg vs PNG: ${(inter / union * 100).toFixed(2)} % (${union - inter} píxeles distintos de ${union})`)
